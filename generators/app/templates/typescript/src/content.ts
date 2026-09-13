import {agreementMarkup, bindAgreement, acceptedAgreement, signInErrorMessage, providerEntry, rememberSignIn, forgetSignIn} from "./service-agreement";
import { FidjNodeService, FidjOidcClient } from "@ofidj/node";
import config from "../app.config.json";
import "./style.css";
import { showVersionBadge } from "./version";

const sdk = new FidjNodeService();
const oidc = config.oidcIssuer ? new FidjOidcClient({issuer: config.oidcIssuer, clientId: config.appId, redirectUri: window.location.origin + window.location.pathname, apiEndpoint: config.apiEndpoint, storage: sessionStorage}) : null;
const root = document.querySelector<HTMLDivElement>("#app")!;
showVersionBadge(config.releaseVersion, config.title === "Fidj" ? config.apiEndpoint : undefined);
const appPath = `/me/apps/${encodeURIComponent(config.appId)}`;
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
let signInAgreementAccepted = false;
const accountRoutes = ["forgot", "reset", "verify", "account"];
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
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;
function badges() {
  const entries: string[] = config.badges;
  if (!entries?.length) return "";
  return `<footer class="signin-badges">${entries
    .map((entry) => `<span>${escape(entry)}</span>`)
    .join("")}</footer>`;
}
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

// One navigation bar for every in-app screen, so signing out stays one click
// away wherever you are. The sign-in entry and the pre-authentication account
// screens are full-bleed and carry none.
function appNav(current: "content" | "privacy" | "account") {
  const tab = (id: string, label: string, selected: boolean) =>
    `<button id="${id}"${selected ? ' class="selected" aria-current="page"' : ""}>${label}</button>`;
  return `<nav class="content-nav" aria-label="App navigation">${tab("content-tab", "Content", current === "content")}${tab("privacy-tab", signedIn ? "My privacy" : "Sign in", current === "privacy")}${signedIn ? tab("account-tab", "My account", current === "account") : ""}${tab("exit", signedIn ? "Sign out" : "Back to sign in", false)}</nav>`;
}

function wireNav() {
  element("content-tab")?.addEventListener("click", () => navigate("content"));
  element("account-tab")?.addEventListener("click", () => navigate("account"));
  element("privacy-tab")?.addEventListener("click", () =>
    navigate(signedIn ? "privacy" : "signin"),
  );
  element("exit")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        const wasSignedIn = signedIn;
        if (signedIn) await sdk.logout(true);
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

function highlights() {
  const entries: Array<{ heading: string; body: string }> = config.highlights;
  if (!entries?.length) return "";
  return `<div class="signin-highlights">${entries
    .map(
      (entry, index) =>
        `<article><p class="eyebrow">${String(index + 1).padStart(2, "0")}</p><h2>${escape(entry.heading)}</h2><p>${escape(entry.body)}</p></article>`,
    )
    .join("")}</div>`;
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
  rememberSignIn(config.appId, String(me?.poc?.email || me?.username || ""));
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
  const submit = root.querySelector<HTMLButtonElement>("button.primary");
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
// A person moving between screens is making history, so push an entry: Back has
// to return to the screen before, not to whatever preceded the application.
// Replacing is right everywhere else in this file — stripping a single-use token
// out of the address, correcting a route the person did not choose, and clearing
// the sign-in callback — because none of those is a place they navigated to.
function navigate(route: string) {
  if (route !== currentRoute()) window.history.pushState(null, "", "#/" + route);
  if (!busy) render();
}
// The credential fields, in one place because the entry now shows them beside
// the Fidj door rather than instead of it.
function credentialFields() {
  return `<label for="email">Email</label><input id="email" type="email" value="${escape(signInEmail)}" placeholder="you@company.com" autocomplete="username"><div class="field-head"><label for="password">Password</label><a href="#/forgot">Forgot?</a></div><div class="password-field"><input id="password" type="password" value="${escape(signInPassword)}" placeholder="••••••••••" autocomplete="current-password"><button type="button" id="reveal" aria-controls="password">Show</button></div><button class="primary" type="submit" name="entry" value="credentials">Continue</button><button class="secondary" type="submit" name="signup" value="true">Create an account</button>`;
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
  if (!initialized) {
    root.innerHTML = '<p role="status">Loading your session…</p>';
    return;
  }
  // Which of its routes need a session is the mounted app's business, not the
  // shell's: Fidj's own console serves /pub to anyone. So any address the shell
  // does not own is handed over as it stands.
  if (moduleRoute()) {
    startModule();
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
  if (route === "privacy" && !signedIn) route = "signin";
  window.history.replaceState(null, "", "#/" + route);
  // My account is a signed-in screen and keeps the app's chrome. Recovery and
  // verification are reached without a session, so they stand alone.
  const standaloneAccount =
    accountRoutes.includes(route) && !(route === "account" && signedIn);
  document.body.classList.toggle(
    "signin-view",
    route === "signin" || standaloneAccount,
  );
  if (standaloneAccount) {
    renderAccount(route);
    return;
  }
  if (route === "account") {
    root.innerHTML = `${appNav("account")}<section class="card content-account">${banner()}${accountForm("account")}</section>`;
    wireNav();
    wireAccount("account");
    return;
  }
  if (route === "content" && config.moduleEntry) {
    root.innerHTML = '<p role="status">Opening your app…</p>';
    window.location.assign(config.moduleEntry);
    return;
  }
  if (route === "content") {
    root.innerHTML = `${appNav("content")}${element<HTMLTemplateElement>("public-content")!.innerHTML}`;
    wireNav();
    return;
  }
  root.innerHTML = `${route === "signin" ? "" : appNav("privacy")}<section class="${route === "signin" ? "signin-shell" : "card content-account"}">
  ${route === "signin" ? "" : banner()}
  ${
    route === "signin"
      ? `<div class="signin-intro${config.highlights?.length ? "" : " is-plain"}"><header class="signin-masthead"><img class="app-mark" src="${escape(config.logo)}" alt=""><strong>${escape(config.title)}</strong></header>
  <div class="signin-identity"><h1>${escape(config.welcome)}</h1><p class="signin-description">${escape(config.description)}</p></div>
  ${highlights()}</div>
  <div class="signin-form"><div>${banner()}<h2>Sign in to ${escape(config.title)}</h2><form id="signin"><label for="email">Email</label><input id="email" type="email" value="${escape(signInEmail)}" placeholder="you@company.com" autocomplete="username" required><div class="field-head"><label for="password">Password</label><a href="#/forgot">Forgot?</a></div><div class="password-field"><input id="password" type="password" value="${escape(signInPassword)}" placeholder="••••••••••" autocomplete="current-password" required><button type="button" id="reveal" aria-controls="password">Show</button></div>${agreementMarkup()}<button class="primary" type="submit">Continue</button><button class="secondary" type="submit" name="signup" value="true">Create an account</button></form>${config.allowAnonymous ? `<div class="signin-divider"><span>or explore first</span></div><button class="anonymous-entry" id="anonymous">Enter anonymously <span aria-hidden="true">→</span></button><p class="signin-footnote">No account needed to view the content.</p>` : ""}
  <div class="signin-trust"><p class="signin-trust-head"><img class="signin-logo" src="./fidj-logo.png" alt="Fidj"><strong>Your account, with Fidj</strong></p><p>Signing in creates one Fidj account you keep across every app that uses Fidj.</p><p>You choose what this app may store — and can export or erase it at any moment.</p></div></div>
  ${badges()}</div>`
      : `
  <h2>My privacy in ${escape(config.title)}</h2><p>Roles: ${roles.map(escape).join(" · ") || "No assigned roles"}</p><button id="refresh">Refresh access</button>
  <p>These choices apply only to this app.${config.allowAnonymous ? " You can also view the public content by entering anonymously." : ""}</p>
  <p>Service agreement: ${consent.terms ? "Accepted" : "Not recorded"}. ${consent.terms ? "Leaving withdraws this agreement." : 'This generated example uses a demo agreement. <button id="terms">Accept demo agreement</button>'}</p>
  ${["analytics", "communications", "optionalData"].map((key, i) => `<label class="toggle"><span>${["Analytics", "Communications", "Optional data"][i]}</span><input type="checkbox" data-purpose="${key}" ${consent[key] ? "checked" : ""}></label>`).join("")}
  <h3>Consent history</h3>${
    history.length
      ? history
          .slice()
          .reverse()
          .map(
            (entry) =>
              `<p>${escape(entry.type)} · ${entry.granted ? "Accepted" : "Withdrawn"} · ${escape(entry.changedAt)}</p>`,
          )
          .join("")
      : "<p>No changes yet.</p>"
  }
  <button id="export">Export my app data</button>
  <p>This app stores its session in this browser. The export covers Fidj-held records for this membership. There is no separate app database in this static template.</p>
  ${roles.includes("Owner") ? "<p>Resolve app ownership before leaving.</p>" : leaving ? '<p>Confirm departure: your membership and its Fidj-held data will be removed. Your other apps remain available.</p><button id="confirm-leave" class="danger">Confirm leaving this app</button><button id="cancel-leave">Keep my membership</button>' : '<button id="leave" class="danger">Leave this app</button>'}
  <p class="leaving"><a href="${escape(config.dashboardUrl)}/#/my" target="_blank" rel="noopener">Open Fidj to manage every app you use ↗</a><br><small>Fidj is the account provider behind ${escape(config.title)}. This opens it in a new tab; you stay signed in here.</small></p>`
  }</section>`;
  wireNav();
  element("reveal")?.addEventListener("click", () => {
    const field = element<HTMLInputElement>("password");
    const button = element("reveal");
    if (!field || !button) return;
    const hidden = field.type === "password";
    field.type = hidden ? "text" : "password";
    button.textContent = hidden ? "Hide" : "Show";
  });
  element("anonymous")?.addEventListener("click", () => {
    if (!config.allowAnonymous) return;
    anonymous = true;
    navigate("content");
  });
  if (oidc && element("signin"))
    element("signin")!.innerHTML = providerEntry(
      config.title,
      config.appId,
      config.ownCredentials ? credentialFields() : "",
      isFidjItself,
    );
  // On Fidj itself there is nobody to hand the person to, so the credential
  // screen is fetched straight away: what they see is the form, or their name.
  // Once per document, and never once the provider has already answered — a
  // refusal or a cancellation must not bounce them round again.
  if (
    oidc &&
    isFidjItself &&
    // Only from the sign-in screen. Without this it fired on every render where
    // nobody was signed in — including the recovery screens, so a person opening
    // a password-reset link was handed a sign-in form instead of the reset they
    // had asked for, and could never finish.
    element("signin") &&
    !askedProvider &&
    !interactionId &&
    !signedIn &&
    // Nor when the shell has something to say. A password reset ends on this
    // screen with "your password has been changed"; leaving for the provider
    // would swallow the one confirmation the person was waiting for.
    !message
  ) {
    askedProvider = true;
    void (async () => {
      if (!(await providerRendersHere())) return;
      window.location.assign(await oidc.beginLogin());
    })();
  }

  // Forgetting the address it remembered and handing the person back to a
  // session it never ended would recognise them again: the offer has to reach
  // the provider, not just this browser's memory. Asking for re-authentication
  // is how it says so, and the provider reads it as this person saying they are
  // not the one it knows — it ends that session when it hands the screen over,
  // so walking away from the form does not hand the old face back.
  element("forget-hint")?.addEventListener("click", () => {
    forgetSignIn(config.appId);
    if (oidc) {
      void (async () => {
        window.location.assign(await oidc.beginLogin({prompt: "login"}));
      })();
      return;
    }
    render();
  });
  void bindAgreement(element<HTMLFormElement>("signin"), config.title, config.apiEndpoint, config.appId, signInAgreementAccepted);
  element<HTMLFormElement>("signin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = element<HTMLInputElement>("email")?.value || "";
    const password = element<HTMLInputElement>("password")?.value || "";
    const agreement = element<HTMLInputElement>("service-agreement");
    signInEmail = email;
    signInPassword = password;
    signInAgreementAccepted = agreement?.checked === true;
    const acceptance = acceptedAgreement(event.currentTarget as HTMLFormElement);
    const submitter = event.submitter as HTMLButtonElement | null;
    const signup = submitter?.name === "signup";
    // Which door was used. The Fidj one leaves for the provider; the credential
    // one signs in here, which is why it is the app's own form and not Fidj's.
    const throughFidj = submitter?.name === "entry" && submitter.value === "fidj";
    // Only the credential door is gated here. The Fidj one is about to be asked
    // the same question on the screen that names this app, where the answer is
    // recorded with its version — so asking first cost a second click and kept
    // nothing.
    if (!throughFidj && !acceptance) {
      failed = true;
      message = "Please accept the service agreement before continuing.";
      render();
      return;
    }
    void action(async () => {
      if (oidc && throughFidj) {window.location.assign(await oidc.beginLogin()); return;}
      if (oidc && (!email || !password)) {
        throw new Error("Enter your email and password, or sign in with Fidj.");
      }
      try {
        await sdk.login(email, password, { autoSignup: signup, ...acceptance });
      } catch (error) {
        throw new Error(signInErrorMessage(error));
      }
      await refresh();
      anonymous = false;
      // A new account belongs where a returning one lands: inside the app.
      // Sending it to the account card instead dropped people who had just
      // signed up on the shell, one click short of the app they came for.
      navigate("content");
    });
  });
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
        await request(appPath + "/consents", "PUT", {
          terms: true,
          cguVersion: "starter-demo-1",
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

// The four account screens. My account is shown inside the app; the recovery
// and verification ones are reached without a session and stand alone.
function accountForm(route: string) {
  return    route === "forgot"
      ? `<h2>Reset your password</h2><p>We’ll email you a link to choose a new password for your shared Fidj account.</p><form id="recovery"><label for="recovery-email">Email address</label><input id="recovery-email" type="email" autocomplete="email" required><button class="primary">Send reset link</button></form>`
      : route === "reset"
        ? `<h2>Choose a new password</h2><p>This changes your Fidj password across all your apps and signs out existing sessions.</p>${linkToken ? '<form id="recovery"><label for="new-password">New password</label><input id="new-password" type="password" autocomplete="new-password" minlength="12" required><label for="confirm-password">Confirm password</label><input id="confirm-password" type="password" autocomplete="new-password" minlength="12" required><p>Use at least 12 characters (up to 72 UTF-8 bytes).</p><button class="primary">Save new password</button></form>' : '<p>Request a new link if you no longer have an active reset link.</p><a href="#/forgot">Request a reset link</a>'}`
        : route === "verify"
          ? `<h2>${verificationConfirmed ? "Email verified" : "Verify your email"}</h2>${verificationConfirmed ? "<p>Your account is ready. Return to your app to continue.</p>" : "<p>Confirm that this email address belongs to you.</p>"}${verificationConfirmed ? "" : linkToken ? '<form id="recovery"><button class="primary">Confirm email address</button></form>' : "<p>Sign in to your account to request a new verification email.</p>"}`
          : `<h2>My Fidj account</h2><p>Your identity is shared across your apps. Privacy choices remain separate for each app.</p><p id="verification-status">${emailVerified ? "Your email address is verified." : "Your email is not verified yet."}</p><button id="check-verification">Refresh verification status</button>${emailVerified ? "" : '<button id="resend-verification">Send verification email</button>'}<p><a href="#/forgot">Reset my password</a></p><button id="continue-app" class="primary">Continue to ${escape(config.title)}</button>`;
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
  app: { id: string; title: string; description: string };
  scopes: string[];
  termsUri: string;
  privacyUri: string;
  action: string;
};
let interactionId = "";
let interactionError = "";
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
// standing in, and hides the form behind a click that only fetches it.
let askedProvider = false;
// Whether the provider renders its sign-in on this front end. A deployment
// decides that, so the shell asks rather than assumes: hopping to a provider
// that answers with its own page would land the person on the API's origin,
// which is the thing this is meant to avoid.
let signinOnThisUi: boolean | null = null;
async function providerRendersHere() {
  if (signinOnThisUi !== null) return signinOnThisUi;
  try {
    const response = await fetch(
      new URL("status", config.apiEndpoint.replace(/\/?$/, "/")).href,
      {signal: AbortSignal.timeout(5000)},
    );
    signinOnThisUi = response.ok && (await response.json()).signin === "fidj-ui";
  } catch {
    signinOnThisUi = false;
  }
  return signinOnThisUi;
}
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

function interactionScreen() {
  const details = interaction!;
  const asking = escape(details.app.title);
  const notice = interactionError
    ? `<p role="alert" class="error">${escape(refusals[interactionError] || refusals.refused)}</p>`
    : "";
  const action = new URL(details.action, config.apiEndpoint).href;
  // A refusal comes back as a redirect, so the typed address would be lost —
  // and retyping an address is the part a person gets wrong twice. It is kept
  // in this browser, never in the address: nothing about them travels in a URL.
  let typed = "";
  try {
    typed = sessionStorage.getItem("fidj.interaction.email") || "";
  } catch {}
  // Fidj signing into Fidj: saying "the account behind fidj" and "fidj never
  // sees your password" about itself is nonsense in the same family as offering
  // to sign in with Fidj on Fidj.
  const itself = details.app.id === config.appId;
  const body =
    details.prompt === "login"
      ? `<h2>${itself ? "Sign in to Fidj" : "Sign in to continue to " + asking}</h2>
  <p class="signin-lead">${itself ? "One account across every app that uses Fidj, and a separate set of choices for each one." : `This is Fidj, the account behind ${asking}. One account, and separate choices for every app that uses it — ${asking} never sees your password.`}</p>
  ${notice}
  <form method="post" action="${escape(action)}" id="interaction">
    <input type="hidden" name="csrf" value="${escape(details.csrf)}">
    <label for="email">Email</label><input id="email" name="email" type="email" value="${escape(typed)}" autocomplete="username" required>
    <div class="field-head"><label for="password">Password</label><a href="${escape(config.dashboardUrl)}/#/forgot">Forgot?</a></div>
    <div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" required><button type="button" id="reveal" aria-controls="password">Show</button></div>
    <button class="primary" type="submit" name="action" value="continue">Sign in</button>
    <button class="secondary" type="submit" name="action" value="signup">Create a Fidj account</button>
    <button class="quiet" type="submit" name="action" value="cancel" formnovalidate>Cancel and go back</button>
  </form>`
      : `<h2>${itself ? "Continue to Fidj" : "Continue to " + asking}</h2>
  <p class="signin-lead">${itself ? "Fidj is asking for the information below. Optional privacy choices stay separate for every app, including this one." : `${asking} is asking for the information below. Optional privacy choices stay separate, and you can change them in Fidj at any time.`}</p>
  ${notice}
  <ul class="scope-list">${details.scopes
    .filter((scope) => scopeMeaning[scope])
    .map((scope) => `<li>${escape(scopeMeaning[scope])}</li>`)
    .join("")}</ul>
  <form method="post" action="${escape(action)}" id="interaction">
    <input type="hidden" name="csrf" value="${escape(details.csrf)}">
    <label class="agreement-choice"><input type="checkbox" name="terms" value="true" required><span>I accept ${asking}'s service agreement.</span></label>
    ${details.termsUri ? `<p class="fineprint"><a href="${escape(details.termsUri)}" target="_blank" rel="noopener noreferrer">Service agreement</a>${details.privacyUri ? ` · <a href="${escape(details.privacyUri)}" target="_blank" rel="noopener noreferrer">Privacy notice</a>` : ""}</p>` : ""}
    <button class="primary" type="submit" name="action" value="continue">Allow and continue</button>
    <button class="quiet" type="submit" id="not-me" name="action" value="switch" formnovalidate>Not you? Sign in with another account</button>
    <button class="quiet" type="submit" name="action" value="cancel" formnovalidate>Cancel and go back</button>
  </form>`;

  root.innerHTML = `<section class="signin-shell"><div class="signin-intro is-plain"><header class="signin-masthead"><img class="app-mark" src="${escape(config.logo)}" alt=""><strong>${escape(config.title)}</strong></header>
  <div class="signin-identity"><h1>Your identity.<br>Your choices.</h1><p class="signin-description">One account across every app that uses Fidj, and a separate set of choices for each one.</p></div>
  ${highlights()}</div>
  <div class="signin-form"><div>${body}</div>
  <div class="signin-trust"><p class="signin-trust-head"><img class="signin-logo" src="./fidj-logo.png" alt="Fidj"><strong>What Fidj is</strong></p><p>Fidj holds your account so each app does not have to. You can see every app you use, what it holds, and take it back — at any time.</p></div></div>
  ${badges()}</section>`;

  element("reveal")?.addEventListener("click", () => {
    const field = element<HTMLInputElement>("password");
    const button = element("reveal");
    if (!field || !button) return;
    const hidden = field.type === "password";
    field.type = hidden ? "text" : "password";
    button.textContent = hidden ? "Hide" : "Show";
  });
  // Being recognised is the point, and a dead end when the person is not who
  // Fidj thinks — a shared computer, a second account, somebody else's tab. So
  // the screen that recognises them asks again on request. It goes back to the
  // provider as this form's own answer, because only the provider can end the
  // session doing the recognising: starting a fresh request with prompt=login
  // from here asked once and left that session standing, so the back button,
  // a reload, or the app's door again met the same face.
  element("not-me")?.addEventListener("click", () => {
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
  root.innerHTML = `<section class="signin-shell"><div class="signin-intro is-plain"><header class="signin-masthead"><img class="app-mark" src="${escape(config.logo)}" alt=""><strong>${escape(config.title)}</strong></header>
  <div class="signin-identity"><h1>Your account.<br>Your control.</h1><p class="signin-description">Secure access to the apps you use, with one Fidj identity.</p></div>
  </div>
  <div class="signin-form"><div>${banner()}${accountForm(route)}</div><footer class="signin-badges"><a href="#/signin">Back to sign in</a></footer></div></section>`;
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
window.addEventListener("hashchange", render);
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
    await oidc.completeLogin(callback);
    try {
      sessionStorage.removeItem("fidj.interaction.email");
    } catch {}
  }
  await sdk.init(config.appId, {
    apiEndpoint: config.apiEndpoint,
    prod: !config.localDemo,
  });
  if (sdk.isLoggedIn()) {
    await refresh();
    if (!moduleRoute() && !accountRoutes.includes(currentRoute()))
      navigate("content");
  }
});
