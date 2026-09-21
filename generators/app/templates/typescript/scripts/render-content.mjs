const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
// The mounted app's scripts are injected by the shell once its own bundle has
// arrived and run, so the browser's preload scanner never sees them in the
// document and the larger download waits on the smaller one. Naming them here
// starts both at once. Preloaded, never applied: the module's stylesheet over
// the shell's own sign-in screen would be one design on another's markup. An app
// that carries a module is an app people open to reach that module, so this is
// worth its bytes there — and an app without one names nothing extra.
function mountedHead(config) {
  const mount = config.moduleMount;
  if (!mount) return "";
  return [
    // A hosted console cannot tell from its own code that it is hosted, and some
    // of what it shows depends on it: verification and recovery are the shell's
    // own screens. This says a shell is here, and where its addresses start.
    `<meta name="fidj-shell" content="./">`,
    ...mount.scripts.map(
      (script) => `<link rel="modulepreload" href="${escape(script.src)}">`,
    ),
    ...mount.styles.map(
      (href) => `<link rel="preload" as="style" href="${escape(href)}">`,
    ),
  ].join("");
}
export function renderContent(config) {
  // HTML is supplied by the developer at generation time, never by an app visitor.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(config.title)}</title><link rel="icon" href="${escape(config.favicon)}"><link rel="stylesheet" href="./main.css">${mountedHead(config)}</head><body>
  <header class="topbar"><a class="brand" href="#/content"><img src="${escape(config.logo)}" alt=""><span class="brand-name">${escape(config.title)}</span></a><nav class="content-nav" id="app-nav" aria-label="App navigation" hidden></nav></header>
  <main><template id="public-content"><section class="card public-content"><h1>${escape(config.welcome)}</h1><div>${config.content}</div></section></template><div id="app" aria-live="polite"></div><footer>Built with Fidj · Your choices belong to this app.</footer></main><script type="module" src="./main.js"></script></body></html>`;
}
