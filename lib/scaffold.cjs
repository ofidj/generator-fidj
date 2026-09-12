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
  if (options.oidcIssuer) {
    const issuer = new URL(options.oidcIssuer);
    if (issuer.origin !== api.origin || issuer.pathname !== "/oidc" || issuer.hash || issuer.search || issuer.username || issuer.password) throw new Error("OIDC issuer must share the API origin and use /oidc.");
    if (options.content === undefined && !options.module) throw new Error("OIDC currently requires a content app or console module.");
  }
  const title = options.title || name;
  if (/[\r\n]/.test(title)) throw new Error("Title must be one line.");
  // Sign-in highlights are the app's own selling points, so they are supplied
  // per app rather than baked in: an app that passes none simply shows none.
  const highlights = (options.highlights || []).map((entry) => {
    const [heading, ...rest] = String(entry).split("|");
    const body = rest.join("|").trim();
    if (!heading.trim() || !body)
      throw new Error('Each --highlight must read "<heading>|<body>".');
    if (/[\r\n]/.test(entry)) throw new Error("A highlight must be one line.");
    return { heading: heading.trim(), body };
  });
  if (highlights.length > 6)
    throw new Error("Six highlights is the most the sign-in panel can hold.");
  // Trust badges are claims about a specific app — where it is hosted, what it
  // audits. None are supplied by default, because an app cannot inherit them.
  const badges = (options.badges || []).map((entry) => {
    const text = String(entry).trim();
    if (!text || /[\r\n]/.test(text))
      throw new Error("Each --badge must be one line of text.");
    if (text.length > 40)
      throw new Error("A badge must be at most 40 characters.");
    return text;
  });
  if (badges.length > 4)
    throw new Error("Four badges is the most the sign-in footer can hold.");
  if (
    options.domain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(options.domain)
  )
    throw new Error("Domain must be a hostname, without a scheme or path.");
  const brandImage = (value, flag) => {
    if (!value) return null;
    const source = path.resolve(value);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile())
      throw new Error(`${flag} must point at an image file.`);
    const extension = path.extname(source).toLowerCase();
    if (
      ![".png", ".svg", ".gif", ".jpg", ".jpeg", ".webp", ".ico"].includes(
        extension,
      )
    )
      throw new Error(
        `${flag} must be a .png, .svg, .gif, .jpg, .webp or .ico file.`,
      );
    if (fs.statSync(source).size > 512 * 1024)
      throw new Error(`${flag} must be under 512KB; it is served on every visit.`);
    return { source, extension };
  };
  const logo = brandImage(options.logo, "--logo");
  const favicon = brandImage(options.favicon, "--favicon");
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
  const releaseVersion = new Date().toISOString().slice(2, 10).replaceAll("-", ".");
  const settings = `FIDJ_APP_ID=${options.appId}\nFIDJ_API_ENDPOINT=${api.href.replace(/\/$/, "")}\nFIDJ_DASHBOARD_URL=https://fidj.ovh\nAPP_TITLE=${title}\nAPP_VERSION=${releaseVersion}\nPORT=8200\nHOST=127.0.0.1\nLOCAL_DEMO=false\nFIDJ_DATA_DIR=../.fidj-data/${name}\nFIDJ_PRIVACY_ADAPTER_KEY=\n`;
  const localApi = options.local
    ? "http://localhost:3201/v3"
    : api.href.replace(/\/$/, "");
  const configuration = {
    appId: options.appId,
    oidcIssuer: options.oidcIssuer || null,
    apiEndpoint: localApi,
    dashboardUrl: options.local ? "http://localhost:4200" : "https://fidj.ovh",
    title,
    releaseVersion,
    localDemo: Boolean(options.local),
    allowAnonymous: anonymous === true || anonymous === "true",
    welcome: options.welcome || title,
    description:
      options.description ||
      "A space to explore, with an account that puts you in control.",
    content: appModule ? "" : options.content,
    highlights,
    badges,
    // An app that supplies no mark of its own borrows Fidj's, so the sign-in
    // and the browser tab are never blank.
    logo: logo ? "./brand/logo" + logo.extension : "./fidj-logo.png",
    favicon: favicon ? "./brand/favicon" + favicon.extension : "./fidj-logo.png",
    moduleEntry: appModule?.entry || "",
    domain: options.domain,
  };
  if (logo || favicon) fs.mkdirSync(path.join(dir, "public/brand"), { recursive: true });
  if (logo)
    fs.copyFileSync(logo.source, path.join(dir, "public/brand/logo" + logo.extension));
  if (favicon)
    fs.copyFileSync(favicon.source, path.join(dir, "public/brand/favicon" + favicon.extension));
  if (favicon) {
    // The workspace starter serves a static index.html rather than rendering
    // one, so its icon is rewritten here.
    const page = path.join(dir, "public/index.html");
    fs.writeFileSync(
      page,
      fs
        .readFileSync(page, "utf8")
        .replace('href="/fidj-logo.png"', `href="/brand/favicon${favicon.extension}"`),
    );
  }
  if (appModule) {
    fs.cpSync(appModule.root, path.join(dir, "public/module"), {
      recursive: true,
    });
    const entryFile = path.join(dir, "public/module", appModule.file);
    // Point back at the shell's directory, not at its index file, for the same
    // reason the module entry does: no index.html in the address bar.
    const toRoot =
      path.posix.relative(
        path.posix.dirname("module/" + appModule.file),
        ".",
      ) || ".";
    const relativeSignin = toRoot + "/#/signin";
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
