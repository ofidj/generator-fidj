const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const content = fs.readFileSync(
  path.join(__dirname, '../generators/app/templates/typescript/src/content.ts'),
  'utf8',
);

test('the generated app marks Profile in its menu', () => {
  assert.match(content, /profile-mark/);
  assert.match(content, /aria-hidden="true"/);
});

// The mark is the person, not a pictogram: "Profile", then a round badge with
// their initials on the colour @ofidj/entry gives them — the one Fidj's own
// console draws for the same address.
test('the Profile tab ends on the initials of the person signed in', () => {
  assert.match(content, /import \{[^}]*\bprofileAvatar\b[^}]*\} from "@ofidj\/entry"/);
  assert.doesNotMatch(content, /class="profile-mark"[^`]*<svg/);
  assert.match(content, /<span class="tab-label">\$\{label\}<\/span>\$\{profile \?/);
  assert.match(content, /--avatar-hue/);
});
