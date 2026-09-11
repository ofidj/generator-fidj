# Your Fidj TypeScript app

A generated TypeScript client with Fidj sign-in and app-scoped privacy. The generator selects the mode from its inputs:

- With `--content`: public HTML plus account/privacy controls, built to static `www/` assets and optional `CNAME`. No app backend is required; the client calls Fidj directly.
- Without `--content`: Studio Notes, with a Node backend enforcing live Owner/Editor roles for private notes.

The public title, welcome, HTML content and endpoints are in `app.config.json`. Edit the original generator command and regenerate for repeatable changes. Content HTML is trusted developer source.

## Run

Use Node 22 or later. Copy `.env.example` to `.env`, set the public app ID and Fidj API URL, then:

```sh
npm install
npm run build
npm start
```

Open http://localhost:8200. For content apps, `npm run build-prod` produces static `www/` assets; the Node process is only an optional preview. For Studio Notes, the backend must run for protected operations. Configure Fidj’s allowed origins for your app domain. No app signing key belongs in the browser or this starter’s public configuration.

The current unreleased generator requires the matching `@ofidj/node` 3.6.24 SDK. Until publication, generate with `--sdk-path /absolute/path/to/fidj-node/dist` after building that SDK. Local file dependencies belong only in generated development output; use registry dependencies for release.

## Structure

- `src/content.ts`: static content app account, live roles and privacy controls.
- `src/main.ts`: `FidjNodeService.init`, login, browser session and views.
- `server/index.ts`: `verifyAppSession` on every protected request; live roles decide whether a note can be saved. Changing a role takes effect on the next backend request, even if a browser still displays old roles.
- `test/server.test.mjs`: fresh HTTP servers verify role changes, revoked/foreign sessions, outage failure, per-user notes and privacy scope.
- `scripts/build.mjs`: browser and Node builds using [esbuild](https://esbuild.github.io/getting-started/), with a separate TypeScript typecheck.

Use TDD: add and run a failing behavior test before implementation (red), make it pass (green), then refactor and run `npm test`. Change maintained template source and regenerate to verify that every fresh app receives the fix.

## Privacy scope

Optional preferences and their history belong to this app. In the static content app, export covers the Fidj-held membership records and no independent app database exists. In Studio Notes, export includes the Fidj membership and the starter’s notes. Leaving through this app removes its Fidj membership and locally held notes. App owners must resolve ownership first.

Notes persist in `FIDJ_DATA_DIR`. With the adapter registered below, direct export/departure from Fidj includes these notes. Failed erasure keeps a request in Fidj for automatic retry with backoff; people can also retry explicitly. The API pauses after eight failed automatic attempts and exposes a needs-attention state. Account-wide identity deletion, real terms/purposes and a full production retention policy remain separate integration work. The demo agreement is explicitly a placeholder, not a legal policy.

The browser SDK stores the app’s session in this origin’s local storage. Use HTTPS and maintain a strict content security policy when hosting. The backend delegates signature and session-revocation validation to the configured Fidj API and fails closed when it cannot verify a session.

## Local scenario

For the Notes fixture only, `LOCAL_DEMO=true` with the loopback API enables synthetic Alex/Maya/Sam sign-in shortcuts. Content/module entries keep test accounts in developer documentation. These accounts must be seeded by your local Fidj API; the starter does not create accounts or seed data remotely. Alex is the owner, and the owner console can grant Maya Editor access.

## Entry flow

The generated content app opens on `/#/signin`. Sign in, or choose **Enter anonymously** when enabled by `--anonymous true`, to open `/#/content`, containing the supplied HTML. Signed-in users can open **My privacy** separately. Sign-out and departure return to the sign-in screen. Anonymous content is public; this navigation flow is not a security boundary for static assets.

Set `--anonymous false` in the generator command to remove anonymous entry and route unsigned visitors back to sign-in. This controls navigation; static HTML/assets remain public. Put confidential content behind a server-authorized endpoint.

## Application modules

When generated with `--module`, successful sign-in opens the copied module configured by `moduleEntry`. It runs under `/module/` on the same origin and must validate sessions/permissions independently. Its entry contains a `fidj-signin` meta URL for returning to this shared sign-in page. Module code is public static output; user data belongs behind authorized APIs. Rebuild the maintained module source and regenerate to update it; never patch its copied files here.

## Connect app data rights

Set `FIDJ_PRIVACY_ADAPTER_KEY` to a private random secret of at least 32 characters. Keep it exclusively in server environments; it is separate from an app JWT signing key. Register the app on the Fidj API server:

```json
{"YOUR_APP_ID":{"url":"https://your-app.example/fidj/privacy","key":"SAME_PRIVATE_RANDOM_SECRET"}}
```

Set that JSON as `FIDJ_PRIVACY_ADAPTERS` on the API. Endpoint registration is operator-managed in this milestone. HTTPS is required; explicit local mode also permits loopback HTTP. The local workspace launcher configures Studio Notes automatically. Requests contain `appId`, `subject`, `operation` and `requestId`; headers contain a millisecond timestamp and SHA-256 HMAC of `timestamp + "." + JSON.stringify(body)`. Requests older than five minutes are rejected; redirects are not followed. The handler must return the matching `requestId` and `status: "completed"` only after durable success.

Keep `FIDJ_DATA_DIR` outside public assets and generated output. Use one writer process per directory. Replace `server/data-store.ts` with a transactional database implementation for multiple instances. Do not weaken the authorization check inside note writes or the atomic erase/receipt transaction. Duplicate erasures preserve later membership data. Minimal receipts contain a hashed subject and completion timestamp; receipts older than 30 days are pruned on the next write. Backups and unregistered external data remain outside this handler’s scope.


## Check and rehearse

After starting the Notes backend with its server-only adapter secret, run `npm run privacy:check`. The signed check confirms export/erase capabilities and writable storage without accessing user records. Override `FIDJ_APP_URL` for a deployed HTTPS backend. Keep this secret out of browser configuration.

Run `npm run privacy:rehearse` for an isolated temporary-store HTTP scenario covering live roles, scoped export, persistence, failure and idempotent erasure. It never points at your running data directory. Groups are managed in the Fidj owner console; direct and group roles are checked live by the backend.

## Agreement at sign-in

Sign-in and account creation require the unchecked service-agreement checkbox.
Read the app's current text/version from the dialog before accepting. If the
agreement cannot load, the form stays blocked. The API records the accepted
version per app; optional privacy choices are separate. The app owner must replace
the default demo agreement using the Fidj app's `configurationAsJSON.serviceAgreement`
(`version` and `text`) before release. No generated-source edit is needed.
