const path = require("node:path");

// A mounted app used to be a second document: the shell sent the browser to
// /module/index.html and the person read "module" — a generator word — in the
// address bar of their privacy console, after a full page reload in the middle
// of signing in. Instead, read what the built app needs in order to start, and
// let the shell start it inside its own document at its own address.
//
// Only the entry HTML is interpreted, and only for the three things a built
// single-page app puts there: its stylesheets, its scripts, and the element it
// mounts into. Anything else in that file is the build tool's business.
function describeMount(html, file) {
  // Relative URLs in the entry resolve against its own directory, which is where
  // the module's files are copied. The shell addresses them from the site root.
  const base = path.posix.join("module", path.posix.dirname(file));
  const resolve = (url) => {
    if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(url)) return url;
    return path.posix.normalize(path.posix.join(base, url));
  };
  const attribute = (tag, name) =>
    (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i")) || [])[1];

  const head = html.slice(0, html.search(/<\/head>/i));
  const body = html.slice(html.search(/<body\b[^>]*>/i)).replace(/^<body\b[^>]*>/i, "");

  const styles = [];
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const rel = (attribute(tag, "rel") || "").toLowerCase();
    const href = attribute(tag, "href");
    if (rel === "stylesheet" && href) styles.push(resolve(href));
  }

  const scripts = [];
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const src = attribute(tag, "src");
    if (!src) continue;
    scripts.push({
      src: resolve(src),
      module: (attribute(tag, "type") || "").toLowerCase() === "module",
    });
  }
  if (!scripts.length)
    throw new Error(
      "Module entry loads no script; supply a built single-page app.",
    );

  // Everything the app expects to find in the document, minus the scripts the
  // shell adds itself once the styles are in place.
  const markup = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/body>[\s\S]*$/i, "")
    .trim();
  if (!markup)
    throw new Error(
      "Module entry has an empty body; supply a built single-page app.",
    );

  return { styles, scripts, markup };
}

module.exports = { describeMount };
