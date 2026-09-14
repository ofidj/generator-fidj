const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shell = () =>
  fs.readFileSync(
    path.join(__dirname, "../generators/app/templates/typescript/src/content.ts"),
    "utf8",
  );

// The entry remembers the last address so it can say "Continue as <them>". Every
// sign-out the shell itself owns forgets it — on a shared computer, still being
// offered by name after signing out is the whole difference. A console that
// signs out through the SDK takes another path and forgot nothing, so Fidj's own
// entry kept offering somebody who had left. The SDK already records that this
// browser asked to be signed out; the entry has to read it.
test("a browser that asked to be signed out is no longer offered by name", () => {
  const source = shell();
  // Around where the entry is rendered, on both sides: dropping the address can
  // sit before or after the call, and either reads the same to a person.
  const at = source.indexOf("providerEntry(");
  const block = source.slice(Math.max(0, at - 900), at + 300);
  assert.match(
    block,
    /signedOutHere\(\)/,
    "the remembered address has to be dropped once this browser signed out",
  );
});

// "Continue as <them>" promises to carry on as that person. It handed them to
// the provider with an empty email field, so the promise cost a second typing of
// the address it had just shown. The screen already prefills from
// `fidj.interaction.email`; nothing was writing it from the remembered address.
test("taking the Fidj door carries the address it just showed", () => {
  const source = shell();
  const block = source.slice(
    source.indexOf("const throughFidj ="),
    source.indexOf("if (oidc && (!email || !password))"),
  );
  assert.match(
    block,
    /fidj\.interaction\.email/,
    "the address shown on the button has to reach the screen it hands over to",
  );
});
