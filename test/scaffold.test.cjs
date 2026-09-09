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

test("assembles an explicit application module and preserves its source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-module-"));
  const source = path.join(root, "console");
  const output = path.join(root, "generated");
  fs.mkdirSync(source);
  const html =
    '<html><head><base href="/module/"></head><body>Owner console</body></html>';
  fs.writeFileSync(path.join(source, "index.html"), html);
  try {
    scaffold(output, {
      appId: "fidj-test",
      anonymous: false,
      module: source,
      moduleEntry: "index.html#/my",
    });
    const config = JSON.parse(
      fs.readFileSync(path.join(output, "app.config.json")),
    );
    assert.equal(config.moduleEntry, "./module/index.html#/my");
    assert.equal(config.content, "");
    assert.equal(config.allowAnonymous, false);
    assert.match(
      fs.readFileSync(path.join(output, "public/module/index.html"), "utf8"),
      /name="fidj-signin" content="..\/index.html#\/signin"/,
    );
    assert.equal(
      fs.readFileSync(path.join(source, "index.html"), "utf8"),
      html,
    );
    for (const entry of [
      "../outside.html",
      "https://evil.example/index.html",
    ]) {
      assert.throws(
        () =>
          scaffold(output, {
            appId: "fidj-test",
            replace: true,
            module: source,
            moduleEntry: entry,
          }),
        /relative/,
      );
      assert.ok(fs.existsSync(path.join(output, "app.config.json")));
    }
    fs.writeFileSync(path.join(source, ".env"), "PRIVATE=not-public");
    assert.throws(
      () =>
        scaffold(output, { appId: "fidj-test", replace: true, module: source }),
      /public build output/,
    );
    assert.ok(fs.existsSync(path.join(output, "app.config.json")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("OIDC generation preserves content and rejects an unrelated issuer", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-oidc-cli-"));
  try {
    const output = scaffold(path.join(root, "app"), {appId: "fidj-example", apiEndpoint: "https://api.example/v3", oidcIssuer: "https://api.example/oidc", anonymous: false, content: "<h1>Original content</h1>"});
    const config = JSON.parse(fs.readFileSync(path.join(output, "app.config.json")));
    assert.equal(config.oidcIssuer, "https://api.example/oidc");
    assert.equal(config.content, "<h1>Original content</h1>");
    assert.equal(config.allowAnonymous, false);
    assert.throws(() => scaffold(path.join(root, "bad"), {appId: "fidj-example", apiEndpoint: "https://api.example/v3", oidcIssuer: "https://unrelated.example/oidc", content: ""}));
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
