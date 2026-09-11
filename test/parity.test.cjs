const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Two doors, one scaffolder. An input added to bin/create-fidj.cjs and not to
// the Yeoman generator vanishes for everyone who runs `yo` — which is how
// --highlight, --badge, --logo and --favicon came to exist on one side only.
const read = (file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function cliOptions() {
  const source = read("bin/create-fidj.cjs");
  const block = source.slice(
    source.indexOf("options: {"),
    source.indexOf("});", source.indexOf("options: {")),
  );
  return new Set(
    [...block.matchAll(/^\s+"?([a-z][a-z-]*)"?:\s*\{\s*type:/gm)]
      .map((match) => match[1])
      .filter((name) => name !== "help"),
  );
}

function yeomanOptions() {
  const source = read("generators/app/index.js");
  const names = new Set();
  for (const listName of ["TEXT_OPTIONS", "LIST_OPTIONS", "FLAG_OPTIONS"]) {
    const start = source.indexOf(`const ${listName} = [`);
    assert.ok(start >= 0, `${listName} is missing from the Yeoman generator`);
    const block = source.slice(start, source.indexOf("];", start));
    for (const [, name] of block.matchAll(/"([a-z][a-z-]*)"/g)) names.add(name);
  }
  return names;
}

test("both entry points accept the same inputs", () => {
  const cli = cliOptions();
  const yeoman = yeomanOptions();
  assert.ok(cli.size > 10, "failed to parse the CLI options");
  const missingFromYeoman = [...cli].filter((name) => !yeoman.has(name)).sort();
  const missingFromCli = [...yeoman].filter((name) => !cli.has(name)).sort();
  assert.deepEqual(
    missingFromYeoman,
    [],
    "these inputs exist on create-fidj but not on `yo`: " +
      missingFromYeoman.join(", "),
  );
  assert.deepEqual(
    missingFromCli,
    [],
    "these inputs exist on `yo` but not on create-fidj: " +
      missingFromCli.join(", "),
  );
});

test("the Yeoman generator forwards every input to the scaffolder", () => {
  const source = read("generators/app/index.js");
  const call = source.slice(
    source.indexOf("scaffold(this.destinationPath(name), {"),
    source.indexOf("});", source.indexOf("scaffold(this.destinationPath")),
  );
  for (const field of [
    "highlights",
    "badges",
    "logo",
    "favicon",
    "oidcIssuer",
    "local",
    "replace",
    "moduleEntry",
    "sdkPath",
    "apiEndpoint",
  ])
    assert.match(
      call,
      new RegExp("\\b" + field + ":"),
      `${field} is never passed to scaffold()`,
    );
});

test("a repeated Yeoman option keeps commas inside its values", () => {
  const { repeatedOption } = require("../generators/app/index.js");
  const argv = [
    "node",
    "yo",
    "@ofidj/fidj",
    "my-app",
    "--highlight",
    "15 minutes|An install, a fidjId, a few lines.",
    "--highlight",
    "Consent, scoped per app|Independent purposes, and a history.",
    "--badge=EU-hosted",
  ];
  // Yeoman would hand us "a,b" for these; argv is what was actually typed.
  assert.deepEqual(repeatedOption("highlight", "joined,by,yeoman", argv), [
    "15 minutes|An install, a fidjId, a few lines.",
    "Consent, scoped per app|Independent purposes, and a history.",
  ]);
  assert.deepEqual(repeatedOption("badge", undefined, argv), ["EU-hosted"]);
  assert.equal(repeatedOption("logo", undefined, argv), undefined);
  // Composed programmatically: no argv to read, so trust what we were given.
  assert.deepEqual(repeatedOption("badge", "one", ["node", "script"]), ["one"]);
});
