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

test("public CLI accepts content inputs and only replaces marked generated output", () => {
  const { spawnSync } = require("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-cli-"));
  const output = path.join(root, "cloud-app");
  const cli = path.resolve(__dirname, "../bin/create-fidj.cjs");
  const args = [
    cli,
    output,
    "--app-id",
    "fidj-cloud",
    "--title",
    "Mat Cloud App",
    "--welcome",
    "Welcome in my Cloud",
    "--content",
    "<img src=https://example.org/mario.gif><a href='https://example.org/about'>About me</a>",
    "--domain",
    "mlefree.com",
  ];
  try {
    let result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(
      fs.readFileSync(path.join(output, "app.config.json")),
    );
    assert.equal(config.title, "Mat Cloud App");
    assert.equal(config.welcome, "Welcome in my Cloud");
    assert.match(config.content, /mario.gif/);
    assert.equal(config.domain, "mlefree.com");
    result = spawnSync(process.execPath, [...args, "--replace"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    fs.unlinkSync(path.join(output, ".fidj-generated"));
    result = spawnSync(process.execPath, [...args, "--replace"], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /marker/);
    assert.ok(fs.existsSync(path.join(output, "app.config.json")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("anonymous entry is configurable through the public CLI", () => {
  const { spawnSync } = require("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-anonymous-"));
  const cli = path.resolve(__dirname, "../bin/create-fidj.cjs");
  try {
    for (const value of ["true", "false", "invalid"]) {
      const output = path.join(root, "app-" + value);
      const result = spawnSync(
        process.execPath,
        [cli, output, "--app-id", "fidj-test", "--anonymous", value],
        { encoding: "utf8" },
      );
      if (value === "invalid") {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /must be true or false/);
        assert.ok(!fs.existsSync(output));
      } else {
        assert.equal(result.status, 0, result.stderr);
        const config = JSON.parse(
          fs.readFileSync(path.join(output, "app.config.json")),
        );
        assert.equal(config.allowAnonymous, value === "true");
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
