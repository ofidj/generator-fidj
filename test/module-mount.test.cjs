const { test } = require("node:test");
const assert = require("node:assert/strict");
const { describeMount } = require("../lib/module-mount.cjs");

// The entry HTML of a built Angular app, as the console actually produces it.
const angular = `<!DOCTYPE html><html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>fidj.ovh</title>
  <base href="/"/>
  <link rel="icon" type="image/png" href="assets/icon/favicon.png"/>
<link rel="stylesheet" href="styles.css"></head>
<body>
  <app-root></app-root>
<script src="runtime.js" type="module"></script><script src="polyfills.js" type="module"></script><script src="main.js" type="module"></script></body>
</html>`;

test("reads what a built app needs in order to start", () => {
  const mount = describeMount(angular, "index.html");
  assert.deepEqual(mount.styles, ["module/styles.css"]);
  assert.deepEqual(mount.scripts, [
    { src: "module/runtime.js", module: true },
    { src: "module/polyfills.js", module: true },
    { src: "module/main.js", module: true },
  ]);
  assert.equal(mount.markup, "<app-root></app-root>");
});

test("takes the icon link but not as a stylesheet", () => {
  const mount = describeMount(angular, "index.html");
  assert.ok(!mount.styles.some((href) => href.includes("favicon")));
});

test("addresses a nested entry from the site root", () => {
  const mount = describeMount(angular, "console/index.html");
  assert.deepEqual(mount.styles, ["module/console/styles.css"]);
  assert.equal(mount.scripts[0].src, "module/console/runtime.js");
});

test("leaves absolute and cross-origin URLs alone", () => {
  const mount = describeMount(
    `<head><link rel="stylesheet" href="https://cdn.example/app.css"><link rel="stylesheet" href="/rooted.css"></head><body><div id="root"></div><script src="/app.js"></script></body>`,
    "index.html",
  );
  assert.deepEqual(mount.styles, ["https://cdn.example/app.css", "/rooted.css"]);
  assert.deepEqual(mount.scripts, [{ src: "/app.js", module: false }]);
});

test("refuses an entry that starts nothing", () => {
  assert.throws(
    () => describeMount("<head></head><body><app-root></app-root></body>", "index.html"),
    /loads no script/,
  );
  assert.throws(
    () => describeMount('<head></head><body><script src="a.js"></script></body>', "index.html"),
    /empty body/,
  );
});
