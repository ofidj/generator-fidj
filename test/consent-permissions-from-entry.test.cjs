const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);

// Fidj's consent screen and the API's own page list what an app will receive.
// Both read the sentences from @ofidj/entry: a permission added there — the
// deletion of the account first — reaches every consent screen at once.
test("the consent screen reads permission meanings from @ofidj/entry", () => {
  assert.match(source, /permissionLines[^;]*from "@ofidj\/entry"/s);
  assert.doesNotMatch(source, /"fidj:api":\s*"/);
});
