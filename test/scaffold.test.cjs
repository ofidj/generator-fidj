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
    assert.match(
      fs.readFileSync(path.join(output, "server/index.ts"), "utf8"),
      /img-src 'self' https: \$\{apiOrigin\}/,
    );
    assert.ok(fs.existsSync(path.join(output, "src/main.ts")));
    const main = fs.readFileSync(path.join(output, "src/main.ts"), "utf8");
    assert.doesNotMatch(main, /\bconfirm\s*\(/);
    assert.match(main, /role="alertdialog"/);
    assert.match(main, /Keep my membership/);
    const config = JSON.parse(
      fs.readFileSync(path.join(output, "app.config.json"), "utf8"),
    );
    assert.match(config.releaseVersion, /^\d+\.\d+\.\d+$/);
    assert.match(fs.readFileSync(path.join(output, ".env.example"), "utf8"), /APP_VERSION=\d+\.\d+\.\d+/);
    assert.match(main, /showVersionBadge/);
    // The entry — sign-in and account screens, the agreement, the design system
    // — arrives as @ofidj/entry rather than as files copied into this app's
    // own source, so what is asserted is the dependency and its absence from src.
    const generated = JSON.parse(
      fs.readFileSync(path.join(output, "package.json"), "utf8"),
    );
    assert.ok(
      generated.dependencies["@ofidj/entry"],
      "the generated app depends on @ofidj/entry",
    );
    for (const copied of [
      "src/version.ts",
      "src/service-agreement.ts",
      "src/provider-window.ts",
      "src/style.css",
      "src/tokens.css",
    ])
      assert.ok(
        !fs.existsSync(path.join(output, copied)),
        `${copied} belongs to @ofidj/entry, not to the generated app`,
      );
    assert.match(main, /@ofidj\/entry/);
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
    '<html><head><base href="/"><link rel="stylesheet" href="styles.css"></head><body><app-root>Owner console</app-root><script src="main.js" type="module"></script></body></html>';
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
    // An address inside the shell, not a second document: no "module" in the
    // address bar, and no page reload in the middle of signing in.
    assert.equal(config.moduleEntry, "#/my");
    assert.equal(config.moduleVersion, "");
    assert.deepEqual(config.moduleMount.styles, ["module/styles.css"]);
    assert.deepEqual(config.moduleMount.scripts, [
      { src: "module/main.js", module: true },
    ]);
    assert.match(config.moduleMount.markup, /<app-root>/);
    assert.equal(config.content, "");
    assert.equal(config.allowAnonymous, false);
    // What is left at the old address forwards the person, hash and all.
    const stub = fs.readFileSync(
      path.join(output, "public/module/index.html"),
      "utf8",
    );
    assert.match(stub, /<script src="moved\.js">/);
    assert.match(stub, /noindex/);
    // Inline scripts are refused by the generated CSP, so the forward is a file.
    assert.doesNotMatch(stub, /<script>/);
    assert.match(
      fs.readFileSync(path.join(output, "public/module/moved.js"), "utf8"),
      /location\.replace\(to\)/,
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
// An app with its own backend is the realistic third-party case: it keeps its
// own data and verifies sessions itself. It needs the provider entry as much as
// a content app, and its server has to learn the issuer to serve it.
// A local build points at the loopback API, so it must point at that API's own
// provider too: the client refuses an issuer on another origin, and a build that
// silently keeps the hosted issuer sends local sign-ins to production.
test("a local build uses the local provider, not the hosted one", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-oidc-local-"));
  try {
    const output = scaffold(path.join(root, "app"), {
      appId: "fidj-example",
      apiEndpoint: "http://fidj.localhost:3201/v3",
      oidcIssuer: "http://fidj.localhost:3201/oidc",
      local: true,
    });
    const config = JSON.parse(fs.readFileSync(path.join(output, "app.config.json")));
    assert.equal(config.apiEndpoint, "http://localhost:3201/v3");
    assert.equal(config.oidcIssuer, "http://localhost:3201/oidc");
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test("a local stack may keep its UI and API on one named localhost", () => {
  const previousApi = process.env.FIDJ_LOCAL_API_ENDPOINT;
  const previousDashboard = process.env.FIDJ_LOCAL_DASHBOARD_URL;
  process.env.FIDJ_LOCAL_API_ENDPOINT = "http://fidj.localhost:3201/v3";
  process.env.FIDJ_LOCAL_DASHBOARD_URL = "http://fidj.localhost:4200";
  try {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-named-local-"));
    const output = scaffold(path.join(root, "app"), {
      appId: "fidj-example",
      apiEndpoint: "https://api.example/v3",
      oidcIssuer: "https://api.example/oidc",
      local: true,
    });
    const config = JSON.parse(fs.readFileSync(path.join(output, "app.config.json")));
    assert.equal(config.apiEndpoint, "http://fidj.localhost:3201/v3");
    assert.equal(config.oidcIssuer, "http://fidj.localhost:3201/oidc");
    assert.equal(config.dashboardUrl, "http://fidj.localhost:4200");
  } finally {
    if (previousApi === undefined) delete process.env.FIDJ_LOCAL_API_ENDPOINT;
    else process.env.FIDJ_LOCAL_API_ENDPOINT = previousApi;
    if (previousDashboard === undefined) delete process.env.FIDJ_LOCAL_DASHBOARD_URL;
    else process.env.FIDJ_LOCAL_DASHBOARD_URL = previousDashboard;
  }
});
test("an app with its own backend can sign in through the provider", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-oidc-app-"));
  try {
    const output = scaffold(path.join(root, "app"), {
      appId: "fidj-example",
      apiEndpoint: "https://api.example/v3",
      oidcIssuer: "https://api.example/oidc",
    });
    const config = JSON.parse(fs.readFileSync(path.join(output, "app.config.json")));
    assert.equal(config.oidcIssuer, "https://api.example/oidc");
    assert.match(
      fs.readFileSync(path.join(output, ".env.example"), "utf8"),
      /^FIDJ_OIDC_ISSUER=https:\/\/api\.example\/oidc$/m,
      "the app server serves the issuer to its own page; without it the entry cannot redirect"
    );
  } finally {fs.rmSync(root, {recursive: true, force: true});}
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

// A module with its own patch (Fidj's console) says which one it is, so the
// badge can name it between the SDK and the API.
test("carries the mounted module's version and label to the badge", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-module-version-"));
  const source = path.join(root, "www");
  const output = path.join(root, "out");
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, "index.html"),
    '<html><head><base href="/"></head><body><app-root></app-root><script src="main.js" type="module"></script></body></html>',
  );
  try {
    scaffold(output, {
      appId: "fidj-test",
      module: source,
      moduleEntry: "index.html#/my",
      moduleVersion: "3.15.3",
      moduleLabel: "console",
    });
    const config = JSON.parse(fs.readFileSync(path.join(output, "app.config.json")));
    assert.equal(config.moduleVersion, "3.15.3");
    assert.equal(config.moduleLabel, "console");
    const shell = fs.readFileSync(
      path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
      "utf8",
    );
    assert.match(shell, /showVersionBadge\([^)]*config\.moduleVersion/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
