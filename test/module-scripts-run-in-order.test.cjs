const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The shell hands the document to the mounted app by injecting its scripts. A
// <script> created in JavaScript carries async = true by default, so the four it
// injects execute in whatever order the network returns them — and when main.js
// wins the race against polyfills.js, Angular boots without Zone.js, throws
// NG0908 and paints nothing. The person gets a blank page, intermittently, with
// no error on screen. Clearing async restores insertion order.
test("the injected module scripts run in the order they were inserted", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
    "utf8",
  );
  const block = source.slice(
    source.indexOf("for (const script of mount.scripts)"),
    source.indexOf("}", source.indexOf("document.body.appendChild(element)")),
  );
  assert.ok(block.includes("createElement(\"script\")"), "failed to find the injection");
  assert.match(
    block,
    /element\.async\s*=\s*false/,
    "a dynamically created script defaults to async, which lets main.js run before polyfills.js",
  );
});
