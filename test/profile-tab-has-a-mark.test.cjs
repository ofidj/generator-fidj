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
