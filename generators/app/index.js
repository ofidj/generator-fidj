const Generator = require("yeoman-generator");
const { scaffold } = require("../../lib/scaffold.cjs");

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.argument("appname", { type: String, required: false });
    this.option("app-id", { type: String });
    for (const key of [
      "title",
      "welcome",
      "description",
      "content",
      "domain",
      "sdk-path",
      "anonymous",
      "module",
      "module-entry",
    ])
      this.option(key, { type: String });
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
      module: this.options.module,
      moduleEntry: this.options["module-entry"],
      domain: this.options.domain,
      sdkPath: this.options["sdk-path"],
      appId: this.options["app-id"] || this.answers.appId,
      apiEndpoint: this.options["api-endpoint"],
    });
    this.log(
      `Created ${name}. Copy .env.example to .env, then npm install && npm run build && npm start.`,
    );
  }
};
