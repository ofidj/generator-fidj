const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// The owner console prints a one-line command for a machine with nothing
// installed. It emits exactly these inputs; fidj-app's owner.page.spec.ts owns
// the other half of the contract (that the console emits nothing else). If an
// input here is renamed or dropped from the generator, the console's
// copy-paste command starts failing for every owner, silently.
const CONSOLE_OPTIONS = ["app-id", "api-endpoint", "anonymous"];

function acceptedOptions() {
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

test("the generator accepts every input the owner console emits", () => {
  const accepted = acceptedOptions();
  for (const name of CONSOLE_OPTIONS)
    assert.ok(
      accepted.has(name),
      `the owner console emits --${name}, which \`yo @ofidj/fidj\` rejects`,
    );
});

test("the console command runs through the published public entry", () => {
  // Whatever the console prints must be resolvable from a clean machine: the
  // registry knows @ofidj/generator-fidj, not the create-fidj binary name.
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.name, "@ofidj/generator-fidj");
  assert.ok(
    fs.existsSync(path.join(__dirname, "..", "generators/app/index.js")),
    "`yo @ofidj/fidj` resolves to generators/app",
  );
  assert.ok(
    pkg.files.includes("generators"),
    "generators/ must ship, or `yo @ofidj/fidj` cannot resolve after install",
  );
});

test("every option documented in the README is accepted", () => {
  const accepted = acceptedOptions();
  // Only what follows the public entry: flags before it belong to npx.
  const documented = new Set(
    [...read("README.md").matchAll(/\byo @ofidj\/fidj\b(.*)$/gm)].flatMap(
      (match) => [...match[1].matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]),
    ),
  );
  assert.ok(documented.size > 3, "failed to parse the documented commands");
  const unknown = [...documented].filter((name) => !accepted.has(name)).sort();
  assert.deepEqual(
    unknown,
    [],
    "documented but rejected by the generator: " + unknown.join(", "),
  );
});
