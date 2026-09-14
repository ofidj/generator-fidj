const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scaffold } = require("../lib/scaffold.cjs");

// On Fidj itself the sign-in screen fetches the provider straight away, so that
// what a person sees is the credential form or their own name. That shortcut is
// also how a sign-out was undone by a page reload: the provider still recognised
// the browser and answered with a code, no screen at all, and the person was
// back inside the console they had just left. Ending the provider session is
// what should make that impossible — and that call can be refused — so the
// screen has to be able to ask, rather than assume it was forgotten.
test("does not hand a signed-out person straight back to the session they left", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fidj-signout-"));
  try {
    const output = scaffold(path.join(root, "test-app"), {
      appId: "fidj-example",
      apiEndpoint: "http://localhost:3201/v3",
      oidcIssuer: "http://localhost:3201/oidc",
    });
    const content = fs.readFileSync(path.join(output, "src/content.ts"), "utf8");
    const automatic = content.slice(
      content.indexOf("askedProvider = true"),
      content.indexOf("forget-hint"),
    );
    assert.ok(automatic.includes("beginLogin("), "failed to find the automatic sign-in");
    assert.match(
      automatic,
      /signedOutHere\(\)[^\n]*prompt: "login"/,
      "the automatic sign-in must ask again when this browser just signed out",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
