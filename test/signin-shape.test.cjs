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

// What the three shapes actually put on the screen. The entry is a pure
// function of the shape and the app's own fields, so it can be asked directly
// rather than inferred from the source that produces it.
//
// It is TypeScript, and this reads it by stripping the types — on by default
// from Node 22.18, which the validation matrix is above. An older runtime skips
// rather than reporting a pass it did not earn.
const stripsTypes = (() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 18);
})();

test("the entry renders the shape it was given", {skip: stripsTypes ? false : "this runtime does not strip types"}, async () => {
  const entry = await import(
    "../generators/app/templates/typescript/src/service-agreement.ts"
  );
  const render = (shape) =>
    entry.providerEntry("Test App", "fidj-example", "THE-APP-FIELDS", false, shape);
  const hasDoor = (markup) => /name="entry" value="fidj"/.test(markup);
  const hasFields = (markup) => markup.includes("THE-APP-FIELDS");
  const hasDisclosure = (markup) => markup.includes('id="use-email"');

  // The Fidj door and nothing else: no form, so nothing to fold it under.
  const button = render("button");
  assert.ok(hasDoor(button), "the button shape must offer the Fidj door");
  assert.ok(!hasFields(button), "the button shape must not collect a password");
  assert.ok(!hasDisclosure(button), "nothing to disclose");

  // The app's own form and nothing else — and it says whose page holds the
  // password, because on this path it is not only Fidj's.
  const inline = render("inline");
  assert.ok(!hasDoor(inline), "the inline shape offers no Fidj door");
  assert.ok(hasFields(inline), "the inline shape must collect the credential");
  assert.ok(!hasDisclosure(inline), "nothing to disclose");
  assert.match(inline, /handles your password itself/);

  // Both: the door leads, the form is one click under it.
  const both = render("both");
  assert.ok(hasDoor(both), "both shapes must offer the Fidj door");
  assert.ok(hasFields(both), "both shapes must offer the app's form");
  assert.ok(hasDisclosure(both), "the form is folded away under the door");
  assert.ok(
    both.indexOf('name="entry" value="fidj"') < both.indexOf("THE-APP-FIELDS"),
    "the Fidj door leads",
  );
});
