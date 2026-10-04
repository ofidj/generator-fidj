const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);
const boot = source.slice(source.indexOf("\nfunction boot()"));

// A private app route waits while the shell asks whether Fidj already knows
// this browser, so that the app's router cannot abort that navigation. The wait
// must end whatever happens: when the API is unreachable, the SDK refuses or the
// callback fails, a mounted app that handles the failure itself is better than
// "Loading your session…" with no way out.
test("a failed recognition ends the private-route wait", () => {
  assert.match(
    boot,
    /catch \(error\) \{\s*recognising = false;\s*throw error;\s*\}/,
    "boot() must clear `recognising` when the session step throws",
  );
});

// Once the SDK has answered, the private route has nothing more to wait for:
// the app mounts in parallel with the shell's own refresh, as it did before.
test("the app mounts as soon as recognition ends, before the shell's refresh", () => {
  const mounted = boot.indexOf("if (!recognising && moduleRoute()) render();");
  const refreshed = boot.indexOf("await refresh();");
  assert.ok(mounted > 0, "boot() must render when recognition ends");
  assert.ok(mounted < refreshed, "the app waits for the shell's refresh");
});
