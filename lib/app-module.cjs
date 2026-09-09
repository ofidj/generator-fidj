const fs = require("node:fs");
const path = require("node:path");

function inspectModule(source, entry = "index.html", destination) {
  const root = fs.realpathSync(path.resolve(source));
  const output = path.resolve(destination);
  if (!fs.statSync(root).isDirectory())
    throw new Error("Module must be a built website directory.");
  if (
    output === root ||
    output.startsWith(root + path.sep) ||
    root.startsWith(output + path.sep)
  )
    throw new Error(
      "Module source and generated destination must not contain each other.",
    );
  if (/^(?:[a-z]+:|\/\/)/i.test(entry))
    throw new Error("Module entry must be relative.");
  const url = new URL(entry, "https://module.invalid/module/");
  if (
    url.origin !== "https://module.invalid" ||
    !url.pathname.startsWith("/module/") ||
    url.search ||
    entry.startsWith("/")
  )
    throw new Error(
      "Module entry must be a relative HTML path inside the module.",
    );
  const file = decodeURIComponent(url.pathname.slice("/module/".length));
  if (
    !file.endsWith(".html") ||
    file.split("/").some((part) => part === "..") ||
    file.includes("\\")
  )
    throw new Error(
      "Module entry must be a relative HTML path inside the module.",
    );
  if (!fs.statSync(path.join(root, file)).isFile())
    throw new Error("Module entry does not exist.");
  if (!fs.readFileSync(path.join(root, file), "utf8").includes("</head>"))
    throw new Error("Module entry must have an HTML head.");
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink())
        throw new Error("Built modules must not contain symbolic links.");
      if (
        [".git", "node_modules", ".env"].includes(item.name) ||
        item.name.startsWith(".env.")
      )
        throw new Error(
          "Supply only the module's public build output, without environment or dependency files.",
        );
      if (item.isDirectory()) visit(path.join(directory, item.name));
    }
  };
  visit(root);
  return { root, file, entry: "./module/" + file + url.hash };
}
module.exports = { inspectModule };
