const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);

test("Fidj completes credential sign-in through the provider's first-party origin", () => {
  assert.match(source, /request\("\/me\/oidc\/session-transfer", "POST"\)/);
  assert.match(source, /window\.location\.assign\(transfer\.location\)/);
  assert.doesNotMatch(source, /relativePath: "oidc\/session",/);
});
