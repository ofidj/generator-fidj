# Changelog

## [1.4.0] - 2026-09-13

- Render the provider's sign-in screen. When Fidj's provider hands a person to a
  front end (`FIDJ_INTERACTION_UI` on the API), the generated shell now shows
  that screen: it names the app asking, says what Fidj is, collects the
  credential or the approval, and posts it straight back — a real form
  navigation, because the provider answers with a redirect that carries the
  person onward. The interaction id is single-use and leaves the address bar at
  once.

## [1.3.1] - 2026-09-13

- Accept `--credentials` on the `create-fidj` command too. 1.3.0 added it to the
  Yeoman generator alone; the parity test between the two entry points is what
  said so.

## [1.3.0] - 2026-09-13

- Add `--credentials true` so an app that delegates to the provider may also
  offer its own email and password, beside the Fidj door rather than instead of
  it. Off by default: an app that says nothing still collects no password, which
  is the promise its entry makes. Where it is on, the app — not only Fidj — is
  trusted with the credential, and the entry leads with the form for a stranger
  and with Fidj for a browser that has been here before.

## [1.2.0] - 2026-09-13

- Say where the account lives before offering the button. "Continue with Fidj"
  borrows the grammar of an optional social login — that button always sits next
  to an email and a password — so on an app whose accounts *are* Fidj accounts,
  the missing form read as something broken. The entry now leads with the
  explanation, names account creation, and its button says what it does:
  **Sign in with Fidj**.
- Offer to continue as the person who last signed in here, remembered on the
  app's own origin and forgotten on sign-out. No cross-site question is asked,
  and none is answered.
- Say what signing out of an app actually did. It revokes that app's access and
  leaves the Fidj session alone — which is what makes the next app free, and a
  surprise on a shared computer. The notice says so and links to Fidj.
- Share one provider entry between both app shapes; they had drifted apart.

## [1.1.0] - 2026-09-13

- Mount an app at the shell's own address instead of under `/module/`. The
  mounted app starts inside the shell's document, so its screens read
  `example.com/#/my/apps` rather than `example.com/module/#/my/apps` — "module"
  is a generator word with no meaning for the person reading the address bar —
  and signing in no longer reloads the page halfway through. What is left at the
  old address forwards, hash and all.
- Push a history entry when a person moves between screens, so Back returns to
  the screen before rather than leaving the application. Replacing still happens
  where nothing was navigated to: stripping a single-use token out of the
  address, correcting a route the person did not choose, clearing the sign-in
  callback.

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
