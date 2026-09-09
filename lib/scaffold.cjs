const fs = require("node:fs");
const path = require("node:path");
const { inspectModule } = require("./app-module.cjs");
const templateRoot = path.join(
  __dirname,
  "../generators/app/templates/typescript",
);

function scaffold(destination, options) {
  const anonymous = options.anonymous ?? true;
  if (![true, false, "true", "false"].includes(anonymous))
    throw new Error("--anonymous must be true or false.");
  const name = options.name || path.basename(path.resolve(destination));
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name))
    throw new Error(
      "Use a lowercase project name with letters, numbers and hyphens.",
    );
  if (!/^[a-zA-Z0-9_-]+$/.test(options.appId || ""))
    throw new Error("Supply your app’s public fidjId with --app-id.");
  const api = new URL(options.apiEndpoint || "https://api.sandbox.fidj.ovh/v3");
  if (
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    !["http:", "https:"].includes(api.protocol)
  )
    throw new Error(
      "Use an API URL without credentials, a query or a fragment.",
    );
  if (
    api.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)
  )
    throw new Error("Use HTTPS for a remote API.");
  const title = options.title || name;
  if (/[\r\n]/.test(title)) throw new Error("Title must be one line.");
  if (
    options.domain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(options.domain)
  )
    throw new Error("Domain must be a hostname, without a scheme or path.");
  const dir = path.resolve(destination);
  const appModule = options.module
    ? inspectModule(options.module, options.moduleEntry, dir)
    : null;
  if (options.moduleEntry && !appModule)
    throw new Error("--module-entry requires --module.");
  if (options.replace && fs.existsSync(dir)) {
    if (!fs.existsSync(path.join(dir, ".fidj-generated")))
      throw new Error(
        "Replacement requires a .fidj-generated marker in the destination.",
      );
    fs.rmSync(dir, { recursive: true });
  }
  if (fs.existsSync(dir) && fs.readdirSync(dir).length)
    throw new Error(
      "Destination must be empty. Existing projects are never overwritten.",
    );
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(templateRoot, dir, { recursive: true });
  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8"),
  );
  pkg.name = name;
  if (options.sdkPath) {
    const sdkPath = path.resolve(options.sdkPath);
    const sdk = JSON.parse(
      fs.readFileSync(path.join(sdkPath, "package.json"), "utf8"),
    );
    if (sdk.name !== "@ofidj/node")
      throw new Error("SDK path must contain a built @ofidj/node package.");
    pkg.dependencies["@ofidj/node"] = "file:" + sdkPath;
  }
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );
  fs.renameSync(path.join(dir, "gitignore"), path.join(dir, ".gitignore"));
  const settings = `FIDJ_APP_ID=${options.appId}\nFIDJ_API_ENDPOINT=${api.href.replace(/\/$/, "")}\nFIDJ_DASHBOARD_URL=https://fidj.ovh\nAPP_TITLE=${title}\nPORT=8200\nHOST=127.0.0.1\nLOCAL_DEMO=false\nFIDJ_DATA_DIR=../.fidj-data/${name}\nFIDJ_PRIVACY_ADAPTER_KEY=\n`;
  const localApi = options.local
    ? "http://localhost:3201/v3"
    : api.href.replace(/\/$/, "");
  const configuration = {
    appId: options.appId,
    apiEndpoint: localApi,
    dashboardUrl: options.local ? "http://localhost:4200" : "https://fidj.ovh",
    title,
    localDemo: Boolean(options.local),
    allowAnonymous: anonymous === true || anonymous === "true",
    welcome: options.welcome || title,
    description:
      options.description ||
      "A space to explore, with an account that puts you in control.",
    content: appModule ? "" : options.content,
    moduleEntry: appModule?.entry || "",
    domain: options.domain,
  };
  if (appModule) {
    fs.cpSync(appModule.root, path.join(dir, "public/module"), {
      recursive: true,
    });
    const entryFile = path.join(dir, "public/module", appModule.file);
    const relativeSignin =
      path.posix.relative(
        path.posix.dirname("module/" + appModule.file),
        "index.html",
      ) + "#/signin";
    const html = fs.readFileSync(entryFile, "utf8");
    if (!html.includes("</head>"))
      throw new Error("Module entry must have an HTML head.");
    fs.writeFileSync(
      entryFile,
      html.replace(
        "</head>",
        `<meta name="fidj-signin" content="${relativeSignin}"></head>`,
      ),
    );
  }
  fs.writeFileSync(
    path.join(dir, "app.config.json"),
    JSON.stringify(configuration, null, 2) + "\n",
  );
  const env = settings
    .replace(api.href.replace(/\/$/, ""), localApi)
    .replace(
      "FIDJ_DASHBOARD_URL=https://fidj.ovh",
      `FIDJ_DASHBOARD_URL=${configuration.dashboardUrl}`,
    )
    .replace("LOCAL_DEMO=false", `LOCAL_DEMO=${configuration.localDemo}`);
  fs.writeFileSync(path.join(dir, ".env.example"), env);
  fs.writeFileSync(path.join(dir, ".env"), env);
  fs.writeFileSync(
    path.join(dir, ".fidj-generated"),
    "Disposable generator output.\n",
  );
  return dir;
}
module.exports = { scaffold };
