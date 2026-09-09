# Your Fidj TypeScript app

A generated browser client and Node server: sign in on your app’s own origin, save private notes with an Owner or Editor role, and control privacy independently of other apps.

## Run

Use Node 22 or later. Copy `.env.example` to `.env`, set the public app ID and Fidj API URL, then:

```sh
npm install
npm run build
npm start
```

Open http://localhost:8200. The backend must run for protected operations; this is not a static-only GitHub Pages build. Configure Fidj’s allowed origins for your app domain. No app signing key belongs in the browser or this starter’s public configuration.

The current unreleased generator requires the matching `@ofidj/node` 3.6.24 SDK. Until publication, generate with `--sdk-path /absolute/path/to/fidj-node/dist` after building that SDK. Local file dependencies belong only in generated development output; use registry dependencies for release.

## Structure

- `src/main.ts`: `FidjNodeService.init`, login, browser session and views.
- `server/index.ts`: `verifyAppSession` on every protected request; live roles decide whether a note can be saved. Changing a role takes effect on the next backend request, even if a browser still displays old roles.
- `test/server.test.mjs`: fresh HTTP servers verify role changes, revoked/foreign sessions, outage failure, per-user notes and privacy scope.
- `scripts/build.mjs`: browser and Node builds using [esbuild](https://esbuild.github.io/getting-started/), with a separate TypeScript typecheck.

Run `npm test` before changing the template. Every fresh generated app includes the same tests.

## Privacy scope

Optional preferences and their history belong to this app. Export includes the Fidj membership and the starter’s notes. Leaving through this app removes its Fidj membership and locally held notes. App owners must resolve ownership first.

Notes are in memory and reset on server restart; replace this store before operating a real product. Direct departure from the Fidj dashboard revokes access but does not erase this starter’s independent notes. A registered deletion adapter, durable jobs/retries, account-wide identity deletion, real terms/purposes and a production retention policy are later integration work. The demo agreement is explicitly a placeholder, not a legal policy.

The browser SDK stores the app’s session in this origin’s local storage. Use HTTPS and maintain a strict content security policy when hosting. The backend delegates signature and session-revocation validation to the configured Fidj API and fails closed when it cannot verify a session.

## Local scenario

Only when using the loopback API, set `LOCAL_DEMO=true` to show synthetic Alex/Maya/Sam sign-in shortcuts. These accounts must be seeded by your local Fidj API; the starter does not create accounts or seed data remotely. Alex is the owner, and the owner console can grant Maya Editor access.
