import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/public", { recursive: true });
await cp("public", "dist/public", { recursive: true });
await Promise.all([
  build({
    entryPoints: ["src/main.ts"],
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
