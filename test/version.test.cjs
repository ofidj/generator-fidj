const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");

const templatePackage = require("../generators/app/templates/typescript/package.json");

// A generated app used to show the day it was generated, which told nobody
// which Fidj it was running. It shows the SDK it carries instead, so the badge
// and `/v3/status` can be compared without translation.
const generate = (options) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-version-"));
  const output = scaffold(path.join(root, "test-app"), {
    appId: "fidj-example",
    apiEndpoint: "http://localhost:3201/v3",
    ...options,
  });
  return {
    root,
    config: JSON.parse(fs.readFileSync(path.join(output, "app.config.json"), "utf8")),
    settings: fs.readFileSync(path.join(output, ".env.example"), "utf8"),
  };
};

const fakeSdk = (version) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-sdk-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "@ofidj/node", version }),
  );
  return dir;
};

test("stamps the version of the SDK the app was built against", () => {
  const sdkPath = fakeSdk("9.9.9");
  const { root, config, settings } = generate({ sdkPath });
  try {
    assert.equal(config.releaseVersion, "9.9.9");
    assert.match(settings, /APP_VERSION=9\.9\.9/);
    assert.doesNotMatch(settings, /APP_VERSION=\d{2}\.\d{2}\.\d{2}\b/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(sdkPath, { recursive: true, force: true });
  }
});

test("without a local SDK, claims the version the generated app will install", () => {
  const { root, config } = generate({});
  try {
    assert.equal(
      config.releaseVersion,
      templatePackage.dependencies["@ofidj/node"].replace(/^[\^~]/, ""),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// "the badge names Fidj and accepts a semantic version" moved to @ofidj/entry,
// which owns showVersionBadge — and asks the function rather than reading its
// guard back out of the source with a regex, which is all this could do.
test("the generated app installs the SDK this generator was released with", () => {
  const generator = require("../package.json").version;
  const range = templatePackage.dependencies["@ofidj/node"];
  assert.equal(
    range.replace(/^[\^~]/, "").split(".").slice(0, 2).join("."),
    generator.split(".").slice(0, 2).join("."),
    `template asks for ${range} while the generator is ${generator}`,
  );
});
