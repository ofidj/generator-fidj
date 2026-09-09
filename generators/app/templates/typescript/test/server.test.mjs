import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
const { createApp } = createRequire(import.meta.url)("../dist/server.cjs");
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    ),
  );
const close = (server) => new Promise((resolve) => server.close(resolve));
const token = (subject, appId = "test-app") =>
  `header.${Buffer.from(JSON.stringify({ sub: subject, name: subject + "@test.local", aud: appId, roles: ["Owner"] })).toString("base64url")}.signature`;

test("enforces live app roles, identity isolation and scoped privacy over HTTP", async () => {
  const maya = token("maya");
  const sam = token("sam");
  const assignments = new Map([
    [maya, ["Free"]],
    [sam, ["Editor"]],
  ]);
  const consents = new Map();
  let outage = false;
  const issuer = createServer(async (req, res) => {
    const bearer = req.headers.authorization?.slice(7);
    const roles = assignments.get(bearer);
    res.setHeader("Content-Type", "application/json");
    if (outage) {
      res.writeHead(503);
      return res.end("{}");
    }
    if (!roles) {
      res.writeHead(403);
      return res.end("{}");
    }
    if (req.url === "/apps/test-app/me")
      return res.end(
        JSON.stringify({ roles: roles.map((type) => ({ type })) }),
      );
    if (req.url === "/me/apps/test-app/consents/history")
      return res.end('{"history":[]}');
    if (req.url === "/me/apps/test-app/consents") {
      if (req.method === "PUT") {
        let text = "";
        for await (const chunk of req) text += chunk;
        consents.set(bearer, JSON.parse(text));
      }
      return res.end(JSON.stringify(consents.get(bearer) || { terms: true }));
    }
    if (req.url === "/me/apps/test-app/export")
      return res.end(JSON.stringify({ consent: consents.get(bearer) }));
    if (req.url === "/me/apps/test-app" && req.method === "DELETE") {
      assignments.delete(bearer);
      return res.end('{"status":"completed"}');
    }
    res.writeHead(404);
    res.end("{}");
  });
  const apiEndpoint = await listen(issuer);
  const app = createApp({
    appId: "test-app",
    apiEndpoint,
    dashboardUrl: "https://fidj.ovh",
    title: "Test app",
    localDemo: false,
  });
  const url = await listen(app);
  const call = (path, bearer = maya, method = "GET", data) =>
    fetch(url + "/api/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + bearer,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(url + "/api/notes")).status, 401);
    assert.equal(
      (await call("session", token("maya", "other-app"))).status,
      401,
    );
    assert.equal((await call("session", maya + "tampered")).status, 401);
    assert.equal(
      (await call("notes", maya, "POST", { title: "Hello", body: "Private" }))
        .status,
      403,
    );
    assignments.set(maya, ["Editor"]);
    assert.equal(
      (await call("notes", maya, "POST", { title: "Hello", body: "Private" }))
        .status,
      201,
    );
    assert.equal((await (await call("notes", sam)).json()).notes.length, 0);
    assert.equal((await (await call("notes")).json()).notes.length, 1);
    assignments.set(maya, ["Free"]);
    assert.equal(
      (await call("notes", maya, "POST", { title: "Denied", body: "" })).status,
      403,
    );
    assert.equal(
      (await call("privacy", maya, "PUT", { analytics: true })).status,
      200,
    );
    assert.equal(consents.get(maya).analytics, true);
    assert.equal(consents.has(sam), false);
    assert.equal(
      (await (await call("privacy/export")).json()).app.notes.length,
      1,
    );
    outage = true;
    assert.equal((await call("notes")).status, 503);
    outage = false;
    assert.equal(
      (await call("privacy/leave", maya, "DELETE", { confirm: "other-app" }))
        .status,
      400,
    );
    assert.equal(
      (await call("privacy/leave", maya, "DELETE", { confirm: "test-app" }))
        .status,
      200,
    );
    assert.equal((await call("notes")).status, 401);
    assignments.set(maya, ["Free"]);
    assert.equal((await (await call("notes")).json()).notes.length, 0);
    assert.equal((await call("session", sam)).status, 200);
  } finally {
    await close(app);
    await close(issuer);
  }
});
