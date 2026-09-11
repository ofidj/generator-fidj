const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repo = (file) => path.join(__dirname, "..", file);

// Travis published this package from `master` on Node 14 with a hardcoded
// maintainer email, and .travis.push.sh bumped the version and pushed a tag on
// its own. None of that matches how the package is released now — version
// branches, GitHub Actions, Node 22. Two CI definitions means the dead one
// eventually runs.
test("no Travis configuration survives beside GitHub Actions", () => {
  for (const leftover of [".travis.yml", ".travis.push.sh"])
    assert.ok(
      !fs.existsSync(repo(leftover)),
      `${leftover} is obsolete: GitHub Actions publishes this package`,
    );
  assert.ok(fs.existsSync(repo(".github/workflows/ci.yml")));
});

// The product README makes CI a release gate: "CI must run the same clean
// generation/build and integration checks. A custom downstream website is
// insufficient."
test("CI generates and builds a fixture app, not only unit tests", () => {
  const ci = fs.readFileSync(repo(".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /npm test/, "CI must run the generator's own tests");
  assert.match(
    ci,
    /create-fidj\.cjs|yo @ofidj\/fidj/,
    "CI must generate an app from a clean checkout",
  );
  assert.match(
    ci,
    /npm run build/,
    "CI must build what it generated, or generation is unverified",
  );
  assert.match(ci, /node-version: '22'/);
});
