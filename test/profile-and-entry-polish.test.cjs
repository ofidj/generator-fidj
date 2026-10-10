const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const templates = path.join(
  __dirname,
  "../generators/app/templates/typescript/src",
);
const content = fs.readFileSync(path.join(templates, "content.ts"), "utf8");
const notes = fs.readFileSync(path.join(templates, "main.ts"), "utf8");

// The lead already says the account is a Fidj account; three more lines under
// the form saying it again pushed the form down on every screen.
test("the sign-in does not restate the lead under the form", () => {
  assert.doesNotMatch(content, /Your account, with Fidj/);
  assert.doesNotMatch(content, /class="signin-trust"/);
});

test("the phone form carries the app mark before asking for a password", () => {
  assert.match(content, /signin-mobile-masthead/);
});

// The member card is framed by its own rows; a second card around it drew a
// border inside a border.
test("the profile body is not a second card", () => {
  assert.doesNotMatch(content, /class="card profile-body"/);
});

// History is a button beside Export, and both starters wire it.
test("both starters wire the member card's History button", () => {
  for (const [name, source] of [
    ["content.ts", content],
    ["main.ts", notes],
  ]) {
    assert.match(source, /bindMemberHistory\(/, name);
  }
});

// A new tab on #/profile, restored silently, must land on #/profile — not on
// the app's home. The silent question leaves the document, so the route has to
// be remembered before it and read back after.
test("the route asked for survives signing in", () => {
  const ask = content.slice(
    content.indexOf("async function askWhetherFidjKnowsThisBrowser"),
    content.indexOf("function signInThroughProvider"),
  );
  assert.match(
    ask,
    /rememberRoute\(\)[\s\S]{0,80}beginLogin\(\{ silent: true \}\)/,
  );
  assert.doesNotMatch(
    content,
    /replaceState\(null, "", window\.location\.pathname \+ "#\/content"\)/,
  );
  const door = content.slice(
    content.indexOf("function signInThroughProvider"),
    content.indexOf("function navigate"),
  );
  assert.match(door, /navigate\(takeReturnRoute\(\)\)/);
  assert.doesNotMatch(door, /navigate\("content"\)/);
});

// One compact head on Fidj and in every generated app: Profile, then the
// address beside the app's own badge, and Sign out in red at the card's top
// right — no line repeating the app's name.
test('the profile opens on a compact card that holds Sign out', () => {
  const summary = content.slice(content.indexOf('function profileSummary'), content.indexOf('function renderNav'));
  assert.match(summary, /<div class="profile-identity"><strong>\$\{escape\(accountEmail\)\}<\/strong><a class="profile-public"/);
  assert.match(summary, /<\/div><button id="exit" class="sign-out">Sign out<\/button><\/header>/);
  assert.doesNotMatch(summary, /<span>\$\{escape\(config\.title\)\}<\/span>/);
});

// The lit tab already says Profile: the card keeps the page's h1 for a screen
// reader, out of sight, instead of a third "PROFILE" above the address.
test('the profile card does not repeat the Profile tab', () => {
  const summary = content.slice(content.indexOf('function profileSummary'), content.indexOf('function renderNav'));
  assert.match(summary, /<h1 class="echoes-tab">Profile<\/h1>/);
  assert.doesNotMatch(summary, /class="eyebrow">Profile/);
});

// The badge carries the app's name, Fidj's mark and the letter: shown at its
// own size, wider and taller than the old activity badge.
test('the profile shows the badge at its full size', () => {
  assert.match(content, /public badge" width="190" height="28"/);
});
