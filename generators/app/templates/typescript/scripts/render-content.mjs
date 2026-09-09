const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function renderContent(config) {
  // HTML is supplied by the developer at generation time, never by an app visitor.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(config.title)}</title><link rel="icon" href="./fidj-logo.png"><link rel="stylesheet" href="./main.css"></head><body>
  <header class="topbar"><a class="brand" href="./">${escape(config.title)}</a><a class="fidj-brand" href="${escape(config.dashboardUrl)}/my"><img src="./fidj-logo.png" alt="Fidj">My privacy ↗</a></header>
  <main><section class="card public-content"><h1>${escape(config.welcome)}</h1><div>${config.content}</div></section><div id="app" aria-live="polite"></div><footer>Built with Fidj · Your choices belong to this app.</footer></main><script type="module" src="./main.js"></script></body></html>`;
}
