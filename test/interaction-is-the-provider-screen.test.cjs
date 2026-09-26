const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const content = () =>
  fs.readFileSync(
    path.join(__dirname, "..", "generators/app/templates/typescript/src/content.ts"),
    "utf8",
  );
const interactionScreen = () => {
  const source = content();
  const start = source.indexOf("function interactionScreen()");
  return source.slice(start, source.indexOf("\nfunction ", start + 1));
};

// An app opens Fidj in a small window, and the provider hands that window to
// Fidj's front end. It drew the whole sign-in page there — masthead, the
// numbered promises, the "What Fidj is" panel — so the question the window was
// opened for sat below the fold. The provider's own page is one compact card,
// and the front end now draws exactly that card.
test("the provider's window draws the provider's own screen", () => {
  const block = interactionScreen();
  assert.match(block, /oidcInteractionMarkup\(/);
  assert.match(block, /oidcInteractionStyles/);
  assert.match(block, /bindOidcInteraction\(/);
  assert.doesNotMatch(block, /highlightCells|signin-trust|signin-intro|badgeStrip/);
});

// The agreement is read in the browser like any other document, never folded
// inside the window nor opened in a window of its own.
test("the agreement is a link to the browser, never nested", () => {
  const source = content();
  assert.doesNotMatch(source, /<details class="agreement"/);
  assert.doesNotMatch(source, /fidj-agreement/);
});

// Fidj's GDPR page, the generated apps and their starter server say the same
// word for the same action: "Export" for a copy, "Leave & erase" for leaving.
test("a copy is an Export and leaving is Leave & erase, everywhere", () => {
  // Both screens draw the entry's member card, which says Export and
  // Leave & erase; neither keeps a wording of its own.
  for (const file of ["content.ts", "main.ts"]) {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "generators/app/templates/typescript/src", file),
      "utf8",
    );
    assert.doesNotMatch(source, /Export my (app )?data/, file);
    assert.doesNotMatch(source, /Leave and erase my app data|Confirm leaving/, file);
    assert.match(source, /memberCard\(/, file);
  }
});

// A generated app writes dates the way Fidj does. It printed consent history
// as raw ISO strings ("2026-09-24T12:56:46.616Z") and notes in the browser's
// locale.
test("dates are written by the entry's formatDate", () => {
  for (const file of ["content.ts", "main.ts"]) {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "generators/app/templates/typescript/src", file),
      "utf8",
    );
    assert.doesNotMatch(source, /toLocale(Date|Time)?String\(/, file);
    assert.doesNotMatch(source, /escape\(entry\.changedAt\)/, file);
    assert.match(source, /formatDate\(|memberCard\(/, file);
  }
});

// A generated app's own privacy screen reads like Fidj's GDPR card: the
// agreement with its ground, each choice as a switch that says On or Off, then
// History, Export and Leave & erase. The developer's view is gone: "Refresh
// access", "Roles: …", the static-template fineprint, a hard-coded agreement
// version.
test("the app's privacy screen is the GDPR card, not a developer page", () => {
  const source = content();
  const start = source.indexOf("function privacyBlock()");
  const block = source.slice(start, source.indexOf("\n}\n", start));
  assert.match(block, /memberCard\(/);
  assert.doesNotMatch(block, /Refresh access|Roles:|static template|These choices apply only/);
  assert.doesNotMatch(source, /cguVersion: "starter-demo-1"/);
  // The starter draws the same card, not its own "Your choices in this app".
  const main = fs.readFileSync(
    path.join(__dirname, "..", "generators/app/templates/typescript/src/main.ts"),
    "utf8",
  );
  assert.doesNotMatch(main, /Your choices in this app|Accept demo agreement|Consent history/);
});

// A verified address is one line on the account screen; the verification
// controls ("Refresh verification status") only appear while there is still
// something to verify.
test("a verified account shows one Email line, not verification controls", () => {
  const source = content();
  assert.match(source, /emailVerified\s*\?\s*accountRows\(\)\s*:\s*accountForm\("account"/);
  const start = source.indexOf("function accountRows()");
  const block = source.slice(start, source.indexOf("\n}\n", start));
  assert.match(block, /· verified/);
  assert.match(block, /#\/my\/profile/);
});

// A new tab on an app this browser signed in to (and did not sign out of)
// asks Fidj silently instead of drawing "Continue as …": the app's session is
// per tab, and the one-click screen read as being signed out.
test("an app this browser signed in to re-enters silently in a new tab", () => {
  const source = content();
  for (const name of ["function mightBeRecognised()", "async function askWhetherFidjKnowsThisBrowser()"]) {
    const start = source.indexOf(name);
    const block = source.slice(start, source.indexOf("\n}\n", start));
    assert.match(block, /isFidjItself \|\| signInHint\(config\.appId\)/, name);
  }
});

// The passkey door on the Fidj window: the challenge from the interaction's
// context reaches the shared screen, as it reaches the provider's own page.
test("the Fidj window carries the passkey door", () => {
  const block = interactionScreen();
  assert.match(block, /passkey: details\.passkey/);
});

// The Fidj window knows when the agreement is already on file, so the consent
// screen it draws asks only which account.
test("the Fidj window carries whether the agreement is on file", () => {
  assert.match(interactionScreen(), /agreementAccepted: details\.agreementAccepted/);
});

// Only a 401 means the session is gone. A 403 refuses one action to somebody
// still signed in; signing them out for it — on Fidj's console, and in the
// Fidj window that shares its storage — ended the console's session.
test("the shell signs out on a 401 only, never on a 403", () => {
  const source = content();
  const start = source.indexOf("async function request(");
  const block = source.slice(start, source.indexOf("\n}\n", start));
  assert.doesNotMatch(block, /\[401, 403\]\.includes/);
  assert.match(block, /response\.status === 401/);
});
