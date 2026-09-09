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

Run `npm test` before changing the template. Every fresh generated app includes the same tests.

## Privacy scope

Optional preferences and their history belong to this app. In the static content app, export covers the Fidj-held membership records and no independent app database exists. In Studio Notes, export includes the Fidj membership and the starter’s notes. Leaving through this app removes its Fidj membership and locally held notes. App owners must resolve ownership first.

Notes are in memory and reset on server restart; replace this store before operating a real product. Direct departure from the Fidj dashboard revokes access but does not erase this starter’s independent notes. A registered deletion adapter, durable jobs/retries, account-wide identity deletion, real terms/purposes and a production retention policy are later integration work. The demo agreement is explicitly a placeholder, not a legal policy.

The browser SDK stores the app’s session in this origin’s local storage. Use HTTPS and maintain a strict content security policy when hosting. The backend delegates signature and session-revocation validation to the configured Fidj API and fails closed when it cannot verify a session.

## Local scenario

Only when using the loopback API, set `LOCAL_DEMO=true` to show synthetic Alex/Maya/Sam sign-in shortcuts. These accounts must be seeded by your local Fidj API; the starter does not create accounts or seed data remotely. Alex is the owner, and the owner console can grant Maya Editor access.

## Entry flow

The generated content app opens on `/#/signin`. Sign in or choose **Enter anonymously** to open `/#/content`, containing the supplied HTML. Signed-in users can open **My privacy** separately. Sign-out and departure return to the sign-in screen. Anonymous content is public; this navigation flow is not a security boundary for static assets.
