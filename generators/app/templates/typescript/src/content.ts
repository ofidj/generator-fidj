import {signInErrorMessage, formatDate, optionalPurposes, agreementRequired, agreementFromRefusal, verificationPending, pollVerification, rememberSignIn, forgetSignIn, signInHint, type SigninShape} from "@ofidj/entry";
import {agreementScreen, bindAgreementScreen, bindPasswordReveal, acceptedAgreement, verificationWait, providerEntry, showEmailEntry, showVersionBadge, escape, masthead, highlightCells, badgeStrip, credentialFields, accountForm, passkeySupported, passkeyAssertion, walletDoor, oidcInteractionMarkup, oidcInteractionStyles, bindOidcInteraction} from "@ofidj/entry/dom";
import {openProviderWindow, relayProviderAnswer, type ProviderWindow} from "@ofidj/entry/window";
import { FidjNodeService, FidjOidcClient } from "@ofidj/node";
import config from "../app.config.json";
import "@ofidj/entry/style.css";

const sdk = new FidjNodeService();
const oidc = config.oidcIssuer ? new FidjOidcClient({issuer: config.oidcIssuer, clientId: config.appId, redirectUri: window.location.origin + window.location.pathname, apiEndpoint: config.apiEndpoint, storage: sessionStorage}) : null;
const root = document.querySelector<HTMLDivElement>("#app")!;
showVersionBadge(
  config.releaseVersion,
  config.title === "Fidj" ? config.apiEndpoint : undefined,
  config.moduleVersion ? {name: config.moduleLabel || "module", version: config.moduleVersion} : undefined,
);
const appPath = `/me/apps/${encodeURIComponent(config.appId)}`;
// Passkeys (v3 P1-4): one relying party, Fidj's own domain. Only Fidj's own
// shell runs the ceremony on its page; every other app reaches the passkey
// through the Fidj window, like the rest of Fidj's sign-in.
const passkeyHere = config.title === "Fidj" && passkeySupported();
let signedInWithPasskey = false;
let signedIn = false;
let emailVerified = false;
let anonymous = false;
let initialized = false;
let roles: string[] = [];
let consent: Record<string, boolean> = {};
let history: Array<{ type: string; granted: boolean; changedAt: string }> = [];
const departure = new URLSearchParams(window.location.search).get("departure");
let message =
  departure === "completed"
    ? `You left ${config.title}. Your other memberships and shared identity remain.`
    : departure === "pending"
      ? "Access was revoked. Cleanup is queued; follow its progress in Fidj."
      : "";
let failed = false;
let busy = false;
let leaving = false;
let signInEmail = "";
let signInPassword = "";
// The agreement this app is owed, once the API has said so, and the address a
// just-created account is waiting on. Only one of them is ever set.
let pendingAgreement: {version: string; text: string} | null = null;
let awaitingVerification = "";
let verificationResent = false;
let verificationNotice = "";
let stopWatchingVerification: (() => void) | null = null;
// Who is signed in, as this app's own membership answers it. The bar names them
// and the account screen says it again where it can be checked; the ID token of
// a code flow carries only a subject, so this comes from the membership.
let accountEmail = "";
// Whether the person asked for the app's own form. The entry is rebuilt on every
// render, and a refused sign-in is a render: without this, pressing Continue
// with the agreement unchecked folded the form away and left the complaint
// floating above a door the person could no longer see.
let emailEntryOpen = false;
const accountRoutes = ["forgot", "reset", "verify", "profile"];
let linkToken = "";
let verificationConfirmed = false;
function currentRoute() {
  const [route, query] = window.location.hash.slice(2).split("?");
  if (["reset", "verify"].includes(route) && query) {
    verificationConfirmed = false;
    linkToken = new URLSearchParams(query).get("token") || "";
    window.history.replaceState(null, "", "#/" + route);
  }
  return route;
}
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;
// Signing out of this app revokes this app's access and nothing else: the Fidj
// session survives, which is what makes the next app free to enter. That is a
// good design and a bad surprise, so the notice says what actually happened and
// where the rest of it lives — on a shared computer the difference is the whole
// point.
let leftTheApp = false;
function banner() {
  if (!message) return "";
  const role = failed ? "alert" : "status";
  const kind = failed ? "error" : "notice";
  const finish = leftTheApp
    ? ` <a href="${escape(config.dashboardUrl)}/#/my/profile" target="_blank" rel="noopener">Sign out of Fidj too</a>`
    : "";
  return `<p role="${role}" class="${kind}">${escape(message)}${finish}</p>`;
}

// One navigation, in the app's own bar: past its mark and its name, past a
// rule, the way Fidj's console carries its own. It used to sit in the page
// under a bar that held only a name, which read as two headers for one app.
//
// Two tabs, because what this app holds about somebody and what they can do
// about it are one subject. Split across "My privacy" and "My account" it asked
// a person to look in two places for one answer — and the account they were
// looking for was the one named right here, which is why the tab says it.
//
// Signing out is not a place, so it is not a tab: it is a thing you do to an
// account, and it lives on that account's screen.
function appNav(current: "content" | "account") {
  const tab = (id: string, label: string, selected: boolean) =>
    `<button id="${id}"${selected ? ' class="selected" aria-current="page"' : ""}><span class="tab-label">${label}</span></button>`;
  const account = signedIn
    ? tab(
        "account-tab",
        accountEmail ? `Profile (${escape(accountEmail)})` : "Profile",
        current === "account",
      )
    : tab("account-tab", "Sign in", false);
  return tab("content-tab", "Content", current === "content") + account;
}

function profileSummary() {
  const publicUrl = `${config.dashboardUrl}/#/pub/${encodeURIComponent(config.appId)}`;
  const badgeUrl = `${config.apiEndpoint}/apps/${encodeURIComponent(config.appId)}/badge`;
  return `<header class="profile-summary"><div class="profile-summary-copy"><span class="eyebrow">Profile</span><strong>${escape(accountEmail)}</strong><span>${escape(config.title)}</span></div><a class="profile-public" href="${escape(publicUrl)}" target="_blank" rel="noopener"><img src="${escape(badgeUrl)}" alt="${escape(config.title)} public badge" width="133" height="20"></a><button id="exit" class="danger">Sign out</button></header>`;
}

// The bar belongs to the document, not to the screen being drawn: it survives
// every route change, so it is filled rather than rebuilt with the page.
function renderNav(current: "content" | "account") {
  const nav = element("app-nav");
  if (!nav) return;
  nav.innerHTML = appNav(current);
  nav.hidden = false;
  wireNav();
}

function wireNav() {
  element("content-tab")?.addEventListener("click", () => navigate("content"));
  element("account-tab")?.addEventListener("click", () =>
    navigate(signedIn ? "profile" : "signin"),
  );
}

// Leaving this app's session, from the screen that is about this app's session.
function wireSignOut() {
  element("exit")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        const wasSignedIn = signedIn;
        if (signedIn) {
          if (oidc?.hasSession()) await oidc.logout();
          else await sdk.logout(true);
        }
        forgetSignIn(config.appId);
        signedIn = false;
        anonymous = false;
        if (wasSignedIn) {
          leftTheApp = true;
          message = `Signed out of ${config.title}. You are still signed in to Fidj.`;
        }
        navigate("signin");
      }),
  );
}

async function request(path: string, method = "GET", data?: unknown) {
  const token = await sdk.fidjGetIdToken();
  const response = await fetch(config.apiEndpoint + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      signedIn = false;
      await sdk.logout(true);
    }
    throw new Error(result.message || result.status || "Please retry.");
  }
  return result;
}
async function refresh() {
  const membership = await request(
    `/apps/${encodeURIComponent(config.appId)}/me`,
  );
  roles = membership.roles.map((role: { type: string }) => role.type);
  [consent, history] = await Promise.all([
    request(appPath + "/consents"),
    request(appPath + "/consents/history").then((result) => result.history),
  ]);
  const me = (await request("/me")).user;
  emailVerified = me?.verified === true;
  signedIn = true;
  // The ID token of a code flow carries only the subject, by design, so the
  // address the entry can offer next time comes from the membership the app
  // just read — not from a claim it does not have.
  accountEmail = String(me?.poc?.email || me?.username || "");
  rememberSignIn(config.appId, accountEmail);
}
async function action(task: () => Promise<void>) {
  if (busy) return;
  busy = true;
  root.setAttribute("aria-busy", "true");
  root
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")
    .forEach((control) => {
      control.disabled = true;
    });
  // Whichever button was pressed, when the caller marked it. The entry has two
  // submit buttons now and only one of them is `.primary` first in the
  // document, so "Please wait…" kept landing on the Fidj door while the person
  // watched the button they had actually pressed sit there saying nothing.
  const submit =
    root.querySelector<HTMLButtonElement>("button[data-busy]") ||
    root.querySelector<HTMLButtonElement>("button.primary");
  if (submit) submit.textContent = "Please wait…";
  failed = false;
  if (initialized) {
    message = "";
    leftTheApp = false;
  }
  try {
    await task();
  } catch (error) {
    failed = true;
    const detail = error as {
      code?: number;
      reason?: unknown;
      message?: unknown;
    };
    if (detail.code === 429)
      message = "Too many attempts. Please wait before trying again.";
    else if (detail.message || detail.reason) {
      let reason: any = detail.message || detail.reason;
      try {
        if (typeof reason === "string") reason = JSON.parse(reason);
      } catch {}
      message =
        typeof reason === "string"
          ? reason
          : reason.message ||
            reason.status ||
            "The request could not be completed. Please retry.";
    } else
      message =
        error instanceof Error
          ? error.message
          : "The request could not be completed. Please retry.";
    if (
      /jwt expired|session revoked|session expired|token.*expired/i.test(
        message,
      )
    )
      message = "Your session has ended. Please sign in again.";
  } finally {
    busy = false;
    initialized = true;
    root.setAttribute("aria-busy", "false");
    render();
  }
}
// Taking the Fidj door, from inside the click that asked for it.
//
// The window has to exist before the authorization URL is fetched — building it
// costs a discovery round-trip, and a window opened after an await is one the
// browser no longer attributes to the click, which every popup blocker refuses.
// So it is opened empty first and sent somewhere second.
//
// The page that opens it is the page that finishes the sign-in: the PKCE
// transaction lives in this window's session storage, and a new window is given
// a copy of that storage rather than a share of it. The window it opened only
// carries the provider's answer back.
// The window this page is waiting on, while it is waiting on it.
let waitingFor: ProviderWindow | null = null;

// What the entry says while that window is open.
//
// `action` disables the screen and writes "Please wait…", which is right when
// the waiting happens here. This waiting happens somewhere else — in a window
// that can be behind this page, minimised, or on another desktop — and a
// disabled sentence is then a dead end in front of the only two things worth
// offering: the way back to that window, and the way out of it.
function offerTheWindowBack(providerWindow: ProviderWindow) {
  const waiting = root.querySelector<HTMLButtonElement>("button[data-busy]");
  if (!waiting) return;
  waiting.disabled = false;
  waiting.classList.add("is-waiting");
  // It says what is happening rather than what to do, because what to do is
  // happening in the other window. Dropping the accent is the point: this is a
  // state, not the way in. It stays pressable all the same — somebody who has
  // lost that window behind this page needs precisely this to be pressable.
  waiting.textContent = "Connecting with Fidj…";
  waiting.title = "Bring the Fidj window back to the front";
  // It is a submit button, and submitting would open a second window: the press
  // is being borrowed, so its default has to go.
  waiting.onclick = (event) => {
    event.preventDefault();
    providerWindow.focus();
  };
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.id = "cancel-provider";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  // Closing it is the whole answer: the window resolves to nothing, and the
  // entry is drawn again exactly as it was.
  cancel.onclick = () => {
    cancel.disabled = true;
    providerWindow.giveUp();
  };
  waiting.insertAdjacentElement("afterend", cancel);
}

// Being recognised by Fidj is not the same as having signed in here. An app's
// door writes the session the provider holds, and Fidj's own entry used to read
// none of it — so somebody who had just joined an app was asked for a password
// by the account provider itself, one screen later.
//
// `prompt=none` asks the provider to answer without showing anything: a code
// when it knows this browser, `login_required` when it does not. Those are
// exactly the two cases to tell apart, and neither costs a screen.
//
// Only where Fidj is the app. An app with a door of its own must keep it: taking
// that door is where the app's own agreement is asked and recorded, and signing
// somebody in around it would skip a decision they never made.
const RECOGNITION_ASKED = "fidj.oidc.recognition-asked";
// A page that is public is exactly where a session is not what somebody came
// for. Asking there sent an anonymous visitor to the provider and back, and what
// they had asked to read never rendered.
const PUBLIC_ROUTE = "pub";
// Whether the question is still outstanding. Drawing the credential form and
// then navigating to the provider loses whatever somebody had begun typing, so
// the entry waits instead — the answer takes one redirect, not a wait worth a
// spinner's worth of ceremony, and it says what it is doing.
let recognising = false;
function mightBeRecognised() {
  // Fidj itself, or an app this browser signed in to before: its session lives
  // in the tab, so a new tab would otherwise draw "Continue as …" for somebody
  // Fidj still recognises.
  if (!oidc || !(isFidjItself || signInHint(config.appId))) return false;
  if ((moduleRoute() || "").split("/")[0] === PUBLIC_ROUTE) return false;
  // Not on a screen somebody was sent to by a link.
  //
  // Asking the provider is a navigation: it leaves this address and comes back
  // at the redirect URI, without the hash the link carried. On these routes the
  // hash is the point — it holds a token that works once — so asking spent the
  // link and dropped the person on the entry, with nothing to show for having
  // opened their mail.
  //
  // It hid well. Every other way of reaching these screens comes from a page
  // that already asked once and recorded it below, and the ask is once per
  // document; only a tab that has never seen Fidj fires it here, which is
  // exactly the tab a mail client opens and the one nothing exercised.
  if (["forgot", "reset", "verify"].includes(currentRoute())) return false;
  if (oidc.signedOutHere()) return false;
  try {
    return sessionStorage.getItem(RECOGNITION_ASKED) !== "true";
  } catch {
    return false;
  }
}

async function askWhetherFidjKnowsThisBrowser() {
  if (
    !oidc ||
    !(isFidjItself || signInHint(config.appId)) ||
    sdk.isLoggedIn() ||
    oidc.signedOutHere()
  )
    return false;
  if ((moduleRoute() || "").split("/")[0] === PUBLIC_ROUTE) return false;
  // Not on a screen somebody was sent to by a link.
  //
  // Asking the provider is a navigation: it leaves this address and comes back
  // at the redirect URI, without the hash the link carried. On these routes the
  // hash is the point — it holds a token that works once — so asking spent the
  // link and dropped the person on the entry, with nothing to show for having
  // opened their mail.
  //
  // It hid well. Every other way of reaching these screens comes from a page
  // that already asked once and recorded it below, and the ask is once per
  // document; only a tab that has never seen Fidj fires it here, which is
  // exactly the tab a mail client opens and the one nothing exercised.
  if (["forgot", "reset", "verify"].includes(currentRoute())) return false;
  // Once per document: the answer comes back as a redirect to this same page,
  // so without this a refusal would ask again, and again.
  try {
    if (sessionStorage.getItem(RECOGNITION_ASKED) === "true") return false;
    sessionStorage.setItem(RECOGNITION_ASKED, "true");
  } catch {
    return false;
  }
  try {
    window.location.assign(await oidc.beginLogin({ silent: true }));
    return true;
  } catch {
    // No provider, or it would not say. The entry is still there to be used.
    return false;
  }
}

function signInThroughProvider(
  trigger: HTMLElement | null,
  options: { silent?: boolean; prompt?: string } = {},
) {
  if (!oidc) return;
  // Already open: bring that one back rather than start a second conversation
  // with the provider. Pressing the door again is what somebody does when the
  // window is behind the page, and it means "where did it go", not "again".
  if (waitingFor?.isOpen()) {
    waitingFor.focus();
    return;
  }
  const providerWindow = openProviderWindow();
  trigger?.setAttribute("data-busy", "true");
  void action(async () => {
    let url: string;
    try {
      // Being recognised again is the one thing somebody who has just signed
      // out did not ask for, and skipping this is what let a sign-out be undone
      // by pressing the door again: the provider still knew the browser and
      // answered with a code, no screen at all. Ending the provider session is
      // what should make that impossible, and that call can be refused — so the
      // door asks rather than assumes, until somebody signs in again.
      url = await oidc.beginLogin(
        options.prompt || options.silent || !oidc.signedOutHere()
          ? options
          : {...options, prompt: "login"},
      );
    } catch (error) {
      providerWindow?.giveUp();
      throw error;
    }
    // No window to put it in — blocked, or a browser that would not open one.
    // Leaving this page is the flow this one replaced, and it still works.
    if (!providerWindow) {
      window.location.assign(url);
      return;
    }
    providerWindow.show(url);
    waitingFor = providerWindow;
    offerTheWindowBack(providerWindow);
    const callback = await providerWindow.answer().finally(() => {
      waitingFor = null;
    });
    // Closed by hand. That is an answer too, and the entry simply comes back as
    // it was — a person who changed their mind is not owed an error.
    if (!callback) return;
    await oidc.completeLogin(callback);
    try {
      sessionStorage.removeItem("fidj.interaction.email");
    } catch {}
    await refresh();
    anonymous = false;
    navigate("content");
  });
}
// A person moving between screens is making history, so push an entry: Back has
// to return to the screen before, not to whatever preceded the application.
// Replacing is right everywhere else in this file — stripping a single-use token
// out of the address, correcting a route the person did not choose, and clearing
// the sign-in callback — because none of those is a place they navigated to.
function navigate(route: string) {
  if (route !== currentRoute()) window.history.pushState(null, "", "#/" + route);
  if (!busy) render();
}

function moduleRoute() {
  const route = window.location.hash.slice(2).split("?")[0];
  if (
    !config.moduleEntry ||
    !route ||
    ["signin", "content", "privacy", ...accountRoutes].includes(route)
  )
    return null;
  return route;
}
// The mounted app starts inside this document, at this address. It used to be a
// second document under /module/, which put a generator word in the address bar
// and reloaded the page in the middle of signing in. Starting it here costs one
// insertion and is not undone: the app owns the document from then on, and
// leaving it (signing out) reloads the shell from its own address.
let moduleStarted = false;
function startModule() {
  if (moduleStarted) return;
  const mount = config.moduleMount as unknown as {
    styles: string[];
    scripts: Array<{ src: string; module: boolean }>;
    markup: string;
  } | null;
  if (!mount) return;
  moduleStarted = true;
  document.body.classList.add("has-module");
  // The app takes the whole document, not a corner of the shell's. A built
  // single-page app positions itself against the body — Ionic, for one, fixes
  // the body and scrolls inside its own container — so leaving the shell's
  // header and <main> wrapper around it produces a page that cannot scroll and
  // a second header above its own.
  document.body.replaceChildren(
    new Range().createContextualFragment(mount.markup),
  );
  for (const href of mount.styles) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  for (const script of mount.scripts) {
    const element = document.createElement("script");
    if (script.module) element.type = "module";
    // A script created here carries async = true by default, so these execute
    // in whatever order the network returns them. An app's polyfills have to
    // run before its entry point — Angular boots without Zone.js otherwise,
    // throws NG0908 and paints nothing, which reaches the person as a blank
    // page, intermittently, with nothing said. Clearing it restores the order
    // they were inserted in, which is the order the app's own document had.
    element.async = false;
    element.src = script.src;
    document.body.appendChild(element);
  }
}
function render() {
  // Leaving the provider's screen is a hash change, and a hash change does not
  // reload the document: without this the shell kept its interaction state and
  // drew that screen again over an address that no longer named one — the
  // person asked to leave and stayed put.
  if (interactionId && !addressedInteraction()) {
    interactionId = "";
    interactionError = "";
    interactionResent = false;
    interactionNotYet = false;
    interaction = null;
    interactionFailed = false;
  }
  // Once the mounted app owns the document the shell cannot draw over it, and
  // its own router will try to match addresses that were never its business.
  // So any address it does not own means starting the document again — checked
  // first, because every later branch writes into an element that is gone.
  if (moduleStarted && !moduleRoute()) {
    window.location.reload();
    return;
  }
  // The provider handed this person here to answer a question. Nothing else
  // this app might want to show belongs on the screen until they have — the
  // shell's own header and page margins included: chrome that says "you are
  // inside the console" reads as furniture from the wrong room above a question
  // about whether you are anyone at all. Same class the shell's other
  // standalone screens use, so one rule keeps covering them all.
  if (interactionId) {
    document.body.classList.add("signin-view");
    if (interactionFailed) {
      root.innerHTML = `<section class="card"><p role="alert" class="error">${escape(message)}</p><p><a href="#/signin">Back to sign in</a></p></section>`;
      return;
    }
    if (!interaction) {
      root.innerHTML = '<p role="status">Loading…</p>';
      return;
    }
    interactionScreen();
    return;
  }
  // Which of its routes need a session is the mounted app's business, not the
  // shell's: Fidj's own console serves /pub to anyone, and every app that needs
  // one revalidates it for itself. So any address the shell does not own is
  // handed over as it stands — before the shell asks the API who this is, not
  // after. Waiting cost several seconds of "Loading your session…" on an address
  // the shell was never going to draw: a token refresh and three round trips ran
  // to completion before a quarter of a megabyte of application even began
  // downloading. Nothing in that answer decides anything here.
  if (moduleRoute()) {
    startModule();
    return;
  }
  if (!initialized) {
    root.innerHTML = '<p role="status">Loading your session…</p>';
    return;
  }
  let route = currentRoute();
  if (
    !signedIn &&
    !(config.allowAnonymous && anonymous) &&
    !["forgot", "reset", "verify"].includes(route)
  )
    route = "signin";
  else if (!["signin", "content", "privacy", ...accountRoutes].includes(route))
    route = "content";
  // The privacy screen and the profile screen became one. The address that
  // named the first still means something to anyone who bookmarked it, so it
  // arrives where that screen went rather than nowhere.
  if (route === "privacy") route = signedIn ? "profile" : "signin";
  window.history.replaceState(null, "", "#/" + route);
  // Profile is a signed-in screen and keeps the app's chrome. Recovery and
  // verification are reached without a session, so they stand alone.
  const standaloneAccount =
    accountRoutes.includes(route) && !(route === "profile" && signedIn);
  document.body.classList.toggle(
    "signin-view",
    route === "signin" || standaloneAccount,
  );
  // The bar belongs to the document and outlives the screen, so it has to be
  // emptied rather than left standing: a sign-out that only redrew the page
  // left the address of the person who had just gone still written across the
  // top — hidden on the entry, and still in the document for anything that
  // reads it. The screens that want it fill it again a moment later.
  const bar = element("app-nav");
  if (bar) {
    bar.innerHTML = "";
    bar.hidden = true;
  }
  if (standaloneAccount) {
    renderAccount(route);
    return;
  }
  if (route === "profile") {
    // The two ways out, last and together: back to the app, or out of this
    // session. Leaving the app itself is a different decision and stays where
    // the things it erases are listed.
    root.innerHTML = `<section class="content-account">${profileSummary()}<div class="card profile-body">${banner()}${emailVerified ? accountRows() : accountForm("account", {linkToken, verificationConfirmed, emailVerified, accountEmail}, {compact: true})}${privacyBlock()}</div></section>`;
    renderNav("account");
    wireAccount("account");
    wireSignOut();
    wirePrivacy();
    return;
  }
  if (route === "content" && config.moduleEntry) {
    root.innerHTML = '<p role="status">Opening your app…</p>';
    window.location.assign(config.moduleEntry);
    return;
  }
  if (route === "content") {
    root.innerHTML = element<HTMLTemplateElement>("public-content")!.innerHTML;
    renderNav("content");
    return;
  }
  if (recognising) {
    root.innerHTML = `<section class="signin-shell"><div class="signin-form"><p role="status">Checking whether you are already signed in to Fidj…</p></div></section>`;
    return;
  }
  // Only the entry reaches here now: the privacy screen and the account
  // screen became one, and that one is drawn above.
  root.innerHTML = `<section class="signin-shell"><div class="signin-intro${config.highlights?.length ? "" : " is-plain"}">${masthead(config.logo, config.title)}
  <div class="signin-identity"><h1>${escape(config.welcome)}</h1><p class="signin-description">${escape(config.description)}</p></div>
  ${highlightCells(config.highlights)}</div>
  <div class="signin-form"><div>${banner()}<h2>Sign in to ${escape(config.title)}</h2><form id="signin">${credentialFields({email: signInEmail, password: signInPassword}, {passkey: passkeyHere})}</form>${config.allowAnonymous ? `<div class="signin-divider"><span>or explore first</span></div><button class="anonymous-entry" id="anonymous">Enter anonymously <span aria-hidden="true">→</span></button><p class="signin-footnote">No account needed to view the content.</p>` : ""}
  ${config.title === "Fidj" ? walletDoor() : `<div class="signin-trust"><p class="signin-trust-head"><img class="signin-logo" src="./fidj-logo.png" alt="Fidj"><strong>Your account, with Fidj</strong></p><p>Signing in creates one Fidj account you keep across every app that uses Fidj.</p><p>You choose what this app may store — and can export or erase it at any moment.</p></div>`}</div>
  ${badgeStrip(config.badges)}</div></section>`;
  wireNav();
  element("anonymous")?.addEventListener("click", () => {
    if (!config.allowAnonymous) return;
    anonymous = true;
    navigate("content");
  });
  // A remembered address is how the entry offers "Continue as <them>". Every
  // sign-out this shell owns forgets it, because on a shared computer still
  // being offered by name after leaving is the whole difference. A console that
  // signs out through the SDK takes another path and forgot nothing, so the
  // entry kept offering somebody who had left — the SDK records that this
  // browser asked to be signed out, and that is the same statement.
  if (oidc?.signedOutHere()) forgetSignIn(config.appId);
  if (oidc && element("signin"))
    element("signin")!.innerHTML = providerEntry(
      config.title,
      config.appId,
      config.signin === "button"
        ? ""
        : credentialFields({email: signInEmail, password: signInPassword}, {passkey: passkeyHere}),
      isFidjItself,
      config.signin as SigninShape,
    );
  // The agreement, when the API has said this app is owed one. It takes the
  // form's place rather than sitting under it: the credentials were accepted,
  // and what is left is a decision about this app.
  if (pendingAgreement && element("signin")) {
    element("signin")!.innerHTML = agreementScreen(config.title, pendingAgreement, `${config.apiEndpoint}/apps/${encodeURIComponent(config.appId)}/agreements/${encodeURIComponent(pendingAgreement.version || "")}`);
    bindAgreementScreen(element<HTMLFormElement>("signin"));
  }
  // The app's own form, for whoever came to type a password. Folded away rather
  // than removed: the door above it is the one to take, and the person who
  // wants this one is one click from it.
  if (!pendingAgreement && emailEntryOpen) showEmailEntry(true);
  if (!pendingAgreement && element("signin")) bindPasswordReveal(element("signin")!);
  element("use-email")?.addEventListener("click", () => {
    emailEntryOpen = !emailEntryOpen;
    showEmailEntry(emailEntryOpen, true);
  });

  // Forgetting the address it remembered and handing the person back to a
  // session it never ended would recognise them again: the offer has to reach
  // the provider, not just this browser's memory. Asking for re-authentication
  // is how it says so, and the provider reads it as this person saying they are
  // not the one it knows — it ends that session when it hands the screen over,
  // so walking away from the form does not hand the old face back.
  element("forget-hint")?.addEventListener("click", (event) => {
    forgetSignIn(config.appId);
    if (oidc) {
      signInThroughProvider(event.currentTarget as HTMLElement, {prompt: "login"});
      return;
    }
    render();
  });
  // The wait a just-created account owes its address, under the form that
  // created it — not a screen, because nobody was taken anywhere.
  if (awaitingVerification)
    element("signin")?.insertAdjacentHTML(
      "beforeend",
      verificationWait({
        email: awaitingVerification,
        resent: verificationResent,
        error: verificationNotice,
      }),
    );
  element("resend-verification")?.addEventListener("click", () =>
    void action(async () => {
      verificationResent = false;
      verificationNotice = "";
      try {
        await sdk.resendVerification();
        verificationResent = true;
      } catch {
        // No session yet — the account was created and never signed in, which
        // is the whole point of this screen. Creating it again with the same
        // address is what sends another link.
        verificationNotice =
          "Press Create an account again to send another link.";
      }
    }),
  );
  element<HTMLFormElement>("signin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = element<HTMLInputElement>("email")?.value || "";
    const password = element<HTMLInputElement>("password")?.value || "";
    const submitter = event.submitter as HTMLButtonElement | null;
    // Answering the agreement screen. The credentials are the ones already
    // accepted, so they are not re-read from a form that no longer shows them.
    if (pendingAgreement) {
      const acceptance = acceptedAgreement(
        event.currentTarget as HTMLFormElement,
      );
      if (!acceptance) return;
      submitter?.setAttribute("data-busy", "true");
      void action(async () => {
        // A passkey sign-in has no password to send again: the agreement is
        // accepted with a second touch of the same passkey.
        const refused = signedInWithPasskey
          ? await refusedBeforePasskey(acceptance)
          : await refusedBeforeSignIn(signInEmail, signInPassword, false, acceptance);
        if (refused) return;
        await completeSignIn();
      });
      return;
    }
    // The first door (v3): the passkey, with nothing typed.
    if (submitter?.name === "entry" && submitter.value === "passkey") {
      submitter.setAttribute("data-busy", "true");
      void action(async () => {
        if (await refusedBeforePasskey()) return;
        await completeSignIn();
      });
      return;
    }
    signInEmail = email;
    signInPassword = password;
    const signup = submitter?.name === "signup";
    // Which door was used. The Fidj one leaves for the provider; the credential
    // one signs in here, which is why it is the app's own form and not Fidj's.
    const throughFidj = submitter?.name === "entry" && submitter.value === "fidj";
    if (oidc && throughFidj) {
      // "Continue as <them>" promises to carry on as that person, and handed
      // them over to an empty email field — so the promise cost a second
      // typing of the address it had just shown. The screen prefills from
      // this, and nothing was writing it.
      try {
        const remembered = signInHint(config.appId);
        if (remembered) sessionStorage.setItem("fidj.interaction.email", remembered);
      } catch {}
      signInThroughProvider(submitter);
      return;
    }
    submitter?.setAttribute("data-busy", "true");
    void action(async () => {
      if (oidc && (!email || !password)) {
        throw new Error("Enter your email and password, or sign in with Fidj.");
      }
      if (await refusedBeforeSignIn(email, password, signup)) return;
      await completeSignIn();
    });
  });
}

// The API decides what the entry owes somebody next: a session, the agreement it
// has not recorded for this app, or a wait on an address nobody has proved they
// own. Returns true when it answered with a screen rather than a session.
async function refusedBeforeSignIn(
  email: string,
  password: string,
  signup: boolean,
  acceptance?: {termsAccepted: boolean; termsVersion: string},
): Promise<boolean> {
  signedInWithPasskey = false;
  try {
    await sdk.login(email, password, {autoSignup: signup, ...acceptance});
    pendingAgreement = null;
    awaitingVerification = "";
    return false;
  } catch (error) {
    const created = verificationPending(error);
    if (created) {
      awaitingVerification = created.email || email;
      verificationResent = false;
      verificationNotice = "";
      return true;
    }
    if (agreementRequired(error)) {
      pendingAgreement = agreementFromRefusal(error) || (await readAgreement());
      if (!pendingAgreement) {
        throw new Error("We cannot reach Fidj right now. Please try again.");
      }
      return true;
    }
    throw new Error(signInErrorMessage(error));
  }
}

// The same answers as a password sign-in, from a passkey: the browser runs the
// ceremony against Fidj's challenge, and the SDK trades the answer for tokens.
async function refusedBeforePasskey(
  acceptance?: {termsAccepted: boolean; termsVersion: string},
): Promise<boolean> {
  signedInWithPasskey = true;
  try {
    const {options, ticket} = await sdk.passkeyLoginOptions();
    const response = await passkeyAssertion(options);
    await sdk.loginWithPasskey(ticket, response, acceptance);
    pendingAgreement = null;
    awaitingVerification = "";
    return false;
  } catch (error) {
    if (agreementRequired(error)) {
      pendingAgreement = agreementFromRefusal(error) || (await readAgreement());
      if (!pendingAgreement) {
        throw new Error("We cannot reach Fidj right now. Please try again.");
      }
      return true;
    }
    if ((error as any)?.name === "NotAllowedError") {
      throw new Error("No passkey was used. Try again, or sign in with your email.");
    }
    throw new Error(signInErrorMessage(error));
  }
}

// An API that refused without saying which agreement it wanted. Older ones
// cannot say, so the app is asked directly; it is the same agreement unless the
// owner published between the two calls.
async function readAgreement() {
  try {
    const response = await fetch(
      `${config.apiEndpoint}/apps/${encodeURIComponent(config.appId)}`,
      {signal: AbortSignal.timeout(10000)},
    );
    if (!response.ok) return null;
    const agreement = (await response.json()).app?.agreement;
    return typeof agreement?.version === "string" &&
      agreement.version &&
      typeof agreement?.text === "string" &&
      agreement.text
      ? {version: agreement.version, text: agreement.text}
      : null;
  } catch {
    return null;
  }
}

function completeSignIn() {
  return (async () => {
      // Fidj collects the credential on its own page rather than sending itself
      // through its own door, and that sign-in created no session the provider
      // could see: the first app opened afterwards asked for the password again,
      // by the account provider itself. This turns the sign-in the API has just
      // verified into the session every other app is recognised by. Only Fidj
      // asks — the API refuses any other app, because a session that speaks for
      // every app must not be mintable by one that collects its own passwords.
      if (isFidjItself) {
        try {
          const transfer = await request("/me/oidc/session-transfer", "POST");
          // The provider cookie belongs to the API origin. A cross-site fetch
          // cannot reliably replace it, so let that origin answer once as the
          // top-level page, consume a one-use ticket, then send us back here.
          window.location.assign(transfer.location);
          return;
        } catch {
          // Being signed in here still worked. The person is inside Fidj; what
          // they lose is being recognised by the next app without typing again,
          // and that is not worth refusing them the console over.
        }
      }
      await refresh();
      anonymous = false;
    // A new account belongs where a returning one lands: inside the app.
    // Sending it to the account card instead dropped people who had just
    // signed up on the shell, one click short of the app they came for.
    navigate("content");
  })();
}

// Everything the account screen lets a person do about what this app holds:
// the roles it reads, the agreement, the optional choices, the export and
// the way out of the app itself.
function wirePrivacy() {
  element("refresh")?.addEventListener("click", () => void action(refresh));
  element("signout")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await sdk.logout(true);
        forgetSignIn(config.appId);
        signedIn = false;
        anonymous = false;
        leftTheApp = true;
        message = `Signed out of ${config.title}. You are still signed in to Fidj.`;
        navigate("signin");
      }),
  );
  element("terms")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        // The version published now is the version recorded.
        const agreement = await readAgreement();
        await request(appPath + "/consents", "PUT", {
          terms: true,
          ...(agreement ? {cguVersion: agreement.version} : {}),
          source: "profile",
        });
        await refresh();
      }),
  );
  root.querySelectorAll<HTMLInputElement>("[data-purpose]").forEach((input) =>
    input.addEventListener(
      "change",
      () =>
        void action(async () => {
          await request(appPath + "/consents", "PUT", {
            [input.dataset.purpose!]: input.checked,
            source: "profile",
          });
          await refresh();
          message = "Saved for this app.";
        }),
    ),
  );
  element("export")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        const data = await request(appPath + "/export");
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${config.appId}-my-data.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        message = "Export downloaded.";
      }),
  );
  element("leave")?.addEventListener("click", () => {
    leaving = true;
    render();
  });
  element("cancel-leave")?.addEventListener("click", () => {
    leaving = false;
    render();
  });
  element("confirm-leave")?.addEventListener("click", () => {
    void action(async () => {
      const result = await request(appPath, "DELETE", {
        confirm: config.appId,
      });
      await sdk.logout(true);
      signedIn = false;
      anonymous = false;
      leaving = false;
      message =
        result.status === "pending"
          ? "Access revoked. Storage cleanup is pending; contact the app owner."
          : "You left this app. Your other memberships remain available.";
    });
  });
}



// What this app holds about the person signed in, and what they can do
// about it. It used to be a screen of its own called My privacy, one tab
// away from the account it was about — so a person looking for their own
// data had two places to try and no way to tell which.
// The account, once there is nothing left to verify: one line, and the way to
// change it, which is on Fidj — the account is Fidj's, not this app's.
function accountRows() {
  return `<div class="member-rows"><div class="member-row"><div><strong>Email</strong><small>${escape(accountEmail)} · verified</small></div><a href="${escape(config.dashboardUrl)}/#/my/profile" target="_blank" rel="noopener noreferrer">Manage on Fidj ↗</a></div></div>`;
}

function privacyBlock() {
  const acceptedVersion = String((consent as Record<string, unknown>).termsVersion || "");
  const agreementHref = `${config.apiEndpoint}/apps/${encodeURIComponent(config.appId)}/agreements/${encodeURIComponent(acceptedVersion)}`;
  const agreementRow = consent.terms
    ? `<div class="member-row"><div><strong>Service agreement</strong>${acceptedVersion ? `<a class="basis" href="${escape(agreementHref)}" target="_blank" rel="noopener noreferrer">Contract · agreement ${escape(acceptedVersion)} ↗</a>` : '<span class="basis">Contract</span>'}</div><small class="nosw">Part of the service. To stop it, leave the app.</small></div>`
    : '<div class="member-row"><div><strong>Service agreement</strong><small>Not accepted yet — accept it or leave the app.</small></div><button id="terms" class="primary">Accept</button></div>';
  const choices = optionalPurposes
    .map(
      (purpose) =>
        `<label class="member-row" for="purpose-${purpose.key}"><div><strong>${escape(purpose.title)}</strong><small>${escape(purpose.description)}</small><span class="basis consent">Consent</span></div><span class="switch"><input type="checkbox" role="switch" id="purpose-${purpose.key}" data-purpose="${purpose.key}" ${consent[purpose.key] ? "checked" : ""}><span class="switch-state" aria-hidden="true">${consent[purpose.key] ? "On" : "Off"}</span></span></label>`,
    )
    .join("");
  const entries = history.length
    ? history
        .slice()
        .reverse()
        .map(
          (entry) =>
            `<p>${escape(formatDate(entry.changedAt, "datetime"))} · ${escape(entry.type)} ${entry.granted ? "given" : "withdrawn"}</p>`,
        )
        .join("")
    : "<p>No changes yet.</p>";
  const leave = roles.includes("Owner")
    ? "<small>You own this app: hand it over or delete it on Fidj before leaving.</small>"
    : leaving
      ? '<p>Your membership and what this app holds for you will be erased. Your other apps remain available.</p><button id="confirm-leave" class="danger">Leave &amp; erase</button><button id="cancel-leave">Keep my membership</button>'
      : '<button id="leave" class="danger">Leave &amp; erase</button>';
  return `<h2>Your membership</h2><div class="member-rows">${agreementRow}${choices}</div>
  <details class="member-history"><summary>History</summary>${entries}</details>
  <div class="member-actions"><button id="export">Export</button>${leave}</div>
  <p class="leaving"><a href="${escape(config.dashboardUrl)}/#/my/gdpr" target="_blank" rel="noopener noreferrer">Open Fidj to manage every app you use ↗</a></p>`;
}

// ------------------------------------------------ signing in, for the provider
//
// When Fidj's provider needs a person to identify themselves it hands them to a
// Fidj front end — this one — rather than serving a page of its own. So this
// screen belongs to the provider's conversation, not to this app's: it says who
// is asking, collects what is being asked for, and posts it straight back.
//
// The post is a real form navigation, not a fetch: the provider answers with a
// redirect that carries the person onward through the authorization, and only a
// navigation can follow it. The single-use token comes from the context call,
// which is the only thing that reads the interaction cookie.
type Interaction = {
  prompt: string;
  csrf: string;
  // The address this interaction is waiting on, when it is waiting rather than
  // asking. Empty on every other screen.
  awaiting?: string;
  app: { id: string; title: string; description: string };
  scopes: string[];
  termsUri: string;
  privacyUri: string;
  agreement?: {version: string; text: string} | null;
  // Who the consent screen recognises, as the provider names them.
  recognisedEmail?: string;
  // The passkey door's challenge, on the login step.
  passkey?: {ticket: string; options: unknown};
  action: string;
};
let interactionId = "";
let interactionError = "";
// Whether the link was just sent again, or pressed Continue before opening it.
// They are about the wait, not about the person, so they travel in the address
// where the address itself does not.
let interactionResent = false;
let interactionNotYet = false;
let interaction: Interaction | null = null;
let interactionFailed = false;

const scopeMeaning: Record<string, string> = {
  openid: "An identity specific to this app",
  profile: "Your display name",
  email: "Your email and verification status",
  offline_access: "Stay signed in",
  "fidj:api": "Use Fidj account and privacy services for this app",
};

const refusals: Record<string, string> = {
  credentials: "We could not sign you in. Check your email and password.",
  signup:
    "Could not create an account. Use a valid email and a password of at least 12 characters, or sign in to your existing account.",
  agreement: "Accept the app's service agreement to continue.",
  refused: "That could not be completed. Please try again.",
};

// Fidj's own front end, told apart by the one fact it already carries: the
// dashboard it points people to is itself. "Sign in with Fidj" is the right
// label on an app that is not Fidj; here it names a provider the person is
// standing in, so the door says only "Sign in".
//
// It used to hand the person straight to the provider on load, without waiting
// for a click, because the provider had a page and this screen did not. Now the
// provider opens in a window instead — and a window nobody asked for is a
// window the browser blocks. So Fidj's entry waits to be pressed, like every
// other app's, and the three doors finally behave the same way.
const isFidjItself = (() => {
  try {
    return new URL(config.dashboardUrl).origin === window.location.origin;
  } catch {
    return false;
  }
})();
function addressedInteraction() {
  const query = window.location.hash.slice(2).split("?")[1] || "";
  return new URLSearchParams(query).get("interaction") || "";
}

function readInteraction() {
  const query = window.location.hash.slice(2).split("?")[1] || "";
  const parameters = new URLSearchParams(query);
  const uid = parameters.get("interaction") || "";
  if (!uid) return false;
  interactionId = uid;
  interactionError = parameters.get("error") || "";
  interactionResent = parameters.get("resent") === "1";
  interactionNotYet = parameters.get("notyet") === "1";
  // The id stays in the address while the screen is up. Taking it out looked
  // tidier and made the screen a trap: the address became "#/signin", so going
  // back to "#/signin" changed nothing, the document never reloaded, and the
  // person stayed on a screen they had asked to leave. It is single-use, it is
  // where the provider put it, and the form navigates away from it.
  return true;
}

async function loadInteraction() {
  const endpoint = new URL(
    `/oidc/interaction/${encodeURIComponent(interactionId)}/context`,
    config.apiEndpoint,
  );
  const response = await fetch(endpoint.href, {
    credentials: "include",
    headers: {Accept: "application/json"},
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("This sign-in has expired. Start again from the app.");
  interaction = (await response.json()) as Interaction;
}


// What the wait has to say beyond the address, if anything.
function interactionWaitNotice() {
  if (interactionNotYet)
    return '<p class="fineprint">The link has not been opened yet. Open it, then press Continue again.</p>';
  if (interactionResent)
    return '<p class="fineprint">The link was sent again. Only the newest one works.</p>';
  return "";
}

function interactionScreen() {
  const details = interaction!;
  const action = new URL(details.action, config.apiEndpoint).href;
  // A refusal comes back as a redirect, so the typed address would be lost —
  // and retyping an address is the part a person gets wrong twice. It is kept
  // in this browser, never in the address: nothing about them travels in a URL.
  let typed = "";
  try {
    typed = sessionStorage.getItem("fidj.interaction.email") || "";
  } catch {}
  // The provider's own screen, drawn here: the same markup and the same scoped
  // styles as the page it serves itself. This window was opened by an app for
  // one question, so nothing of this front end's own sign-in page — masthead,
  // promises, "What Fidj is" — is drawn around it. The wait is not a refusal
  // and is not drawn as one: its address comes from the interaction's context,
  // never from the URL.
  const mode = details.awaiting ? "waiting" : details.prompt === "login" ? "login" : "consent";
  root.innerHTML = `<style>${oidcInteractionStyles}</style>${oidcInteractionMarkup({
    mode,
    appTitle: details.app.title,
    action,
    csrf: details.csrf,
    notice: interactionError ? refusals[interactionError] || refusals.refused : undefined,
    email: typed,
    forgotHref: `${config.dashboardUrl}/#/forgot`,
    waitingEmail: details.awaiting,
    resent: interactionResent,
    notYet: interactionNotYet,
    scopes: details.scopes.filter((scope) => scopeMeaning[scope]).map((scope) => scopeMeaning[scope]),
    agreement: details.agreement || undefined,
    // The agreement is a document read in the browser, like the privacy notice.
    agreementHref: details.termsUri || undefined,
    recognisedEmail: details.recognisedEmail || undefined,
    passkey: details.passkey,
    logoSrc: "./fidj-logo.png",
  })}`;
  bindOidcInteraction(root);
  // Being recognised is the point, and a dead end when the person is not who
  // Fidj thinks — a shared computer, a second account, somebody else's tab. So
  // the screen that recognises them asks again on request. It goes back to the
  // provider as this form's own answer, because only the provider can end the
  // session doing the recognising: starting a fresh request with prompt=login
  // from here asked once and left that session standing, so the back button,
  // a reload, or the app's door again met the same face.
  root.querySelector('button[value="switch"]')?.addEventListener("click", () => {
    forgetSignIn(config.appId);
    try {
      sessionStorage.removeItem("fidj.interaction.email");
    } catch {}
  });
  element("interaction")?.addEventListener("submit", () => {
    const address = element<HTMLInputElement>("email")?.value || "";
    try {
      if (address) sessionStorage.setItem("fidj.interaction.email", address);
      else sessionStorage.removeItem("fidj.interaction.email");
    } catch {}
  });
}

function renderAccount(route: string) {
  root.innerHTML = `<section class="signin-shell"><div class="signin-intro is-plain">${masthead(config.logo, config.title)}
  <div class="signin-identity"><h1>Your account.<br>Your control.</h1><p class="signin-description">Secure access to the apps you use, with one Fidj identity.</p></div>
  </div>
  <div class="signin-form"><div>${banner()}${accountForm(route, {linkToken, verificationConfirmed, emailVerified, accountEmail})}</div><footer class="signin-badges"><a href="#/signin">Back to sign in</a></footer></div></section>`;
  bindPasswordReveal(root);
  wireAccount(route);
}

function wireAccount(route: string) {
  element("continue-app")?.addEventListener("click", () => navigate("content"));
  element("check-verification")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        const result = await request("/me");
        emailVerified = result.user?.verified === true;
        message = emailVerified
          ? "Your email address is verified."
          : "Your email is not verified yet. Request a verification email below.";
      }),
  );
  element("resend-verification")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await sdk.resendVerification();
        message =
          "Verification email sent. Open the link and confirm your address. If it does not arrive, check your spam folder.";
      }),
  );
  element<HTMLFormElement>("recovery")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = element<HTMLInputElement>("recovery-email")?.value || "";
    const password = element<HTMLInputElement>("new-password")?.value || "";
    const confirmation =
      element<HTMLInputElement>("confirm-password")?.value || "";
    void action(async () => {
      if (route === "forgot") {
        await sdk.fidjForgotPasswordRequest(email);
        message =
          "If an account matches that email, a reset link is on its way. Check your inbox and spam folder.";
      } else if (route === "reset") {
        if (password !== confirmation)
          throw new Error("The passwords do not match.");
        if (new TextEncoder().encode(password).length > 72)
          throw new Error(
            "Use a shorter password: the limit is 72 UTF-8 bytes.",
          );
        await sdk.resetPassword({ token: linkToken, password });
        linkToken = "";
        signedIn = false;
        anonymous = false;
        message =
          "Your password has been changed. Sign in with your new password.";
        navigate("signin");
      } else {
        await sdk.verifyEmail({ token: linkToken });
        verificationConfirmed = true;
        linkToken = "";
        message =
          "Your email address is now verified. You can return to your app.";
      }
    });
  });
}
// This document is the window the entry opened, and the provider has just
// answered into it. Its only job left is to hand that answer to the page that
// opened it and get out of the way — never to complete the sign-in, because the
// transaction the answer has to match belongs to that other page.
if (relayProviderAnswer()) {
  root.innerHTML = '<p role="status">Signing you in…</p>';
  // A window the browser will not close is not a window that was scripted open,
  // so this is an ordinary return from the provider after all. Finish it here
  // rather than leave somebody looking at one sentence forever.
  window.setTimeout(() => {
    if (!window.closed) boot();
  }, 800);
} else {
  boot();
}

function boot() {
  window.addEventListener("hashchange", render);
  recognising = mightBeRecognised();
  render();
  if (readInteraction()) {
    render();
    void loadInteraction()
      .catch((error) => {
        interactionFailed = true;
        failed = true;
        message =
          error instanceof Error
            ? error.message
            : "This sign-in could not be loaded. Start again from the app.";
      })
      .finally(render);
  }
  void action(async () => {
    if (interactionId) return;
    if (oidc && new URL(window.location.href).searchParams.has("state")) {
      const callback = new URL(window.location.href);
      window.history.replaceState(null, "", window.location.pathname + "#/content");
      try {
        await oidc.completeLogin(callback);
      } catch (refusal) {
        const why = (refusal as {code?: string; silentRefusal?: boolean}) || {};
        // A silent question answered "no" is an answer, not a failure. But the
        // two ways of saying no mean opposite things here.
        //
        // `login_required` — the provider does not know this browser, and the
        // entry is the right next screen.
        //
        // `consent_required` — it knows exactly who this is; what it has not got
        // is this client's permission, because the account was made through
        // another app and Fidj's console is a client of its own. Asking again
        // without `prompt=none` gets the screen that collects it, and no
        // password: the person already typed theirs once.
        if (why.code === "consent_required") {
          window.location.assign(await oidc.beginLogin());
          return;
        }
        if (!why.silentRefusal) throw refusal;
      }
      try {
        sessionStorage.removeItem("fidj.interaction.email");
      } catch {}
    }
    await sdk.init(config.appId, {
      apiEndpoint: config.apiEndpoint,
      prod: !config.localDemo,
    });
    recognising = recognising && !sdk.isLoggedIn();
    if (sdk.isLoggedIn()) {
      await refresh();
      if (!moduleRoute() && !accountRoutes.includes(currentRoute()))
        navigate("content");
      return;
    }
    // Nothing held here. Fidj may still know this browser from an app.
    if (await askWhetherFidjKnowsThisBrowser()) return;
    recognising = false;
    render();
  });
}
