const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
  "utf8",
);

// Production, 3 Oct: the entry showed (a refused request), then the address
// moved to the console's own route. The body kept `signin-view`, whose rule
// drops the page margins, and the whole console sat flush against the left
// edge until a reload. Handing the document to the mounted app must end the
// entry's look along with the entry.
test("starting the mounted app ends the entry's body class", () => {
  const start = source.slice(source.indexOf("\nfunction startModule()"));
  const body = start.slice(0, start.indexOf("\n}\n"));
  assert.match(
    body,
    /document\.body\.classList\.remove\("signin-view"\)/,
    "startModule() leaves the sign-in screen's class on the body",
  );
});
