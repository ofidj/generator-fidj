# Changelog

## [3.21.2] - 2026-10-03

- Starting the mounted app removes the sign-in screen's `signin-view` class: a
  console reached after the entry no longer loses its page margins.
- A module stylesheet repeated inside `<noscript>` is loaded once.
- The profile's Sign out is a plain button (`.sign-out`), not `.danger`.

## [3.21.1] - 2026-10-03

- Generated apps install @ofidj/node 3.21.1.

## [3.21.0] - 2026-10-03

- No change of its own: moves to the 3.21 series. Generated apps install
  @ofidj/entry and @ofidj/node 3.21.

## [3.20.0] - 2026-10-03

- Generated apps link the service agreement through `agreementAddress` from
  `@ofidj/entry`, with the address the API hands: the agreement screen and the
  membership history open the text in the language the person read, instead of
  an address each template rebuilt without it. A test keeps the templates from
  rebuilding it again.

## [3.19.0] - 2026-09-27

- Generated apps take `@ofidj/entry` 3.19.0 and `@ofidj/node` 3.19.0: the top
  bar stays on screen and the tabs pin under it, Sign out is the same red,
  compact button as on Fidj's profile, the inline sign-in form has no
  preamble, and the member card links the contract as "Contract · read it".

## [3.18.2] - 2026-09-26

- Keep the session when the ID token has expired. The shell sent the stored ID
  token as it stood — it lives half an hour, while `isLoggedIn()` reads only the
  refresh token — and took the API's 401 as the end of the session:
  `logout(true)` deleted the refresh token on the server and in the browser. So
  every tab opened more than thirty minutes after signing in, on fidj.ovh itself
  as in every app, landed on the sign-in. Requests now go through
  `src/api-request.ts`, which refreshes the SDK's token before sending it and
  retries a 401 once on a forced refresh before ending anything. Studio Notes
  and the content shell share it.
- Keep the address somebody asked for. A new tab on `#/profile` landed on
  `#/content`: the silent question to Fidj came back to the redirect URI and was
  sent home, and a sign-in by hand did the same. The route now survives the
  silent re-entry, the session restore and the Fidj door.
- Profile: the member card is no longer framed inside a second card, and the
  profile takes the content's width. History is a button beside Export
  (`bindMemberHistory` from `@ofidj/entry/dom` 3.18.1) and reads with the
  purpose titles.
- Sign-in: the "Your account, with Fidj" block under the form is gone — it
  restated the lead.
- Needs `@ofidj/entry` 3.18.1: the template range (`^3.18.0`) resolves to it once
  it is published; tighten it to `^3.18.1` then.

## [3.7.5] - 2026-09-14

- Stop offering by name somebody who signed out. The entry remembers the last
  address so it can say **Continue as <them>**, and every sign-out the shell owns
  forgets it — on a shared computer that is the whole difference. A console that
  signs out through the SDK takes another path and forgot nothing, so Fidj's own
  entry kept offering a person who had left. The SDK records that this browser
  asked to be signed out, and the entry now reads it.
- Carry the address the button just showed. **Continue as <them>** handed the
  person to a screen with an empty email field, so the promise cost a second
  typing of the address it had displayed a moment earlier.

## [3.7.4] - 2026-09-14

- Run the mounted app's scripts in the order they were inserted. A `<script>`
  created in JavaScript carries `async = true` by default, so the shell's four
  injected scripts raced: when the entry point won against the polyfills,
  Angular booted without Zone.js, threw NG0908 and painted nothing. What reached
  the person was a blank page, intermittently, with nothing said.

## [3.7.3] - 2026-09-14

- Generated apps show the Fidj they run — `fidj@<version>`, taken from the SDK
  they carry — instead of the day they were generated. Two apps generated a week
  apart from the same SDK now say the same thing, and what they say can be
  compared with `/v3/status`.
- Release on the shared @ofidj version, which the app template's `@ofidj/node`
  range names: that range is the version a generated app installs, and therefore
  the version its badge claims.

## [1.8.0] - 2026-09-14

- Do not hand a signed-out person straight back to the session they left. On
  Fidj itself the sign-in screen fetches the provider as soon as it renders, so
  that what somebody sees is the credential form or their own name — and that
  shortcut was also how a sign-out was undone by a page reload: the provider
  still recognised the browser and answered with a code, no screen at all. The
  automatic sign-in now asks for re-authentication when the SDK says this
  browser just signed out, until somebody signs in again. Ending the provider
  session is what should make it unnecessary, and that call can be refused.
- Require `@ofidj/node` 3.6.30, which is where the shell reads that from.

## [1.7.0] - 2026-09-13

- Offer a way out of being recognised. A live Fidj session means the screen asks
  for consent and not a password, which is the point — and a dead end for
  somebody who is not who Fidj thinks: a shared computer, a second account,
  another person's tab. **Not you? Sign in with another account** asks again.
- Make an app's "Use a different account" mean it. It forgot the address this
  browser remembered and handed the person back to a session it never ended,
  which recognised them again; it now reaches the provider.

## [1.6.0] - 2026-09-13

- Fetch the credential screen on Fidj's own front end instead of offering a
  button to fetch it. Where the provider renders its sign-in here — the shell
  asks `/v3/status` rather than assuming — somebody arriving at Fidj sees the
  form, or their own name, and never an address that is not Fidj's.
- Only from the sign-in screen, and never over a message. Fired on every render
  where nobody was signed in, it handed a person opening a password-reset link a
  sign-in form instead, and swallowed the "your password has been changed" that
  the reset ends on.
- Stop Fidj introducing itself as a third party to itself: no "the account
  behind fidj", no "fidj never sees your password", when the app being signed
  into is Fidj.

## [1.5.0] - 2026-09-13

- Stop offering to sign in with Fidj to somebody standing on Fidj. An app that
  is not Fidj still names it, because there the label points somewhere; on
  Fidj's own front end it named a provider the person was already in, and the
  explanation beside it described this site as if it were somewhere else. The
  front end is told apart by the one fact it already carries — the dashboard it
  points people to is itself.

## [1.4.2] - 2026-09-13

- Leave the provider's screen when the address does. Going from
  `#/signin?interaction=…` back to `#/signin` changes only the fragment, so the
  document is not reloaded: the shell kept its interaction state and drew that
  screen again over an address that no longer named one. A person who asked to
  leave stayed put.

## [1.4.1] - 2026-09-13

- Reload when a mounted app is handed an address it does not own. Checked first
  in the render, because every later branch writes into an element the mounted
  app replaced — a hash change from the console to a recovery screen left
  Angular trying to route it and throwing.
- Keep the interaction id in the address while the provider's screen is up.
  Taking it out looked tidier and made the screen a trap: the address became
  `#/signin`, so going back to `#/signin` changed nothing and the person stayed
  on a screen they had asked to leave.
- Keep the typed address across a refusal on that screen. It comes back as a
  redirect, so the field was emptied — and retyping an address is the part a
  person gets wrong twice. Kept in the browser, never in the URL.

## [1.4.0] - 2026-09-13

- Render the provider's sign-in screen. When Fidj's provider hands a person to a
  front end (`FIDJ_SIGNIN_ON_UI` on the API), the generated shell now shows
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
