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

Omit `--content` to generate Studio Notes: a browser client plus Node backend with private persisted notes. The backend revalidates the session and live app roles for every protected request. Owner/Editor may write; other members may read their own notes. This mode requires Node hosting and is separate from the static content app scenario.

Configure the generated privacy adapter so departure from either Studio Notes or Fidj erases the same app data. Notes persist outside disposable output. Failed cleanup stays pending in Fidj and can be retried; completed receipts remain visible. See the generated README for server-side configuration and persistence limits.

## CLI and local development

The package exposes `create-fidj`; from its checkout use `node bin/create-fidj.cjs`. Yeoman `yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID` invokes the same scaffolder and accepts the content/title/welcome/domain options. The old `app2021` positional command is a historical reference, not the maintained interface.

- `--anonymous true|false`: show or hide anonymous entry in content apps (default: `true`). Set `--anonymous false` for a sign-in-only entry flow, as mleweb does.
- `--api-endpoint`: select the API (default: hosted sandbox).
- `--sdk-path` or `FIDJ_SDK_DIR`: use a built local SDK during coordinated development.
- `--local` or `FIDJ_LOCAL=true`: use the loopback API/console. Test credentials stay in the validation guide, outside the content app UI. Supply the matching local app ID; `FIDJ_APP_ID` can override it.
- `--replace`: regenerate only a destination containing `.fidj-generated`; unmarked projects are protected.

Generation writes `.env.example`, `.env` and public `app.config.json`. Static configuration is embedded at build time: regenerate/rebuild when changing endpoints. Notes server configuration is read at runtime. Do not place secrets in any public configuration or content input.

During this unreleased milestone, build `../fidj-node` and pass `--sdk-path ../fidj-node/dist`. Committed templates use registry dependency `@ofidj/node ^3.6.24`; a registry-only install is not validated until coordinated versions are published.

## Real validation repository

[mleweb](https://github.com/mlefree/mleweb) is the thin command-line validation fixture whose generated website is mlefree.com. Its `package.json` passes the original Mario GIF, welcome text and About/CV/contact links directly into this generator. No custom downstream renderer is required. GitHub CI runs the same generation/build path on Node 22/24 and uploads artifacts without publishing the site.

Run `npm test` for scaffolding/CLI safety tests. Generated projects include TypeScript checking and HTTP integration tests for live authorization and privacy isolation. Local acceptance steps are in the workspace's `product-plan/09-generated-app-validation.md`.

## Entry flow

The generated content app opens on `/#/signin`. Sign in, or choose **Enter anonymously** when enabled, to open `/#/content`, containing the supplied HTML. Signed-in users can open **My privacy** separately. Sign-out and departure return to the sign-in screen. Anonymous content is public; this navigation flow is not a security boundary for static assets.

## Compose an existing app as a module

Build your application for the `/module/` base URL, then pass its public output to the same generator:

```sh
create-fidj my-app --app-id YOUR_FIDJ_ID --title "My App" --welcome "Welcome back" --description "Your app description" --anonymous false --module ./built-console --module-entry 'index.html#/my'
cd my-app && npm install && npm run build-prod
```

The result is one static website: the generated SDK sign-in entry and the module under `www/module/`. After login, the entry opens the module on the same origin. The module must use the same public app ID/API and independently validate authorization for its own operations. The generator copies public build assets without changing their source; module input cannot contain environment files, dependency directories or symlinks.

Hash routes other than the generated entry/content/privacy views are forwarded to the module, preserving existing public cards and console links. The module remains responsible for guarding private routes.

The module entry receives a `meta[name="fidj-signin"]` URL, relative to its base URL. A module can send its sign-in, logout or expired-session flow there. Fidj's console implements this handoff and preserves departure status. The generated preview serves module assets from an explicit build manifest, including directory index URLs.

`fidj-app` now exercises this path with `npm run create:local`: its owner/profile/privacy features remain an explicit Angular console module, while the generator owns the shared entry and final assembly. The local launcher serves the generated Fidj output on port 4200. The source console is maintained outside disposable `.gen` and must be rebuilt before regenerating.

## Generated account lifecycle

Content and module entries include `#/forgot`, `#/reset`, `#/verify`, and authenticated `#/account` screens in the same split layout as sign-in. These routes remain in the generated shell when an application module is attached. Forgot-password responses are neutral; verification requires an explicit click. `My account` provides verification status and resend. Password reset affects the shared Fidj identity across apps. Configure the API’s trusted account UI URL for email links; the current generated API integration requires the coordinated 3.6.24 SDK/API. The server-backed Notes template remains a separate integration example.

## App data adapter

The Notes server exposes `POST /fidj/privacy` for HMAC-authenticated, timestamped export/erase operations. Set a private `FIDJ_PRIVACY_ADAPTER_KEY` and register the same app ID, endpoint and key in the API’s server-side `FIDJ_PRIVACY_ADAPTERS`. Static content apps need no independent data adapter. `FIDJ_DATA_DIR` must stay outside `www`, `dist` and disposable generated output; the generated environment defaults to a sibling data directory.

The file adapter uses atomic writes and a serialized queue for one writer process. Replace it with a transactional database for multi-instance hosting. Erasure receipts retain a hashed subject for replay protection, pruned after 30 days on the next write. Backups and unregistered stores are not covered. Tests exercise live authorization, restart persistence, private exports, adapter authentication, failed cleanup and duplicate-request safety.


### Check a registered data handler

Generated starters include `npm run privacy:check`: configure the server-only `FIDJ_PRIVACY_ADAPTER_KEY` in `.env`, start the app, then run the command. It signs a readiness request, verifies capabilities and probes durable storage without exporting or deleting user records. `FIDJ_APP_URL` can override the default loopback URL. `npm run privacy:rehearse` builds and exercises an isolated temporary data store, including scoped export, failure, retry and persistence. Production app data and credentials are never inputs to that rehearsal.

Readiness confirms this handler only. Register its trusted URL and independent secret with the Fidj API operator; the app owner console can then check the same connection. Group roles granted in Fidj are enforced by the generated backend on each protected operation.
