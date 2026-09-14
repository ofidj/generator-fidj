const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);

// Opening the console at its own address took several seconds of "Loading your
// session…" before anything was drawn. The shell was asking the API who the
// person was — a token refresh and three more round trips — and only then
// injecting the app's scripts, so a quarter of a megabyte of Angular started
// downloading after the network had already been busy for half a second. The
// two have nothing to say to each other: whether an address needs a session is
// the mounted app's business, and it revalidates for itself. They belong in
// parallel.
test("the mounted app starts without waiting for the shell's session", () => {
  const render = source.slice(source.indexOf("\nfunction render()"));
  const handover = render.indexOf("startModule();");
  // The gate itself, not the prose about it: the comment explaining this order
  // names the same screen.
  const sessionGate = render.indexOf("if (!initialized)");
  assert.ok(handover > 0, "failed to find the handover in render()");
  assert.ok(sessionGate > 0, "failed to find the session gate in render()");
  assert.ok(
    handover < sessionGate,
    "the shell waits for its own session before starting the app it is only hosting",
  );
});
