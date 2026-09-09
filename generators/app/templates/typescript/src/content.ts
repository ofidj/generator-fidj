import { FidjNodeService } from "@ofidj/node";
import config from "../app.config.json";
import "./style.css";

const sdk = new FidjNodeService();
const root = document.querySelector<HTMLDivElement>("#app")!;
const appPath = `/me/apps/${encodeURIComponent(config.appId)}`;
let signedIn = false;
let roles: string[] = [];
let consent: Record<string, boolean> = {};
let history: Array<{ type: string; granted: boolean; changedAt: string }> = [];
let message = "";
let failed = false;
let busy = false;
let leaving = false;
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
  signedIn = true;
}
async function action(task: () => Promise<void>) {
  if (busy) return;
  busy = true;
  failed = false;
  message = "";
  try {
    await task();
  } catch (error) {
    failed = true;
    message = error instanceof Error ? error.message : String(error);
  } finally {
    busy = false;
    render();
  }
}
function render() {
  root.innerHTML = `<section class="card content-account">
  ${message ? `<p role="${failed ? "alert" : "status"}" class="${failed ? "error" : "notice"}">${escape(message)}</p>` : ""}
  ${
    !signedIn
      ? `<h2>Your account</h2><p>Enjoy the public content freely. Sign in to manage your relationship with ${escape(config.title)}.</p>
  <form id="signin"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Sign in</button><button type="submit" name="signup" value="true">Create an account</button></form>
  ${config.localDemo ? "<p>Local accounts: alex@fidj.local / local-demo-only; maya@fidj.local / local-member-only.</p>" : ""}`
      : `
  <h2>My privacy in ${escape(config.title)}</h2><p>Roles: ${roles.map(escape).join(" · ") || "No assigned roles"}</p><button id="refresh">Refresh access</button><button id="signout">Sign out</button>
  <p>These choices apply only to this app. Public content remains available when you sign out.</p>
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
  <p><a href="${escape(config.dashboardUrl)}/my">Manage my apps and privacy on Fidj ↗</a></p>`
  }</section>`;
  element<HTMLFormElement>("signin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = element<HTMLInputElement>("email")!.value;
    const password = element<HTMLInputElement>("password")!.value;
    const signup = (event.submitter as HTMLButtonElement)?.name === "signup";
    void action(async () => {
      await sdk.login(email, password, { autoSignup: signup });
      await refresh();
    });
  });
  element("refresh")?.addEventListener("click", () => void action(refresh));
  element("signout")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await sdk.logout(true);
        signedIn = false;
      }),
  );
  element("terms")?.addEventListener(
    "click",
    () =>
      void action(async () => {
        await request(appPath + "/consents", "PUT", {
          terms: true,
          termsVersion: "starter-demo-1",
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
      leaving = false;
      message =
        result.status === "pending"
          ? "Access revoked. Storage cleanup is pending; contact the app owner."
          : "You left this app. Your other memberships remain available.";
    });
  });
}
void action(async () => {
  await sdk.init(config.appId, {
    apiEndpoint: config.apiEndpoint,
    prod: !config.localDemo,
  });
  if (sdk.isLoggedIn()) await refresh();
});
