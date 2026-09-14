const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const url = require("node:url");

const renderContent = async () =>
  (
    await import(
      url.pathToFileURL(
        path.join(
          __dirname,
          "../generators/app/templates/typescript/scripts/render-content.mjs",
        ),
      ).href
    )
  ).renderContent;

const base = {
  title: "Fidj",
  welcome: "Your identity. Your control.",
  content: "",
  logo: "./fidj-logo.png",
  favicon: "./fidj-logo.png",
};
const mounted = {
  ...base,
  moduleEntry: "#/my",
  moduleMount: {
    styles: ["/module/styles.abc.css"],
    scripts: [
      { src: "/module/runtime.abc.js", module: true },
      { src: "/module/main.abc.js", module: true },
    ],
    markup: "<app-root></app-root>",
  },
};

// The mounted app's scripts are injected by the shell, so the browser's preload
// scanner cannot see them in the document: it learns what to fetch only once the
// shell's own bundle has arrived and run. Naming them in the head starts the
// larger download alongside the smaller one instead of after it. An app that
// carries a module is an app people open to reach that module — the sign-in
// screen is the anteroom — so this is worth its bytes there, and only there.
test("the head names the mounted app's assets so the browser can start them early", async () => {
  const html = (await renderContent())(mounted);
  const head = html.slice(0, html.indexOf("</head>"));
  for (const script of mounted.moduleMount.scripts)
    assert.match(
      head,
      new RegExp(
        `<link rel="modulepreload" href="${script.src.replace(/\./g, "\\.")}"`,
      ),
      `${script.src} is not preloaded`,
    );
  assert.match(
    head,
    /<link rel="preload" as="style" href="\/module\/styles\.abc\.css"/,
    "the mounted app's stylesheet is not preloaded",
  );
  // Preloaded, not applied: the module's stylesheet over the shell's own
  // sign-in screen is somebody else's design on this one's markup.
  assert.doesNotMatch(
    head,
    /<link rel="stylesheet" href="\/module\//,
    "the module's stylesheet must not be applied to the shell's own screens",
  );
});

// A hosted console cannot tell from its own code that it is hosted, and some of
// what it shows depends on it: email verification and password recovery are the
// shell's screens, so the console links to them only where a shell exists. This
// says both that one does and where its addresses start.
test("the head tells a mounted app that a shell is hosting it", async () => {
  const html = (await renderContent())(mounted);
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /<meta name="fidj-shell" content="\.\/">/);
});

test("an app with no module names nothing extra", async () => {
  const html = (await renderContent())({
    ...base,
    content: "<p>About</p>",
    moduleEntry: "",
    moduleMount: null,
  });
  assert.doesNotMatch(html, /modulepreload/);
  assert.doesNotMatch(html, /rel="preload"/);
  assert.doesNotMatch(html, /fidj-shell/);
});
