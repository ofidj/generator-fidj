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
  for (const file of ["content.ts", "main.ts"]) {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "generators/app/templates/typescript/src", file),
      "utf8",
    );
    assert.doesNotMatch(source, /Export my (app )?data/, file);
    assert.doesNotMatch(source, /Leave and erase my app data|Confirm leaving/, file);
    assert.match(source, /id="export">Export</, file);
    assert.match(source, /class="danger">Leave &amp; erase</, file);
  }
});
