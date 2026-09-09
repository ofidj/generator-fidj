import { FidjNodeService } from "@ofidj/node";
import "./style.css";

type Session = { username: string; roles: string[] };
type Note = { id: string; title: string; body: string; createdAt: string };
type Settings = {
  title: string;
  appId: string;
  apiEndpoint: string;
  dashboardUrl: string;
  localDemo: boolean;
};
const root = document.querySelector<HTMLDivElement>("#app")!;
const sdk = new FidjNodeService();
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
async function load() {
  session = await api("session");
  [notes, privacy] = await Promise.all([
    api("notes").then((result) => result.notes),
    api("privacy"),
  ]);
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
function render() {
  document.title = settings.title + " · Fidj";
  const canWrite = session?.roles.some((role) =>
    ["Owner", "Editor"].includes(role),
  );
  root.innerHTML = `<header class="topbar"><a class="brand" href="/"><span class="app-symbol">✳</span>${escape(settings.title)}</a><a class="fidj-brand" href="${escape(settings.dashboardUrl)}" target="_blank" rel="noopener"><img src="/fidj-logo.png" alt="Fidj">Privacy with Fidj ↗</a></header>
  <main>${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ""}${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}
  ${
    !session
      ? `<section class="welcome"><div><p class="eyebrow">A LITTLE SPACE FOR YOUR IDEAS</p><h1>Good ideas<br>start here.</h1><p>Keep your notes together, with access you understand and privacy you control.</p><div class="promise"><img src="/fidj-logo.png" alt=""><span>Your account connects through Fidj.<br>Your choices belong to this app.</span></div></div><form id="signin" class="card"><h2>Welcome to ${escape(settings.title)}</h2><p>Sign in with your Fidj account.</p><label for="email">Email</label><input id="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Sign in</button>${settings.localDemo ? `<div class="demo"><strong>Try the local example</strong><p>Alex owns the app. Maya and Sam start with the Free role.</p><button type="button" data-demo="alex">Alex · owner</button><button type="button" data-demo="maya">Maya · member</button><button type="button" data-demo="sam">Sam · member</button></div>` : ""}</form></section>`
      : `
  <div class="page-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>A place to think.</h1><p>${escape(session.username)} <span class="roles">${session.roles.map(escape).join(" · ") || "No assigned roles"}</span></p></div><button id="signout">Sign out</button></div>
  <nav><button id="workspace-tab" class="${view === "workspace" ? "selected" : ""}">My notes</button><button id="privacy-tab" class="${view === "privacy" ? "selected" : ""}">My privacy</button><button id="refresh">Refresh access</button></nav>
  ${
    view === "workspace"
      ? `<section class="workspace"><div><div class="section-heading"><h2>Your notes</h2><span>${notes.length} saved</span></div>${notes.length ? notes.map((note) => `<article class="card note"><small>${escape(new Date(note.createdAt).toLocaleString())}</small><h3>${escape(note.title)}</h3><p>${escape(note.body)}</p></article>`).join("") : `<article class="card empty"><span>✳</span><h3>Room for your next idea.</h3><p>Your saved notes will appear here. Only you can read your notes.</p></article>`}</div><form id="note" class="card"><p class="eyebrow">CAPTURE SOMETHING</p><h2>A fresh note</h2><p>${canWrite ? "You have permission to save notes." : "Ask your app owner for Editor access to save notes."}</p><label for="note-title">Title</label><input id="note-title" maxlength="120" required ${!canWrite ? "disabled" : ""}><label for="note-body">Your note</label><textarea id="note-body" rows="6" maxlength="5000" ${!canWrite ? "disabled" : ""}></textarea><button class="primary" type="submit" ${!canWrite ? "disabled" : ""}>Save note</button><small>Your notes are saved by this app and survive a server restart.</small></form></section>`
      : `<section class="privacy-grid"><article class="card"><p class="eyebrow">ONLY ${escape(settings.title).toUpperCase()}</p><h2>Your choices in this app</h2><p>These preferences are independent of Fidj and your other apps.</p><div class="agreement"><strong>Service agreement</strong><span>${privacy?.consent.terms ? "Accepted" : "Not recorded"}</span>${!privacy?.consent.terms ? '<p>This starter uses a demo agreement. Accept it to record your choice.</p><button id="accept-terms">Accept demo agreement</button>' : "<p>Leaving this app withdraws its required agreement.</p>"}</div>${["analytics", "communications", "optionalData"].map((key, index) => `<label class="toggle"><span><strong>${["Analytics", "Communications", "Optional data"][index]}</strong><small>${["Help improve this app.", "Receive optional news and updates.", "Allow data beyond the essential service."][index]}</small></span><input type="checkbox" data-purpose="${key}" ${privacy?.consent[key] ? "checked" : ""}></label>`).join("")}<button id="export">Export my data</button></article><article class="card"><h2>Consent history</h2>${
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
        }<hr><h2>Leave this app</h2><p>This removes your app membership and this starter’s notes. Your Fidj account and other memberships remain.</p>${session.roles.includes("Owner") ? "<p>As the app owner, resolve ownership before leaving.</p>" : '<button id="leave" class="danger">Leave and erase my app data</button>'}<p class="fineprint">Exports here include your Fidj membership and this starter’s notes. The registered app-data handler lets Fidj export and erase these notes too. If cleanup is pending, retry from My privacy on Fidj. Minimal completion receipts are retained; backups and unregistered systems are outside this operation.</p></article></section>`
  }`
  }
  <footer>Built with Fidj · One identity. Separate choices for every app.</footer></main>`;
  el<HTMLFormElement>("signin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = el<HTMLInputElement>("email").value;
    const password = el<HTMLInputElement>("password").value;
    void action(async () => {
      await sdk.login(email, password, { autoSignup: false });
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
    if (
      !confirm(
        `Leave ${settings.title}? Your membership, consent and notes here will be removed. Other apps remain available.`,
      )
    )
      return;
    void action(async () => {
      const result = await api("privacy/leave", "DELETE", {
        confirm: settings.appId,
      });
      await sdk.logout(true);
      session = null;
      notes = [];
      privacy = null;
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
void start();
