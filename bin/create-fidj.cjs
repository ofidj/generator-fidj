#!/usr/bin/env node
const { parseArgs } = require("node:util");
const { scaffold } = require("../lib/scaffold.cjs");
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "app-id": { type: "string" },
      "api-endpoint": { type: "string" },
      "sdk-path": { type: "string" },
      title: { type: "string" },
      welcome: { type: "string" },
      content: { type: "string" },
      domain: { type: "string" },
      local: { type: "boolean" },
      replace: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(
      "Usage: create-fidj <directory> --app-id <fidjId> [--api-endpoint <url>] [--title <text> --welcome <text> --content <html> --domain <hostname>] [--local] [--replace]",
    );
    process.exitCode = values.help ? 0 : 1;
  } else {
    const dir = scaffold(positionals[0], {
      appId: process.env.FIDJ_APP_ID || values["app-id"],
      apiEndpoint: values["api-endpoint"],
      sdkPath: values["sdk-path"] || process.env.FIDJ_SDK_DIR,
      title: values.title,
      welcome: values.welcome,
      content: values.content,
      domain: values.domain,
      local: values.local || process.env.FIDJ_LOCAL === "true",
      replace: values.replace,
    });
    console.log(
      `Created ${dir}\nNext: copy .env.example to .env, then npm install && npm run build && npm start.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
