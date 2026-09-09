const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");
test("generates a standalone typed client and server without private keys", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-generator-"));
  try {
    const output = scaffold(path.join(root, "test-app"), {
      appId: "fidj-example",
      apiEndpoint: "http://localhost:3201/v3",
    });
    assert.ok(fs.existsSync(path.join(output, "server/index.ts")));
    assert.ok(fs.existsSync(path.join(output, "src/main.ts")));
    assert.ok(fs.existsSync(path.join(output, ".gitignore")));
    assert.match(
      fs.readFileSync(path.join(output, ".env.example"), "utf8"),
      /FIDJ_APP_ID=fidj-example/,
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(output, "package.json"))).name,
      "test-app",
    );
    assert.throws(() => scaffold(output, { appId: "another" }), /empty/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("rejects injected app IDs and insecure remote endpoint configuration", () => {
  const output = path.join(os.tmpdir(), "unused-fidj");
  assert.throws(
    () => scaffold(output, { appId: "bad\nSECRET=value" }),
    /fidjId/,
  );
  assert.throws(
    () =>
      scaffold(output, { appId: "app", apiEndpoint: "http://example.org/v3" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      scaffold(output, {
        appId: "app",
        apiEndpoint: "https://user:pass@example.org/v3",
      }),
    /credentials/,
  );
});
