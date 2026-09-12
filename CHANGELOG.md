# Changelog

## [1.0.10] - 2026-09-13

- Point a `--local` build at the loopback API's own provider. It kept the hosted
  issuer while the API URL moved to loopback, so the client refused the mismatch
  and a local build that started anyway would have sent sign-ins to production.

## [1.0.9] - 2026-09-13

- Offer the provider entry to an app with its own backend, not only to content
  and module apps: `main.ts` gains the redirect sign-in, the app server serves
  `FIDJ_OIDC_ISSUER` to its page, and the guard that refused those apps is gone.

## [1.0.8] - 2026-09-12

- Carry the dated version through server-backed generated apps and show the
  serving API version beside it in Fidj's own shell.

## [1.0.7] - 2026-09-12

- Distinguish a missing service agreement from an unavailable Fidj API and let
  people retry loading it without losing the sign-in form.

## [1.0.6] - 2026-09-12

- Give every generated app an always-visible bottom-right release date in
  `YY.MM.DD` form, derived automatically when the app is generated.

## [1.0.5] - 2026-09-12

- Permit images served by the configured Fidj API origin in the generated server's CSP, so local and self-hosted public activity badges render without widening the policy to arbitrary HTTP origins.

## [1.0.4] - 2026-09-12

- Replace transport error names with written sign-in guidance, preserve the submitted form after failure, and explain the agreement requirement on submit without hiding disabled actions from keyboard users.

- Require a shared unchecked agreement checkbox on login/signup, with an app-scoped readable agreement and fail-closed loading.

Dated entries are historical; current workflow is in the package README.

## [1.0.3] - 2026-09-11

- Send a new account into the app, where a returning sign-in lands, instead of the shell's account card.
- Use the same submit label on the starter app's own form as on the shared entry.
- Remove the obsolete Travis configuration and publish script; CI now also generates and builds a fixture app from a clean checkout.
- Replace the Notes starter's native departure prompt with an in-app confirmation and cancellation state.
- Add --oidc-issuer for generated content/module entries while preserving branding and anonymous-entry configuration.
- Clarify expired-session and queued-cleanup messages in generated account screens.
- Add signed privacy readiness checks and isolated rehearsal commands to generated apps.
- Connect generated app data export/erasure, durable retry state and scoped completion receipts.
- Add shared-account password recovery and email verification integration.

- Compose built application modules behind the shared SDK sign-in with `--module` and `--module-entry`; preserve module source, validate public assets and serve an explicit asset manifest.
- Preserve module-owned hash routes, including public app cards, through the generated entry.
- Add a builder description input and correct hash links to the Fidj dashboard.
- Configure anonymous entry with `--anonymous true|false`; mleweb explicitly disables it.
- Restore the login-first flow: sign-in or explicit anonymous entry opens Content, with privacy in a separate view.
- Make the TypeScript client/Node backend template the maintained default through CLI and Yeoman.
- Add live SDK session verification, role-controlled notes, privacy flows and generated HTTP tests.
- Refuse overwriting non-empty projects; support an explicit local SDK path during coordinated development.
- Use mleweb as the downstream clean-generation GitHub Actions fixture.
- Accept title, welcome, HTML content and domain through the public CLI; generate a static SDK app and `www/CNAME` with no downstream site renderer.
- Add guarded regeneration and a CLI acceptance test; retain Studio Notes as the separate server authorization example.
- Remove unused TSLint/welcome dependencies so clean installs do not depend on unpinned TypeScript peer resolution.
