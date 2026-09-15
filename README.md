# @ofidj/generator-fidj

Generate a Fidj-integrated TypeScript app with a short command. Public identity and content are generator inputs; authentication and per-app privacy are reusable template behavior. Node 22 or 24 is the validation matrix.

Registry examples require published compatible versions. For current workspace development, supply a built local SDK with `--sdk-path`.

## Content app — static hosting

```sh
npx -y -p @ofidj/generator-fidj -p yo yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID --title "My App" --welcome "Welcome" --content "<p>About my app</p>" --domain example.com
cd my-app
npm install && npm run build-prod
```

Serve `www/` on a static host. It contains your public content, SDK sign-in/account creation, current roles, consent/history, scoped export and confirmed departure, plus `CNAME`. Private signing keys are never needed in the browser. `npm start` supplies an optional Node preview; this mode makes its API calls directly to Fidj.

`--content` is trusted developer-authored HTML (like any checked-in application source), never untrusted visitor input. Set real terms before release; the generated agreement is explicitly a demo. The content app has no independent user database. Erasure/export cover Fidj-held membership records, and pending cleanup stays pending.

## Backend example — protected actions

Omit `--content` to generate Studio Notes: a browser client plus Node backend with private persisted notes. The backend revalidates the session and live app roles for every protected request. Owner/Editor may write; other members may read their own notes. This mode requires Node hosting and is separate from the static content app scenario.

Departure uses an in-app confirmation that states the membership, consent and notes being removed and preserves the membership when cancelled.

Configure the generated privacy adapter so departure from either Studio Notes or Fidj erases the same app data. Notes persist outside disposable output. Failed cleanup stays pending in Fidj and can be retried; completed receipts remain visible. See the generated README for server-side configuration and persistence limits.

## CLI and local development

The public entry is `yo @ofidj/fidj`; output goes to `<cwd>/<appname>`. Use the `npx` form above or install once:

```sh
npm install --no-save @ofidj/generator-fidj yo
npx --no-install yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID
```

Repeat a flag for `--highlight` and `--badge`; the values are read from the
command line, so a comma inside one is safe. The old `app2021` positional command
and its Ionic/Cordova templates are gone; the `typescript` template is the only
one.

> Maintainers: `bin/create-fidj.cjs` is the same scaffolder without Yeoman, for
> tooling that runs from a checkout and cannot install `yo` —
> `scripts/local-stack.py` and `fidj-app`'s `create:local` use it.
> `test/parity.test.cjs` fails if either door ever gains an input the other
> lacks. It is not an entry point to hand to anyone building an app.

- `--signin button|inline|both`: how the app asks (default: `button`). `button` hands every sign-in to Fidj, which is the only shape where this app never sees a password. `inline` keeps the app's own email-and-password form and no Fidj door, for an owner who has decided their page is to be trusted with the credential. `both` leads with the Fidj door and folds the app's form under it — what mleweb passes. The older `--credentials true|false` still says what it always said (`true` is `both`); `--signin` wins when both are given.
- `--anonymous true|false`: show or hide anonymous entry in content apps (default: `true`). Set `--anonymous false` for a sign-in-only entry flow, as mleweb does.
- `--highlight "<heading>|<body>"`: add a numbered cell to the sign-in panel, repeatable up to six. These are the app's own selling points, so an app that passes none simply shows its identity — mleweb passes none, Fidj passes four.
- `--badge <text>`: add a trust badge under the sign-in form, repeatable up to four, 40 characters each. None are supplied by default — "EU-hosted" or "GDPR art. 17 · 20" are claims about a particular app, not about every app the generator makes.
- `--logo <image>` and `--favicon <image>`: the app's own marks, copied into `public/brand/`. The logo sits beside the app name at the top of the sign-in panel; the favicon goes in the browser tab. Both fall back to the Fidj mark, so neither is ever blank. Accepts `.png`, `.svg`, `.gif`, `.jpg`, `.webp` or `.ico` under 512KB — an animated GIF works as a logo, and as a favicon in the browsers that animate one.
- `--api-endpoint`: select the API (default: hosted sandbox).
- `--sdk-path` or `FIDJ_SDK_DIR`: use a built local SDK during coordinated development.
- `--entry-path` or `FIDJ_ENTRY_DIR`: same, for a built local `@ofidj/entry` — the sign-in and account screens, the agreement and the design system. Point it at that package's `dist`, as with the SDK.
- `--local` or `FIDJ_LOCAL=true`: use the loopback API/console. Test credentials stay in the validation guide, outside the content app UI. Supply the matching local app ID; `FIDJ_APP_ID` can override it.
- `--replace`: regenerate only a destination containing `.fidj-generated`; unmarked projects are protected.

**The entry is a dependency, not a copy.** `@ofidj/entry` carries the sign-in
and account screens, the service agreement, the provider window, the version
badge and the design system; the generated app imports them the way it imports
the SDK. They used to be files in this template, which meant the only way to
ship a fix was to regenerate every app — and meant Fidj's own console had to be
generated to reach them. A style change now lands in that package, and this
template is what remains genuinely the generator's: the shells that hold the
screens, the content app and the Notes app.

The design system is `@ofidj/entry`'s `tokens.css` — every colour, family and
radius — and its `style.css`, which may not introduce a literal of its own.
Fonts are self-hosted under `public/fonts` and served from the build manifest,
so a generated site stays statically hostable and makes no third-party request
on sign-in.

Generation writes `.env.example`, `.env` and public `app.config.json`. Static configuration is embedded at build time: regenerate/rebuild when changing endpoints. Notes server configuration is read at runtime. Do not place secrets in any public configuration or content input.

For unpublished coordinated changes, build the sibling SDK and entry packages and pass `--sdk-path` and `--entry-path` with their absolute `dist` paths. Committed templates name registry ranges for both; a registry-only install is not validated until coordinated versions are published.

Every generated app carries a fixed bottom-right badge naming the Fidj it runs:
`fidj@<version>`, taken from the SDK it was generated with — the `--sdk-path`
build when one is supplied, the template's `@ofidj/node` range otherwise — and
written to `APP_VERSION` and `app.config.json`. On Fidj's own apps it also shows
the version `/v3/status` answers with, so the two can be compared without
translation. Keep that range on the version this generator releases: the
workspace's `scripts/check-versions.py` and this package's own suite both refuse
the mismatch.

## Real validation repository

[mleweb](https://github.com/mlefree/mleweb) is the thin command-line validation fixture whose generated website is mlefree.com. Its `package.json` passes the original Mario GIF, welcome text and About/CV/contact links directly into this generator. No custom downstream renderer is required. GitHub CI runs the same generation/build path on Node 22/24 and uploads artifacts. Publishing the site to gh-pages, which is what mlefree.com serves, is a separate deliberate job: it runs on mleweb's `master` or on an explicit workflow dispatch, never from a version branch.

Run `npm test` for scaffolding/CLI safety tests. Generated projects include TypeScript checking and HTTP integration tests for live authorization and privacy isolation. See the [local acceptance walkthrough](../LOCAL-DEVELOPMENT.md). Follow TDD: add/run a failing generator or generated-app test before implementation, make it green, then refactor and rerun regression checks.


## Releasing to npm

Pushing to the `package` branch publishes the package, the same convention the
SDK and contracts repositories use. CI installs, runs the tests and publishes
with `NPM_TOKEN`; this package publishes from the repository root rather than
from a `dist` directory, because it ships its sources.

The package contains `bin/`, `lib/` and the `typescript` template only. The
`app2018` and `app2021` Yeoman templates were deleted: nothing read them, and
they accounted for 11.8MB of the repository. `main` points at
`lib/scaffold.cjs`, so `require('@ofidj/generator-fidj')` returns `{ scaffold }`
alongside the `create-fidj` binary.

Publish contracts before the SDK, and the SDK before anything that resolves it
from the registry: the SDK depends on `@ofidj/contracts` by range, so a build
picks up whatever is published at the time.

## Entry flow

The generated content app opens on `/#/signin`. Sign in, or choose **Enter anonymously** when enabled, to open `/#/content`, containing the supplied HTML. Signed-in users can open **My privacy** separately. Sign-out and departure return to the sign-in screen. Anonymous content is public; this navigation flow is not a security boundary for static assets.

**The entry leads with the Fidj door, and that door opens a window.** The button
is the one control on the screen wearing `--fidj-accent`, because it is the one
that belongs to Fidj rather than to the app — and it is the path where the app
never sees a password. An app generated with `--signin both` keeps its own
email-and-password form under an *Inline form* disclosure: opening it folds the
Fidj door away, because the two are alternatives rather than a list. Whichever
door is taken runs the same three screens — credentials, then email
verification on the create path, then the agreement — so the button is a
shortcut to the flow, not a different one.

Pressing it opens Fidj in a browser window of its own rather than navigating
away. Fidj's screens are served from another origin and refuse to be framed, so
a dialog drawn inside the page cannot hold them; a window can, and the page the
person was reading stays exactly where it was. The window says which app it will
return them to, hands the answer back when they are done, and closes itself. A
browser that will not open one falls back to the full-page redirect. Fidj's own
console takes the same door for the same reason — one journey, three apps.

## Compose an existing app as a module

Build your application for the `/module/` base URL, then pass its public output to the same generator:

```sh
npx -y -p @ofidj/generator-fidj -p yo yo @ofidj/fidj my-app --app-id YOUR_FIDJ_ID --title "My App" --welcome "Welcome back" --description "Your app description" --anonymous false --module ./built-console --module-entry 'index.html#/my'
cd my-app && npm install && npm run build-prod
```

The result is one static website: the generated SDK sign-in entry and the module under `www/module/`. After login, the entry opens the module on the same origin. The module must use the same public app ID/API and independently validate authorization for its own operations. The generator copies public build assets without changing their source; module input cannot contain environment files, dependency directories or symlinks.

Hash routes other than the generated entry/content/privacy views are forwarded to the module, preserving existing public cards and console links. The module remains responsible for guarding private routes.

Sign-in, sign-out and expired sessions belong to the shell, which owns those addresses: a module reaches them by leaving the document — the site root — rather than routing inside it, because the shell starts the module in place and only hears `hashchange`. A departure status travels as `?departure=completed|pending` on that address. Fidj's console implements this handover. The shell also names itself in that document — `meta[name="fidj-shell"]`, holding the base its addresses start from — so a module can offer what only a shell has, such as the account screen at `#/account`; standalone there is no such meta and nothing to offer. The generated preview serves module assets from an explicit build manifest, including directory index URLs, and the generated entry names the module's scripts and stylesheet in its head so the browser starts them without waiting for the shell's session.

`fidj-app` now exercises this path with `npm run create:local`: its owner/profile/privacy features remain an explicit Angular console module, while the generator owns the shared entry and final assembly. The local launcher serves the generated Fidj output on port 4200. The source console is maintained outside disposable `.gen` and must be rebuilt before regenerating.

## Generated account lifecycle

Content and module entries include `#/forgot`, `#/reset`, `#/verify`, and authenticated `#/account` screens in the same split layout as sign-in. These routes remain in the generated shell when an application module is attached. Forgot-password responses are neutral; verification requires an explicit click. `My account` provides verification status and resend. Password reset affects the shared Fidj identity across apps. Configure the API’s trusted account UI URL for email links; the current generated API integration requires the coordinated 3.6.24 SDK/API. The server-backed Notes template remains a separate integration example.

## App data adapter

The Notes server exposes `POST /fidj/privacy` for HMAC-authenticated, timestamped export/erase operations. Set a private `FIDJ_PRIVACY_ADAPTER_KEY` and register the same app ID, endpoint and key in the API’s server-side `FIDJ_PRIVACY_ADAPTERS`. Static content apps need no independent data adapter. `FIDJ_DATA_DIR` must stay outside `www`, `dist` and disposable generated output; the generated environment defaults to a sibling data directory.

The file adapter uses atomic writes and a serialized queue for one writer process. Replace it with a transactional database for multi-instance hosting. Erasure receipts retain a hashed subject for replay protection, pruned after 30 days on the next write. Backups and unregistered stores are not covered. Tests exercise live authorization, restart persistence, private exports, adapter authentication, failed cleanup and duplicate-request safety.


### Check a registered data handler

Generated starters include `npm run privacy:check`: configure the server-only `FIDJ_PRIVACY_ADAPTER_KEY` in `.env`, start the app, then run the command. It signs a readiness request, verifies capabilities and probes durable storage without exporting or deleting user records. `FIDJ_APP_URL` can override the default loopback URL. `npm run privacy:rehearse` builds and exercises an isolated temporary data store, including scoped export, failure, retry and persistence. Production app data and credentials are never inputs to that rehearsal.

Readiness confirms this handler only. Register its trusted URL and independent secret with the Fidj API operator; the app owner console can then check the same connection. Group roles granted in Fidj are enforced by the generated backend on each protected operation.

## Beta OIDC input

`--oidc-issuer` selects the OIDC entry for any generated app — a content site, a console module, or an app with its own backend — while preserving branding and anonymous-entry configuration. The entry becomes a single **Continue with Fidj** button, no password field, and the generated `.env` carries `FIDJ_OIDC_ISSUER` so the app's own server can serve it to its page. Register the app's exact callback first (`PUT /v3/apps/:appId/oidc`), or the provider refuses the authorization. This is beta: the API ships an integrated provider from 3.6.26, but it serves no `/oidc` routes until an operator configures an issuer and signing keys, so confirm the issuer you pass actually answers discovery before offering it.

A compatible issuer, REST API and registered callback without a fragment are prerequisites. Validate that integration and coordinated SDK publication before offering it to app builders. Notes retains its existing authentication flow; no subject migration is implied.

## Required service agreement

[The workspace README](../README.md#entry-one-flow-the-same-everywhere) defines
the flow every Fidj sign-in surface follows, and this generator owns the
implementation the others render. In short: screen 1 asks for an email, a
password, **Sign in** and **Create an account**, and gates neither; creating an
account waits on a verification link; the agreement is its own screen, shown
whenever the version recorded for this person and this app is not the current
one, with its submit button read-only until the box is ticked.

The agreement screen's markup, its loading and its disabled-button rule live in
`@ofidj/entry` — one implementation for the app's own form, the composed Fidj
console and the Fidj-hosted OIDC consent page — so an owner who publishes a new
version changes one thing and every surface asks again.
Reading the agreement opens an in-app dialog; a failed load keeps that screen
blocked and never the screen before it. Anonymous entry, when enabled, is not a
login and records no acceptance.

**Current generated output still asks on screen 1.** The content entry and the
`--signin both` disclosure both carry the checkbox beside the credentials, which
is the arrangement the flow above replaces; `--signin button` already delegates
the whole question to Fidj and needs no change. Note what the checkbox actually
gates today: `bindAgreement` copies its *disabled* state onto the submit, so the
button opens as soon as the agreement has loaded, ticked or not, and an unticked
submit is refused afterwards by the caller's handler. The read-only submit the
flow above describes is a change still to make, on the agreement screen.

The text and version come from the app's public API metadata, not copied generator
settings. The API records acceptance before issuing the app token, preserves
optional choices, and rejects a missing choice or stale version. Repeated login
with the same version does not duplicate the history. Administrative membership
creation does not fabricate a user's acceptance.

Before release, the owner sets `configurationAsJSON.serviceAgreement` to
`{"version":"2026-09-11","text":"Your complete app service agreement"}` through
`PUT /apps/:appId`, preserving its other configuration fields. Changing the text
requires a new version. Until configured, the API exposes the explicitly labelled
`starter-demo-1` demo agreement. No generated-source edit is necessary.
