import {agreementMarkup, bindAgreement, acceptedAgreement, signInErrorMessage} from "./service-agreement";
import { FidjNodeService, FidjOidcClient } from "@ofidj/node";
import config from "../app.config.json";
import "./style.css";

const sdk = new FidjNodeService();
const oidc = config.oidcIssuer ? new FidjOidcClient({issuer: config.oidcIssuer, clientId: config.appId, redirectUri: window.location.origin + window.location.pathname, apiEndpoint: config.apiEndpoint, storage: sessionStorage}) : null;
const root = document.querySelector<HTMLDivElement>("#app")!;
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
function banner() {
  return message
    ? `<p role="${failed ? "alert" : "status"}" class="${failed ? "error" : "notice"}">${escape(message)}</p>`
    : "";
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
        if (signedIn) await sdk.logout(true);
        signedIn = false;
        anonymous = false;
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
  emailVerified = (await request("/me")).user?.verified === true;
  signedIn = true;
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
  if (initialized) message = "";
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
function navigate(route: string) {
  window.history.replaceState(null, "", "#/" + route);
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
  const target = new URL(config.moduleEntry, window.location.href);
  target.hash = window.location.hash;
  return target.href;
}
function render() {
  if (!initialized) {
    root.innerHTML = '<p role="status">Loading your session…</p>';
    return;
  }
  const applicationRoute = moduleRoute();
  if (applicationRoute) {
    root.innerHTML = '<p role="status">Opening your app…</p>';
    window.location.replace(applicationRoute);
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
  if (oidc && element("signin")) element("signin")!.innerHTML = agreementMarkup() + '<p>Continue securely with your Fidj account. Your password stays with Fidj.</p><button class="primary" type="submit">Continue with Fidj</button>';
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
    if (!acceptance) {
      failed = true;
      message = "Please accept the service agreement before continuing.";
      render();
      return;
    }
    const signup = (event.submitter as HTMLButtonElement)?.name === "signup";
    void action(async () => {
      if (oidc) {window.location.assign(await oidc.beginLogin()); return;}
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
        signedIn = false;
        anonymous = false;
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
void action(async () => {
  if (oidc && new URL(window.location.href).searchParams.has("state")) {
    const callback = new URL(window.location.href);
    window.history.replaceState(null, "", window.location.pathname + "#/content");
    await oidc.completeLogin(callback);
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
