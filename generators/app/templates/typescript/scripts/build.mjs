import { build } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
const config = JSON.parse(await readFile("app.config.json", "utf8"));
const contentApp = typeof config.content === "string";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/public", { recursive: true });
await cp("public", "dist/public", { recursive: true });
await Promise.all([
  build({
    entryPoints: [contentApp ? "src/content.ts" : "src/main.ts"],
    bundle: true,
    platform: "browser",
    target: "es2022",
    outfile: "dist/public/main.js",
    sourcemap: true,
  }),
  build({
    entryPoints: ["server/index.ts"],
    bundle: true,
    packages: "external",
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: "dist/server.cjs",
  }),
]);
if (contentApp) {
  const { renderContent } = await import("./render-content.mjs");
  await writeFile("dist/public/index.html", renderContent(config));
  await rm("www", { recursive: true, force: true });
  await cp("dist/public", "www", { recursive: true });
  if (config.domain) await writeFile("www/CNAME", config.domain + "\n");
}
await cp("dist/public/index.html", "dist/public/app.html");

const moduleFiles = {};
async function collect(directory, relative = "") {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = relative + item.name;
    if (item.isDirectory())
      await collect(directory + "/" + item.name, name + "/");
    else moduleFiles["/" + name] = name;
  }
}
await collect("dist/public");
await writeFile("dist/public-files.json", JSON.stringify(moduleFiles));
