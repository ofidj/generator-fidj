const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");

// Which Fidj an app points at is decided by which API it talks to, not by a
// constant. Every app built against the sandbox API linked "Open Fidj" to
// fidj.ovh — a different deployment, with a different database, where the
// person's apps are not. And the sandbox console did not recognise itself as
// Fidj at all, because recognising itself is comparing its own origin against
// this value: it introduced Fidj to somebody standing on Fidj.
const dashboardFor = (apiEndpoint) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-dash-"));
  try {
    const output = scaffold(path.join(root, "test-app"), {
      appId: "fidj-example",
      apiEndpoint,
    });
    return JSON.parse(
      fs.readFileSync(path.join(output, "app.config.json"), "utf8"),
    ).dashboardUrl;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test("the console an app points at is the one its API belongs to", () => {
  assert.equal(dashboardFor("https://api.fidj.ovh/v3"), "https://fidj.ovh");
  assert.equal(
    dashboardFor("https://api.sandbox.fidj.ovh/v3"),
    "https://sandbox.fidj.ovh",
  );
});

// An API that is not named after its console says nothing about where one is,
// so the default stands rather than a guess being invented.
test("an API host that names no console falls back to Fidj's own", () => {
  assert.equal(dashboardFor("https://example.test/v3"), "https://fidj.ovh");
});
