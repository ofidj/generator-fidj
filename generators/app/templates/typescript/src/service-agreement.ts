export function agreementMarkup() {
  return `<div class="signin-agreement"><label class="agreement-choice"><input id="service-agreement" type="checkbox" aria-required="true" disabled><span id="agreement-label">I accept the service agreement for this app.</span></label><button type="button" id="read-agreement" disabled>Read service agreement</button><p id="agreement-status" class="fineprint" role="status">Loading service agreement…</p><button type="button" id="retry-agreement" hidden>Retry</button></div><dialog id="agreement-dialog" aria-labelledby="agreement-heading"><h2 id="agreement-heading">Service agreement</h2><p id="agreement-version"></p><p id="agreement-text"></p><button type="button" id="close-agreement">Close agreement</button></dialog>`;
}

export function acceptedAgreement(form: HTMLFormElement) {
  const checkbox = form.querySelector<HTMLInputElement>("#service-agreement");
  if (!checkbox?.checked || checkbox.disabled || !checkbox.dataset.version) return null;
  return { termsAccepted: true, termsVersion: checkbox.dataset.version };
}

export function signInErrorMessage(error: unknown) {
  const detail = error as {code?: number; reason?: unknown; message?: unknown};
  const reason = typeof detail?.reason === "string" ? detail.reason : typeof detail?.message === "string" ? detail.message : "";
  if (detail?.code === 429) return "Too many attempts. Please wait before trying again.";
  if (reason === "unknown-user") return "We could not sign in to this account. Check the email and password.";
  if (reason === "already exists - inconsistent request") return "An account already uses this email. Check the password or sign in instead.";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|network/i.test(reason)) return "We cannot reach Fidj right now. Please try again.";
  return "We could not sign in to this account. Please try again.";
}

export async function bindAgreement(form: HTMLFormElement | null, title: string, endpoint: string, appId: string, checked = false) {
  if (!form) return;
  // An app whose only door is Fidj carries no agreement block: Fidj asks for
  // this app's agreement on the screen that names it, and records the version.
  const checkbox = form.querySelector<HTMLInputElement>("#service-agreement");
  if (!checkbox) return;
  const read = form.querySelector<HTMLButtonElement>("#read-agreement")!;
  const dialog = form.querySelector<HTMLDialogElement>("#agreement-dialog")!;
  const status = form.querySelector<HTMLElement>("#agreement-status")!;
  const retry = form.querySelector<HTMLButtonElement>("#retry-agreement")!;
  const submitButtons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
  const update = () => submitButtons.forEach(button => { button.disabled = checkbox.disabled; });
  form.querySelector("#agreement-label")!.textContent = `I accept the service agreement for ${title}.`;
  update();
  checkbox.addEventListener("change", update);
  read.addEventListener("click", () => dialog.showModal());
  form.querySelector("#close-agreement")!.addEventListener("click", () => dialog.close());
  const load = async () => {
    retry.hidden = true;
    status.textContent = "Loading service agreement…";
    try {
      const response = await fetch(`${endpoint}/apps/${encodeURIComponent(appId)}`, {signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error(response.status === 404 ? "missing" : "unreachable");
      const agreement = (await response.json()).app?.agreement;
      if (!agreement || typeof agreement.version !== "string" || !agreement.version || typeof agreement.text !== "string" || !agreement.text) throw new Error("missing");
      if (!form.isConnected) return;
      checkbox.dataset.version = agreement.version;
      checkbox.disabled = false;
      checkbox.checked = checked;
      read.disabled = false;
      dialog.querySelector("#agreement-version")!.textContent = `Version ${agreement.version}`;
      dialog.querySelector("#agreement-text")!.textContent = agreement.text;
      status.textContent = "Required to sign in. Optional data choices stay separate.";
      update();
    } catch (error) {
      if (!form.isConnected) return;
      status.textContent = error instanceof Error && error.message === "missing"
        ? "This app has no service agreement available."
        : "We cannot reach Fidj right now. Try again.";
      retry.hidden = false;
    }
  };
  retry.addEventListener("click", load);
  await load();
}

// The entry every app that delegates to the provider renders, in one place
// because both app shapes render it and they had drifted apart.
//
// "Continue with Fidj" alone borrows the grammar of an optional social login —
// that button always sits next to an email and a password — so on an app whose
// accounts *are* Fidj accounts, the missing form reads as something broken. The
// explanation therefore comes before the button, not as reassurance after it,
// and nothing presupposes an account the person may not have yet.
const hintKey = (appId: string) => "fidj.entry." + appId;

export function signInHint(appId: string) {
  try {
    return localStorage.getItem(hintKey(appId)) || "";
  } catch {
    return "";
  }
}

// Remembered on this app's own origin, about this app's own member: no
// cross-site question is asked, and none is answered. Signing out forgets, so a
// shared browser does not show the next person an address.
export function rememberSignIn(appId: string, label: string) {
  try {
    if (label) localStorage.setItem(hintKey(appId), label);
  } catch {}
}

export function forgetSignIn(appId: string) {
  try {
    localStorage.removeItem(hintKey(appId));
  } catch {}
}

// Both doors, not one. An app that delegates to Fidj still has people who would
// rather type an address and a password than be sent somewhere, and people Fidj
// already recognises who should not have to. So the entry offers the credential
// form and the Fidj entry together, and leads with whichever fits what this
// browser knows: a remembered address puts Fidj first, no memory puts the form
// first.
//
// The trade-off is stated where it is made: on this path the app's own page
// handles the Fidj password, so it is the app — not only Fidj — that must be
// trusted with it. The Fidj entry beside it never is.
export function providerEntry(
  title: string,
  appId: string,
  credentials: string,
  isFidjItself = false,
) {
  const escapeText = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          char
        ]!,
    );
  const hint = signInHint(appId);
  const both = Boolean(credentials);
  const lead = hint
    ? `<p class="signin-lead">You signed in here with Fidj before. ${escapeText(title)} accounts are Fidj accounts — continue as yourself, or use another.</p>`
    : both
      ? `<p class="signin-lead">${escapeText(title)} accounts are Fidj accounts. Sign in below, or let Fidj do it on its own page — where this site never sees your password.</p>`
      : isFidjItself
        ? `<p class="signin-lead">One account across every app that uses Fidj, and a separate set of choices for each one. Sign in, or create yours, on the next screen.</p>`
        : `<p class="signin-lead">${escapeText(title)} accounts are Fidj accounts. You will sign in — or create yours — on Fidj's own page, so this site never sees your password.</p>`;
  const fidj = hint
    ? `<button class="primary" type="submit" name="entry" value="fidj">Continue as ${escapeText(hint)}</button><button type="button" id="forget-hint" class="quiet">Use a different account</button>`
    : `<button class="${both ? "secondary" : "primary"}" type="submit" name="entry" value="fidj">${isFidjItself ? "Sign in" : "Sign in with Fidj"}</button>`;
  // Fidj is the only door: it collects the agreement itself, a moment later, on
  // the screen that names the app — and records it with its version. Collecting
  // it here first recorded nothing and asked the same question twice.
  if (!both) return lead + fidj;
  // Both doors. A remembered address puts Fidj first because it is one tap; no
  // memory puts the form first, because that is what the person came to do.
  const divider = `<div class="signin-divider"><span>or</span></div>`;
  return hint
    ? lead + agreementMarkup() + fidj + divider + credentials
    : lead + agreementMarkup() + credentials + divider + fidj;
}
