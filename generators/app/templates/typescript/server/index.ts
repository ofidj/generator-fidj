import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { DataStore } from "./data-store";
import { verifyPrivacyRequest } from "./privacy-adapter";
export { DataStore } from "./data-store";
import { verifyAppSession, SessionVerificationError } from "@ofidj/node";

export interface Settings {
  appId: string;
  apiEndpoint: string;
  dashboardUrl: string;
  title: string;
  releaseVersion: string;
  localDemo: boolean;
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function body(req: IncomingMessage): Promise<any> {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 16384)
      throw new HttpError(413, "Request too large.");
  }
  try {
    return JSON.parse(value || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

export function createApp(
  settings: Settings,
  options: { dataDir?: string; adapterKey?: string; store?: DataStore } = {},
) {
  const store =
    options.store ||
    new DataStore(
      options.dataDir || join(process.cwd(), ".fidj-data"),
      settings.appId,
    );
  const upstream = async (
    token: string,
    suffix: string,
    method = "GET",
    data?: unknown,
  ) => {
    let response: Response;
    try {
      response = await fetch(
        `${settings.apiEndpoint}/me/apps/${encodeURIComponent(settings.appId)}${suffix}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: data === undefined ? undefined : JSON.stringify(data),
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
    } catch {
      throw new HttpError(503, "Fidj is unavailable. Please retry.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new HttpError(
        response.status,
        result.status || "Fidj could not complete this action.",
      );
    return { status: response.status, data: result };
  };
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (pathname === "/fidj/privacy" && req.method === "POST") {
        const input = await body(req);
        if (
          !verifyPrivacyRequest(
            options.adapterKey,
            String(req.headers["x-fidj-timestamp"] || ""),
            String(req.headers["x-fidj-signature"] || ""),
            input,
          )
        )
          throw new HttpError(401, "Invalid privacy request.");
        if (
          input.appId !== settings.appId ||
          typeof input.subject !== "string" ||
          !input.subject ||
          input.subject.length > 200 ||
          typeof input.requestId !== "string" ||
          !/^[a-zA-Z0-9-]{1,100}$/.test(input.requestId)
        )
          throw new HttpError(400, "Invalid privacy scope.");
        if (input.operation === "check") return json(res, 200, {requestId: input.requestId, status: "completed", ...await store.check()});
        if (input.operation === "export")
          return json(res, 200, {
            requestId: input.requestId,
            status: "completed",
            data: { notes: await store.notes(input.subject) },
            coverage: "Notes stored by this app",
          });
        if (input.operation === "erase")
          return json(
            res,
            200,
            await store.erase(input.subject, input.requestId),
          );
        throw new HttpError(400, "Unsupported privacy operation.");
      }
      if (pathname === "/api/config" && req.method === "GET")
        return json(res, 200, settings);
      if (pathname === "/api/health" && req.method === "GET")
        return json(res, 200, { status: "ready" });
      if (pathname.startsWith("/api/")) {
        const authorization = req.headers.authorization || "";
        if (!authorization.startsWith("Bearer "))
          throw new HttpError(401, "Sign in to continue.");
        const token = authorization.slice(7);
        const session = await verifyAppSession(token, settings);
        if (pathname === "/api/session" && req.method === "GET")
          return json(res, 200, session);
        if (pathname === "/api/notes" && req.method === "GET")
          return json(res, 200, { notes: await store.notes(session.subject) });
        if (pathname === "/api/notes" && req.method === "POST") {
          if (!session.roles.some((role) => ["Owner", "Editor"].includes(role)))
            throw new HttpError(
              403,
              "An Editor or Owner role is required to save a note.",
            );
          const input = await body(req);
          if (
            typeof input.title !== "string" ||
            !input.title.trim() ||
            input.title.length > 120 ||
            typeof input.body !== "string" ||
            input.body.length > 5000
          )
            throw new HttpError(
              400,
              "Add a title (up to 120 characters) and a note (up to 5,000 characters).",
            );
          const current = await store.notes(session.subject);
          if (current.length >= 100)
            throw new HttpError(
              409,
              "This starter supports 100 notes per person.",
            );
          const note = {
            id: crypto.randomUUID(),
            title: input.title.trim(),
            body: input.body,
            createdAt: new Date().toISOString(),
          };
          await store.add(session.subject, note, () =>
            verifyAppSession(token, settings),
          );
          return json(res, 201, { note });
        }
        if (pathname === "/api/privacy" && req.method === "GET") {
          const [consent, history] = await Promise.all([
            upstream(token, "/consents"),
            upstream(token, "/consents/history"),
          ]);
          return json(res, 200, {
            consent: consent.data,
            history: history.data.history,
          });
        }
        if (pathname === "/api/privacy" && req.method === "PUT") {
          const input = await body(req);
          const data: Record<string, unknown> = { source: "profile" };
          for (const purpose of [
            "terms",
            "analytics",
            "communications",
            "optionalData",
          ])
            if (input[purpose] !== undefined) data[purpose] = input[purpose];
          if (input.terms === true) data.termsVersion = "starter-demo-1";
          const result = await upstream(token, "/consents", "PUT", data);
          return json(res, result.status, result.data);
        }
        if (pathname === "/api/privacy/export" && req.method === "GET") {
          const identity = await upstream(token, "/export");
          return json(res, 200, {
            exportedAt: new Date().toISOString(),
            fidj: identity.data,
            app: identity.data.applicationData || {
              notes: await store.notes(session.subject),
            },
            coverage:
              "Fidj records for this membership plus this app’s persisted notes. No other apps or independent external systems.",
          });
        }
        if (pathname === "/api/privacy/leave" && req.method === "DELETE") {
          const input = await body(req);
          if (input.confirm !== settings.appId)
            throw new HttpError(400, "Confirm this app before leaving.");
          const connection = await upstream(token, "/consents");
          if (!connection.data.appDataConnected)
            throw new HttpError(
              409,
              "The app owner must connect the data-erasure handler before departure can include your notes.",
            );
          const result = await upstream(token, "", "DELETE", {
            confirm: settings.appId,
          });
          return json(res, result.status, {
            ...result.data,
            appNotes: result.data.appData || "not_connected",
          });
        }
        throw new HttpError(404, "Unknown operation.");
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new HttpError(405, "Method not allowed.");
      const files: Record<string, [string, string]> = {
        "/": ["index.html", "text/html"],
        "/index.html": ["index.html", "text/html"],
        "/app": ["app.html", "text/html"],
        "/hero.gif": ["hero.gif", "image/gif"],
        "/main.js": ["main.js", "text/javascript"],
        "/main.css": ["main.css", "text/css"],
        "/fidj-logo.png": ["fidj-logo.png", "image/png"],
      };
      // Beyond the named files above, three directories are served from the
      // build manifest: the assembled application module, the design system's
      // self-hosted fonts, and any logo or favicon the app supplied. The
      // manifest only resolves paths the build actually produced.
      if (
        !files[pathname] &&
        (pathname.startsWith("/module/") ||
          pathname.startsWith("/fonts/") ||
          pathname.startsWith("/brand/"))
      ) {
        const manifest = JSON.parse(
          await readFile(join(__dirname, "public-files.json"), "utf8"),
        );
        const asset =
          manifest[pathname] ||
          (pathname.endsWith("/")
            ? manifest[pathname + "index.html"]
            : undefined);
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".gif": "image/gif",
          ".ico": "image/x-icon",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
        };
        if (typeof asset === "string")
          files[pathname] = [
            asset,
            types[extname(asset)] || "application/octet-stream",
          ];
      }
      const file = files[pathname];
      if (!file) throw new HttpError(404, "Not found.");
      const content = await readFile(join(__dirname, "public", file[0]));
      const apiOrigin = new URL(settings.apiEndpoint).origin;
      res.writeHead(200, {
        "Content-Type": file[1],
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: ${apiOrigin}; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      const status =
        error instanceof HttpError || error instanceof SessionVerificationError
          ? error.status
          : 500;
      json(res, status, {
        message:
          status === 500
            ? "The app could not complete this action."
            : (error as Error).message,
      });
    }
  });
}

if (require.main === module) {
  const appId = process.env.FIDJ_APP_ID;
  if (!appId || !process.env.FIDJ_API_ENDPOINT)
    throw new Error("Set FIDJ_APP_ID and FIDJ_API_ENDPOINT in .env.");
  const apiEndpoint = process.env.FIDJ_API_ENDPOINT.replace(/\/$/, "");
  const api = new URL(apiEndpoint);
  if (
    !["https:", "http:"].includes(api.protocol) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash
  )
    throw new Error("Invalid Fidj API URL.");
  const port = Number(process.env.PORT || 8200);
  const host = process.env.HOST || "127.0.0.1";
  const settings = {
    appId,
    apiEndpoint,
    dashboardUrl: process.env.FIDJ_DASHBOARD_URL || "https://fidj.ovh",
    title: process.env.APP_TITLE || "My workspace",
    releaseVersion: process.env.APP_VERSION || "",
    localDemo:
      process.env.LOCAL_DEMO === "true" &&
      host === "127.0.0.1" &&
      ["localhost", "127.0.0.1"].includes(api.hostname),
  };
  createApp(settings, {
    dataDir: process.env.FIDJ_DATA_DIR,
    adapterKey: process.env.FIDJ_PRIVACY_ADAPTER_KEY,
  }).listen(port, host, () =>
    console.log(`${settings.title}: http://${host}:${port}`),
  );
}
