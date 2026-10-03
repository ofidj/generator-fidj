const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The agreement's address comes from the API, which names the language it
// showed, through @ofidj/entry's agreementAddress. A template that rebuilds the
// address itself links to a text in whatever language the browser happens to
// prefer, not to the one the person read and accepted.
const sources = ["content.ts", "main.ts"].map((name) =>
  path.join(__dirname, "../generators/app/templates/typescript/src", name),
);

for (const source of sources) {
  test(`${path.basename(source)} links agreements through agreementAddress`, () => {
    const text = fs.readFileSync(source, "utf8");
    assert.doesNotMatch(text, /\/agreements\//);
    assert.match(text, /agreementAddress\(/);
  });
}
