# @ofidj/generator-fidj

Generate a TypeScript browser app and Node backend with Fidj sign-in, live role checks and per-app privacy. The maintained default replaces the old app2021 Angular/Ionic template. Legacy templates remain for reference and are no longer the default generation path.

## Generate locally

Node 22 or later is required. Create an app in Fidj to obtain its public `fidjId`. No private signing key is embedded in generated browser code.

```sh
node bin/create-fidj.cjs my-app --app-id YOUR_FIDJ_ID --api-endpoint https://api.sandbox.fidj.ovh/v3
cd my-app
cp .env.example .env
npm install
npm test
npm start
```

The package also exposes `create-fidj`; the Yeoman entry point `yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID` generates the same template. Existing non-empty destinations are never overwritten.

During this unreleased cross-repo milestone, first build `../fidj-node`, then pass `--sdk-path ../fidj-node/dist` to the CLI. The generated development package uses that local SDK; the committed template requires `@ofidj/node ^3.6.24` for release. Do not claim a registry-only install until the matching SDK/generator versions are published.

## What is generated

- Framework-independent TypeScript client using `FidjNodeService` on the app’s own origin.
- Node backend using `verifyAppSession` for live membership roles before each protected request; no cached browser role is trusted for authorization.
- Private in-memory notes, per-app preferences/history, a scoped export and confirmed departure.
- Typechecking, browser/server build and HTTP integration tests.
- An explicit `.env.example` with public IDs/URLs; local demo shortcuts are disabled by default.

The Node backend is required. This starter is not a static-only GitHub Pages deployment. Production storage, durable deletion adapters, groups and OIDC are later milestones; generated documentation describes the current privacy limits.

## Real integration example

[`mleweb`](https://github.com/mlefree/mleweb), locally `../../mlefree/mleweb`, is a real downstream consumer. Its GitHub Actions workflow builds the coordinated SDK/generator branches, generates from scratch, builds and tests on Node 22 and 24, then uploads an artifact without publishing the site. `_old/` and `_cdn/` remain intact.

The Ofidj launcher also generates Studio Notes on port 8200 and mleweb/Mat’s Cloud on 8201 against the local API. See `../product-plan/09-generated-app-validation.md` for the walkthrough.

## Tests

`npm test` checks scaffolding, output safety and configuration validation. Every output includes its own protected-route tests. The build uses [esbuild’s browser and Node targets](https://esbuild.github.io/getting-started/), with TypeScript checking performed separately.

## Preserve a site’s identity

Downstream apps may supply `public/site.json` and `public/hero.gif` before building. The generator renders a public homepage with an animated hero, CV/experience and contact links; `/app` retains the protected SDK workspace. mleweb uses its original Mario GIF and résumé. Content is escaped, external links are limited to HTTPS/mailto, and no sign-in or SDK API call is required to read the homepage.
