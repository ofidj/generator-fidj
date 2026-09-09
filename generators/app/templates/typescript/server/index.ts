import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyAppSession, SessionVerificationError } from "@ofidj/node";

export interface Settings {
  appId: string;
  apiEndpoint: string;
  dashboardUrl: string;
  title: string;
  localDemo: boolean;
}
interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
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

export function createApp(settings: Settings) {
  const notes = new Map<string, Note[]>();
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
          return json(res, 200, { notes: notes.get(session.subject) || [] });
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
          const current = notes.get(session.subject) || [];
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
          notes.set(session.subject, [...current, note]);
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
            app: { notes: notes.get(session.subject) || [] },
            coverage:
              "Fidj records for this membership plus this starter’s in-memory notes. No other apps or independent external systems.",
          });
        }
        if (pathname === "/api/privacy/leave" && req.method === "DELETE") {
          const input = await body(req);
          if (input.confirm !== settings.appId)
            throw new HttpError(400, "Confirm this app before leaving.");
          const result = await upstream(token, "", "DELETE", {
            confirm: settings.appId,
          });
          notes.delete(session.subject);
          return json(res, result.status, {
            ...result.data,
            appNotes: "erased",
          });
        }
        throw new HttpError(404, "Unknown operation.");
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new HttpError(405, "Method not allowed.");
      const files: Record<string, [string, string]> = {
        "/": ["index.html", "text/html"],
        "/app": ["app.html", "text/html"],
        "/hero.gif": ["hero.gif", "image/gif"],
        "/main.js": ["main.js", "text/javascript"],
        "/main.css": ["main.css", "text/css"],
        "/fidj-logo.png": ["fidj-logo.png", "image/png"],
      };
      const file = files[pathname];
      if (!file) throw new HttpError(404, "Not found.");
      const content = await readFile(join(__dirname, "public", file[0]));
      const apiOrigin = new URL(settings.apiEndpoint).origin;
      res.writeHead(200, {
        "Content-Type": file[1],
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'self'; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
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
    localDemo:
      process.env.LOCAL_DEMO === "true" &&
      host === "127.0.0.1" &&
      ["localhost", "127.0.0.1"].includes(api.hostname),
  };
  createApp(settings).listen(port, host, () =>
    console.log(`${settings.title}: http://${host}:${port}`),
  );
}
