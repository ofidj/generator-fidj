# @ofidj/generator-fidj

Generate a Fidj-integrated TypeScript app with a short command. Public identity and content are generator inputs; authentication and per-app privacy are reusable template behavior. Node 22 or 24 is the validation matrix.

## Content app — static hosting

```sh
create-fidj my-app --app-id YOUR_FIDJ_ID --title "My App" --welcome "Welcome" --content "<p>About my app</p>" --domain example.com
cd my-app
npm install && npm run build-prod
```

Serve `www/` on a static host. It contains your public content, SDK sign-in/account creation, current roles, consent/history, scoped export and confirmed departure, plus `CNAME`. Private signing keys are never needed in the browser. `npm start` supplies an optional Node preview; this mode makes its API calls directly to Fidj.

`--content` is trusted developer-authored HTML (like any checked-in application source), never untrusted visitor input. Set real terms before release; the generated agreement is explicitly a demo. The content app has no independent user database. Erasure/export cover Fidj-held membership records, and pending cleanup stays pending.

## Backend example — protected actions

Omit `--content` to generate Studio Notes: a browser client plus Node backend with private in-memory notes. The backend revalidates the session and live app roles for every protected request. Owner/Editor may write; other members may read their own notes. This mode requires Node hosting and is separate from the static content app scenario.

A departure through Studio Notes erases its notes and requests scoped Fidj departure. Departure directly through the Fidj dashboard revokes access but does not yet notify that independent note store. Durable storage/deletion adapters, groups and OIDC remain later milestones.

## CLI and local development

The package exposes `create-fidj`; from its checkout use `node bin/create-fidj.cjs`. Yeoman `yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID` invokes the same scaffolder and accepts the content/title/welcome/domain options. The old `app2021` positional command is a historical reference, not the maintained interface.

- `--api-endpoint`: select the API (default: hosted sandbox).
- `--sdk-path` or `FIDJ_SDK_DIR`: use a built local SDK during coordinated development.
- `--local` or `FIDJ_LOCAL=true`: use loopback API/console and show synthetic account instructions. Supply the matching local app ID; `FIDJ_APP_ID` can override it.
- `--replace`: regenerate only a destination containing `.fidj-generated`; unmarked projects are protected.

Generation writes `.env.example`, `.env` and public `app.config.json`. Static configuration is embedded at build time: regenerate/rebuild when changing endpoints. Notes server configuration is read at runtime. Do not place secrets in any public configuration or content input.

During this unreleased milestone, build `../fidj-node` and pass `--sdk-path ../fidj-node/dist`. Committed templates use registry dependency `@ofidj/node ^3.6.24`; a registry-only install is not validated until coordinated versions are published.

## Real validation repository

[mleweb](https://github.com/mlefree/mleweb) is the thin command-line validation fixture whose generated website is mlefree.com. Its `package.json` passes the original Mario GIF, welcome text and About/CV/contact links directly into this generator. No custom downstream renderer is required. GitHub CI runs the same generation/build path on Node 22/24 and uploads artifacts without publishing the site.

Run `npm test` for scaffolding/CLI safety tests. Generated projects include TypeScript checking and HTTP integration tests for live authorization and privacy isolation. Local acceptance steps are in the workspace's `product-plan/09-generated-app-validation.md`.
