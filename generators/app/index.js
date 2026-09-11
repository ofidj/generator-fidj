const Generator = require("yeoman-generator");
const { scaffold } = require("../../lib/scaffold.cjs");

// Yeoman and bin/create-fidj.cjs are two doors into the same scaffolder, and
// they must stay at parity: an input added to one and not the other silently
// disappears for half the users. test/parity.test.cjs fails when they drift.
const TEXT_OPTIONS = [
  "app-id",
  "api-endpoint",
  "oidc-issuer",
  "sdk-path",
  "title",
  "welcome",
  "description",
  "content",
  "anonymous",
  "domain",
  "module",
  "module-entry",
  "logo",
  "favicon",
];
// Repeatable: --highlight twice yields two cells.
const LIST_OPTIONS = ["highlight", "badge"];
const FLAG_OPTIONS = ["local", "replace"];

// Yeoman joins a repeated flag into one comma-separated string before any type
// coercion, and splitting that back is wrong: a highlight body legitimately
// contains commas ("An install, a fidjId, a few lines"). Read the occurrences
// from argv, which is exactly what was typed, and fall back to Yeoman's value
// when the generator is composed programmatically rather than from a command
// line.
function repeated(name, fallback, argv = process.argv) {
  const found = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--" + name && index + 1 < argv.length)
      found.push(argv[index + 1]);
    else if (argv[index].startsWith("--" + name + "="))
      found.push(argv[index].slice(name.length + 3));
  }
  if (found.length) return found;
  if (fallback === undefined) return undefined;
  return Array.isArray(fallback) ? fallback : [fallback];
}

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.argument("appname", { type: String, required: false });
    for (const key of TEXT_OPTIONS) this.option(key, { type: String });
    for (const key of LIST_OPTIONS) this.option(key, { type: String });
    for (const key of FLAG_OPTIONS) this.option(key, { type: Boolean });
    this.option("api-endpoint", {
      type: String,
      default: "https://api.sandbox.fidj.ovh/v3",
    });
  }
  async prompting() {
    this.answers = await this.prompt([
      ...(!this.options.appname
        ? [
            {
              type: "input",
              name: "name",
              message: "Project name",
              default: "my-fidj-app",
            },
          ]
        : []),
      ...(!this.options["app-id"]
        ? [
            {
              type: "input",
              name: "appId",
              message: "Public fidjId from your owner console",
            },
          ]
        : []),
    ]);
  }
  writing() {
    const name = this.options.appname || this.answers.name;
    scaffold(this.destinationPath(name), {
      name,
      title: this.options.title,
      welcome: this.options.welcome,
      description: this.options.description,
      content: this.options.content,
      anonymous: this.options.anonymous,
      highlights: repeated("highlight", this.options.highlight),
      badges: repeated("badge", this.options.badge),
      logo: this.options.logo,
      favicon: this.options.favicon,
      module: this.options.module,
      moduleEntry: this.options["module-entry"],
      domain: this.options.domain,
      sdkPath: this.options["sdk-path"] || process.env.FIDJ_SDK_DIR,
      oidcIssuer: this.options["oidc-issuer"],
      local: this.options.local || process.env.FIDJ_LOCAL === "true",
      replace: this.options.replace,
      appId:
        process.env.FIDJ_APP_ID || this.options["app-id"] || this.answers.appId,
      apiEndpoint: this.options["api-endpoint"],
    });
    this.log(
      `Created ${name}. Copy .env.example to .env, then npm install && npm run build && npm start.`,
    );
  }
};

module.exports.repeatedOption = repeated;
