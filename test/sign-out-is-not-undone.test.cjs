const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");

// Taking the Fidj door is one press, and that is exactly how a sign-out was
// undone: the provider still recognised the browser and answered with a code,
// no screen at all, and the person was back inside the console they had just
// left. Ending the provider session is what should make that impossible — and
// that call can be refused — so the door has to be able to ask, rather than
// assume it was forgotten.
//
// The screen on Fidj itself used to fetch the provider on load, without waiting
// for a press, and this rule lived there. It now lives where every app's door
// goes through: the one place that turns a press into an authorization request.
test("does not hand a signed-out person straight back to the session they left", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-signout-"));
  try {
    const output = scaffold(path.join(root, "test-app"), {
      appId: "fidj-example",
      apiEndpoint: "http://localhost:3201/v3",
      oidcIssuer: "http://localhost:3201/oidc",
    });
    const content = fs.readFileSync(path.join(output, "src/content.ts"), "utf8");
    const door = content.slice(
      content.indexOf("function signInThroughProvider"),
      content.indexOf("function navigate"),
    );
    assert.ok(door.includes("beginLogin("), "failed to find the Fidj door");
    assert.match(
      door,
      /signedOutHere\(\)[\s\S]{0,120}prompt: "login"/,
      "the door must ask again when this browser just signed out",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
