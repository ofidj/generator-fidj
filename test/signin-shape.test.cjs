const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");

// How an app asks is the owner's decision, and there are three honest answers.
//
// The Fidj button alone is the one that keeps the promise the entry makes —
// this app never sees a password — so it is the default, and an owner has to
// say otherwise on purpose. The inline form alone is for an owner who wants
// their own page to hold the credential and has decided that trade. Both is
// mleweb: the button leads, and the form is one click under it.
//
// It is one input with three values rather than a boolean, because "no button"
// and "no form" are different apps and a flag named after one of them cannot
// say the other.
const generate = (options) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-signin-"));
  const output = scaffold(path.join(root, "test-app"), {
    appId: "fidj-example",
    apiEndpoint: "http://localhost:3201/v3",
    oidcIssuer: "http://localhost:3201/oidc",
    ...options,
  });
  const config = JSON.parse(
    fs.readFileSync(path.join(output, "app.config.json"), "utf8"),
  );
  return { root, config };
};

const withApp = (options, check) => {
  const { root, config } = generate(options);
  try {
    check(config);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test("the Fidj button alone is what an app gets without asking", () => {
  withApp({}, (config) => assert.equal(config.signin, "button"));
});

test("an owner chooses the shape by name", () => {
  for (const shape of ["button", "inline", "both"]) {
    withApp({ signin: shape }, (config) => assert.equal(config.signin, shape));
  }
});

test("a shape it does not have is refused rather than guessed at", () => {
  assert.throws(
    () => generate({ signin: "form" }),
    /--signin must be button, inline or both/,
  );
});

// `--credentials true|false` said the same thing about a product that only had
// two shapes. It keeps working, because apps in the wild pass it, and it means
// what it always meant.
test("the boolean it replaces still says what it used to say", () => {
  withApp({ credentials: "true" }, (config) =>
    assert.equal(config.signin, "both"),
  );
  withApp({ credentials: false }, (config) =>
    assert.equal(config.signin, "button"),
  );
  // Named together, the one that can say all three wins.
  withApp({ credentials: "true", signin: "inline" }, (config) =>
    assert.equal(config.signin, "inline"),
  );
});

// "the entry renders the shape it was given" moved to @ofidj/entry, which owns
// providerEntry now. What stays here is the scaffolding question: that the
// chosen shape reaches the generated app's configuration at all.
