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
      help: { type: "boolean" },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(
      "Usage: create-fidj <directory> --app-id <fidjId> [--api-endpoint <url>]",
    );
    process.exitCode = values.help ? 0 : 1;
  } else {
    const dir = scaffold(positionals[0], {
      appId: values["app-id"],
      apiEndpoint: values["api-endpoint"],
      sdkPath: values["sdk-path"],
    });
    console.log(
      `Created ${dir}\nNext: copy .env.example to .env, then npm install && npm run build && npm start.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
