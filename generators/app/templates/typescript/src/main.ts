import {agreementRequired, agreementFromRefusal, signInErrorMessage, rememberSignIn, forgetSignIn, type SigninShape} from "@ofidj/entry";
import {acceptedAgreement, agreementScreen, bindAgreementScreen, bindPasswordReveal, providerEntry, showEmailEntry, showVersionBadge} from "@ofidj/entry/dom";
import {openProviderWindow, relayProviderAnswer, type ProviderWindow} from "@ofidj/entry/window";
import { FidjNodeService, FidjOidcClient } from "@ofidj/node";
import "@ofidj/entry/style.css";

type Session = { username: string; roles: string[] };
type Note = { id: string; title: string; body: string; createdAt: string };
type Settings = {
  title: string;
  appId: string;
  apiEndpoint: string;
  dashboardUrl: string;
  localDemo: boolean;
  releaseVersion: string;
  oidcIssuer?: string;
  // An owner may let their own app collect the credential beside the Fidj door.
  // Off unless asked for: the promise the entry makes otherwise is that this app
  // never sees a password.
  signin?: SigninShape;
};
const root = document.querySelector<HTMLDivElement>("#app")!;
const sdk = new FidjNodeService();
// When the app is configured with a provider it hands the person to Fidj and
// gets a code back, seeing no password — unless its owner asked for a form of
// its own beside that door.
let oidc: FidjOidcClient | null = null;
let settings: Settings;
let session: Session | null = null;
let notes: Note[] = [];
let privacy: {
  consent: Record<string, boolean>;
  history: Array<{ type: string; granted: boolean; changedAt: string }>;
} | null = null;
let view = "workspace";
let notice = "";
let error = "";
let busy = false;
let leaving = false;
let signInEmail = "";
let signInPassword = "";
// The agreement this app is owed, once the API has said so. There is no
// account creation here, so there is no verification wait to hold either.
let pendingAgreement: {version: string; text: string} | null = null;
// Whether the person asked for the app's own form: the entry is rebuilt on every
// render, and a refused sign-in is a render, so it has to be remembered or the
// form folds away under the complaint about it.
let emailEntryOpen = false;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
async function api(path: string, method = "GET", data?: unknown) {
  const token = await sdk.fidjGetIdToken();
  const response = await fetch("/api/" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      session = null;
      await sdk.logout(true);
    }
    throw new Error(result.message || "Please retry.");
  }
  return result;
}
// The credential fields, in one place because the entry shows them beside the
// Fidj door rather than instead of it.
function credentialFields() {
  return `<label for="email">Email</label><input id="email" type="email" value="${escape(signInEmail)}" autocomplete="username"><label for="password">Password</label><div class="password-field"><input id="password" type="password" value="${escape(signInPassword)}" autocomplete="current-password"><button type="button" aria-controls="password">Show</button></div><button class="primary" type="submit" name="entry" value="credentials">Continue</button>`;
}

async function load() {
  session = await api("session");
  // Remembered on this app's own origin so the entry can offer to continue as
  // them next time; signing out forgets it.
  if (session?.username) rememberSignIn(settings.appId, session.username);
  [notes, privacy] = await Promise.all([
    api("notes").then((result) => result.notes),
    api("privacy"),
  ]);
}
// Taking the Fidj door, from inside the click that asked for it. The window has
// to exist before the authorization URL is fetched — building it costs a
// discovery round-trip, and a window opened after an await is one the browser
// no longer attributes to the press, which every popup blocker refuses.
// The window this page is waiting on, while it is waiting on it.
let waitingFor: ProviderWindow | null = null;

// What the entry says while that window is open: the way back to it, and the way
// out of it. The waiting happens in a window that can be behind this page, and
// from here that looks exactly like nothing having happened.
function offerTheWindowBack(providerWindow: ProviderWindow) {
  const waiting = root.querySelector<HTMLButtonElement>("button[data-busy]");
  if (!waiting) return;
  waiting.classList.add("is-waiting");
  // It says what is happening rather than what to do, because what to do is
  // happening in the other window. Dropping the accent is the point: this is a
  // state, not the way in. It stays pressable all the same — somebody who has
  // lost that window behind this page needs precisely this to be pressable.
  waiting.textContent = "Connecting with Fidj…";
  waiting.title = "Bring the Fidj window back to the front";
  // Borrowing a submit button's press: submitting would open a second window.
  waiting.onclick = (event) => {
    event.preventDefault();
    providerWindow.focus();
  };
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.id = "cancel-provider";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  cancel.onclick = () => {
    cancel.disabled = true;
    providerWindow.giveUp();
  };
  waiting.insertAdjacentElement("afterend", cancel);
}

function signInThroughProvider(trigger: HTMLElement | null) {
  // Held, not read again: `oidc` is settled once at start-up, and reading it
  // inside the callback asks the compiler to prove that across an await.
  const provider = oidc;
  if (!provider) return;
  // Already open: bring that one back rather than start a second conversation.
  if (waitingFor?.isOpen()) {
    waitingFor.focus();
    return;
  }
  const providerWindow = openProviderWindow();
  trigger?.setAttribute("data-busy", "true");
  void action(async () => {
    let url: string;
    try {
      // Somebody who has just signed out is asked again rather than recognised:
      // otherwise pressing the door undoes the sign-out without a screen.
      url = await provider.beginLogin(
        provider.signedOutHere() ? {prompt: "login"} : {},
      );
    } catch (reason) {
      providerWindow?.giveUp();
      throw reason;
    }
    // Blocked, or a browser that would not open one: leaving this page is the
    // flow this one replaced, and it still works.
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
    // Closed by hand. A person who changed their mind is not owed an error.
    if (!callback) return;
    await provider.completeLogin(callback);
    await load();
  });
}
async function action(task: () => Promise<void>) {
  if (busy) return;
  busy = true;
  error = "";
  notice = "";
  try {
    await task();
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  } finally {
    busy = false;
    render();
  }
}
// The API decides whether this is a session or the agreement it has not
// recorded for this app. Returns true when it answered with a screen.
async function refusedBeforeSignIn(
  email: string,
  password: string,
  acceptance?: {termsAccepted: boolean; termsVersion: string},
): Promise<boolean> {
  try {
    await sdk.login(email, password, {autoSignup: false, ...acceptance});
    pendingAgreement = null;
    return false;
  } catch (reason) {
    if (agreementRequired(reason)) {
      pendingAgreement = agreementFromRefusal(reason);
      if (!pendingAgreement) {
        throw new Error("We cannot reach Fidj right now. Please try again.");
      }
      return true;
    }
    throw new Error(signInErrorMessage(reason));
  }
}

function render() {
  document.title = settings.title + " · Fidj";
  const canWrite = session?.roles.some((role) =>
    ["Owner", "Editor"].includes(role),
  );
  root.innerHTML = `<header class="topbar"><a class="brand" href="/"><span class="app-symbol">✳</span><span class="brand-name">${escape(settings.title)}</span></a><a class="fidj-brand" href="${escape(settings.dashboardUrl)}" target="_blank" rel="noopener"><img src="/fidj-logo.png" alt="Fidj">Privacy with Fidj ↗</a></header>
  <main>${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ""}${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}
  ${
    !session
      ? `<section class="welcome"><div><p class="eyebrow">A LITTLE SPACE FOR YOUR IDEAS</p><h1>Good ideas<br>start here.</h1><p>Keep your notes together, with access you understand and privacy you control.</p><div class="promise"><img src="/fidj-logo.png" alt=""><span>Your account connects through Fidj.<br>Your choices belong to this app.</span></div></div><form id="signin" class="card"><h2>Welcome to ${escape(settings.title)}</h2>${oidc ? providerEntry(settings.title, settings.appId, settings.signin === "button" ? "" : credentialFields(), false, settings.signin || "button") : `<p>Sign in with your Fidj account.</p>${credentialFields()}<button class="primary" type="submit">Sign in</button>${settings.localDemo ? `<div class="demo"><strong>Try the local example</strong><p>Alex owns the app. Maya and Sam start with the Free role.</p><button type="button" data-demo="alex">Alex · owner</button><button type="button" data-demo="maya">Maya · member</button><button type="button" data-demo="sam">Sam · member</button></div>` : ""}`}</form></section>`
      : `
  <div class="page-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>A place to think.</h1><p>${escape(session.username)} <span class="roles">${session.roles.map(escape).join(" · ") || "No assigned roles"}</span></p></div><button id="signout">Sign out</button></div>
  <nav><button id="workspace-tab" class="${view === "workspace" ? "selected" : ""}">My notes</button><button id="privacy-tab" class="${view === "privacy" ? "selected" : ""}">My privacy</button><button id="refresh">Refresh access</button></nav>
  ${
    view === "workspace"
      ? `<section class="workspace"><div><div class="section-heading"><h2>Your notes</h2><span>${notes.length} saved</span></div>${notes.length ? notes.map((note) => `<article class="card note"><small>${escape(new Date(note.createdAt).toLocaleString())}</small><h3>${escape(note.title)}</h3><p>${escape(note.body)}</p></article>`).join("") : `<article class="card empty"><span>✳</span><h3>Room for your next idea.</h3><p>Your saved notes will appear here. Only you can read your notes.</p></article>`}</div><form id="note" class="card"><p class="eyebrow">CAPTURE SOMETHING</p><h2>A fresh note</h2><p>${canWrite ? "You have permission to save notes." : "Ask your app owner for Editor access to save notes."}</p><label for="note-title">Title</label><input id="note-title" maxlength="120" required ${!canWrite ? "disabled" : ""}><label for="note-body">Your note</label><textarea id="note-body" rows="6" maxlength="5000" ${!canWrite ? "disabled" : ""}></textarea><button class="primary" type="submit" ${!canWrite ? "disabled" : ""}>Save note</button><small>Your notes are saved by this app and survive a server restart.</small></form></section>`
      : `<section class="privacy-grid"><article class="card"><p class="eyebrow">ONLY ${escape(settings.title).toUpperCase()}</p><h2>Your choices in this app</h2><p>These preferences are independent of Fidj and your other apps.</p><div class="agreement"><strong>Service agreement</strong><span>${privacy?.consent.terms ? "Accepted" : "Not recorded"}</span>${!privacy?.consent.terms ? '<p>This starter uses a demo agreement. Accept it to record your choice.</p><button id="accept-terms">Accept demo agreement</button>' : "<p>Leaving this app withdraws its required agreement.</p>"}</div>${["analytics", "communications", "optionalData"].map((key, index) => `<label class="toggle"><span><strong>${["Analytics", "Communications", "Optional data"][index]}</strong><small>${["Help improve this app.", "Receive optional news and updates.", "Allow data beyond the essential service."][index]}</small></span><input type="checkbox" data-purpose="${key}" ${privacy?.consent[key] ? "checked" : ""}></label>`).join("")}<button id="export">Export</button></article><article class="card"><h2>Consent history</h2>${
          privacy?.history.length
            ? privacy.history
                .slice()
                .reverse()
                .map(
                  (entry) =>
                    `<p><strong>${escape(entry.type)}</strong> · ${entry.granted ? "Accepted" : "Withdrawn"}<br><small>${escape(new Date(entry.changedAt).toLocaleString())}</small></p>`,
                )
                .join("")
            : "<p>No changes yet.</p>"
        }<hr><h2>Leave this app</h2><p>This removes your app membership and this starter’s notes. Your Fidj account and other memberships remain.</p>${session.roles.includes("Owner") ? "<p>As the app owner, resolve ownership before leaving.</p>" : leaving ? '<div role="alertdialog" aria-labelledby="leave-title"><h3 id="leave-title">Confirm departure</h3><p>Your membership, consent and notes in this app will be removed. Your Fidj account and other apps remain available.</p><button id="confirm-leave" class="danger">Leave &amp; erase</button><button id="cancel-leave">Keep my membership</button></div>' : '<button id="leave" class="danger">Leave &amp; erase</button>'}<p class="fineprint">Exports here include your Fidj membership and this starter’s notes. The registered app-data handler lets Fidj export and erase these notes too. If cleanup is pending, retry from My privacy on Fidj. Minimal completion receipts are retained; backups and unregistered systems are outside this operation.</p></article></section>`
  }`
  }
  <footer>Built with Fidj · One identity. Separate choices for every app.</footer></main>`;
  // The agreement takes the form's place once the API says this app is owed one.
  if (pendingAgreement && el("signin")) {
    el("signin")!.innerHTML = agreementScreen(settings.title, pendingAgreement, `${settings.apiEndpoint}/apps/${encodeURIComponent(settings.appId)}/agreements/${encodeURIComponent(pendingAgreement.version || "")}`);
    bindAgreementScreen(el<HTMLFormElement>("signin"));
  }
  // The app's own form, folded away under the Fidj door rather than beside it.
  if (!pendingAgreement && emailEntryOpen) showEmailEntry(true);
  if (!pendingAgreement && el("signin")) bindPasswordReveal(el("signin")!);
  el("use-email")?.addEventListener("click", () => {
    emailEntryOpen = !emailEntryOpen;
    showEmailEntry(emailEntryOpen, true);
  });
  el<HTMLFormElement>("signin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    // Answering the agreement screen: the credentials were accepted already and
    // are not re-read from a form that no longer shows them.
    if (pendingAgreement) {
      const accepted = acceptedAgreement(event.currentTarget as HTMLFormElement);
      if (!accepted) return;
      void action(async () => {
        if (await refusedBeforeSignIn(signInEmail, signInPassword, accepted))
          return;
        await load();
      });
      return;
    }
    const email = el<HTMLInputElement>("email")?.value || "";
    const password = el<HTMLInputElement>("password")?.value || "";
    signInEmail = email;
    signInPassword = password;
    // The Fidj door opens a window of its own, from inside this click: opening
    // it after the authorization URL has been fetched is what a popup blocker
    // refuses, because the browser no longer attributes it to the press.
    if (oidc) {
      signInThroughProvider(event.submitter as HTMLElement | null);
      return;
    }
    void action(async () => {
      if (await refusedBeforeSignIn(email, password)) return;
      await load();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-demo]").forEach((button) =>
    button.addEventListener("click", () => {
      el<HTMLInputElement>("email").value = button.dataset.demo + "@fidj.local";
      el<HTMLInputElement>("password").value =
        button.dataset.demo === "alex"
          ? "local-demo-only"
          : "local-member-only";
    }),
  );
  el("signout")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await sdk.logout(true);
        forgetSignIn(settings.appId);
        session = null;
        notes = [];
        privacy = null;
      }),
  );
  el("workspace-tab")?.addEventListener("click", () => {
    view = "workspace";
    render();
  });
  el("privacy-tab")?.addEventListener("click", () => {
    view = "privacy";
    render();
  });
  el("refresh")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await load();
        notice = "Access and preferences refreshed.";
      }),
  );
  el<HTMLFormElement>("note")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {
      title: el<HTMLInputElement>("note-title").value,
      body: el<HTMLTextAreaElement>("note-body").value,
    };
    void action(async () => {
      await api("notes", "POST", data);
      await load();
      notice = "Note saved.";
    });
  });
  root.querySelectorAll<HTMLInputElement>("[data-purpose]").forEach((input) =>
    input.addEventListener(
      "change",
      () =>
        void action(async () => {
          await api("privacy", "PUT", {
            [input.dataset.purpose!]: input.checked,
          });
          await load();
          notice = "Saved for this app. Your other apps are unchanged.";
        }),
    ),
  );
  el("accept-terms")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await api("privacy", "PUT", { terms: true });
        await load();
        notice = "Demo agreement accepted.";
      }),
  );
  el("export")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        const data = await api("privacy/export");
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${settings.appId}-my-data.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notice = "Exported your membership, choices and notes.";
      }),
  );
  el("leave")?.addEventListener("click", () => {
    leaving = true;
    render();
  });
  el("cancel-leave")?.addEventListener("click", () => {
    leaving = false;
    render();
  });
  el("confirm-leave")?.addEventListener("click", () => {
    void action(async () => {
      const result = await api("privacy/leave", "DELETE", {
        confirm: settings.appId,
      });
      await sdk.logout(true);
      session = null;
      notes = [];
      privacy = null;
      leaving = false;
      notice =
        result.status === "pending"
          ? "Access revoked. Cleanup is pending. Open My privacy on Fidj and choose Retry cleanup."
          : "You left this app. Its membership and registered app data were erased. Your other apps are unchanged.";
    });
  });
}
async function start() {
  try {
    settings = await (await fetch("/api/config")).json();
    showVersionBadge(settings.releaseVersion, settings.title === "Fidj" ? settings.apiEndpoint : undefined);
    if (settings.oidcIssuer)
      oidc = new FidjOidcClient({
        issuer: settings.oidcIssuer,
        clientId: settings.appId,
        redirectUri: window.location.origin + window.location.pathname,
        apiEndpoint: settings.apiEndpoint,
        storage: sessionStorage,
      });
    // Coming back from Fidj: swap the code for a session, and take the code out
    // of the address bar before anything can reload it.
    if (oidc && new URL(window.location.href).searchParams.has("state")) {
      const callback = new URL(window.location.href);
      window.history.replaceState(null, "", window.location.pathname);
      await oidc.completeLogin(callback);
    }
    await sdk.init(settings.appId, {
      apiEndpoint: settings.apiEndpoint,
      prod: !settings.localDemo,
    });
    if (sdk.isLoggedIn()) await load();
  } catch (reason) {
    error =
      reason instanceof Error ? reason.message : "Cannot connect to Fidj.";
  }
  if (settings) render();
  else
    root.textContent =
      "This app could not load. Please check the server and retry.";
}
// This document is the window the entry opened, and the provider has just
// answered into it: hand the answer to the page that opened it and get out of
// the way. A window the browser will not close was not scripted open, so the
// ordinary return path runs after all rather than stranding somebody here.
if (relayProviderAnswer()) {
  root.innerHTML = '<p role="status">Signing you in…</p>';
  window.setTimeout(() => {
    if (!window.closed) void start();
  }, 800);
} else {
  void start();
}
