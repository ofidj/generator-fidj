const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);

// Enter now submits through an unseen twin of Continue, placed ahead of the
// passkey door by @ofidj/entry. "Please wait…" belongs on the Continue a person
// can see, not on the twin nobody can (UI review, 3 Oct).
test("an Enter sign-in shows its wait on the visible Continue", () => {
  const handler = source.slice(source.indexOf('submitter.value === "passkey"'));
  assert.match(
    handler,
    /implicit-submit[\s\S]{0,300}value="credentials"/,
    "the busy marker stays on the unseen button",
  );
});
