export function agreementMarkup() {
  return `<div class="signin-agreement"><label class="agreement-choice"><input id="service-agreement" type="checkbox" aria-required="true" disabled><span id="agreement-label">I accept the service agreement for this app.</span></label><button type="button" id="read-agreement" disabled>Read service agreement</button><p id="agreement-status" class="fineprint" role="status">Loading service agreement…</p></div><dialog id="agreement-dialog" aria-labelledby="agreement-heading"><h2 id="agreement-heading">Service agreement</h2><p id="agreement-version"></p><p id="agreement-text"></p><button type="button" id="close-agreement">Close agreement</button></dialog>`;
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
  const checkbox = form.querySelector<HTMLInputElement>("#service-agreement")!;
  const read = form.querySelector<HTMLButtonElement>("#read-agreement")!;
  const dialog = form.querySelector<HTMLDialogElement>("#agreement-dialog")!;
  const status = form.querySelector<HTMLElement>("#agreement-status")!;
  const submitButtons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
  const update = () => submitButtons.forEach(button => { button.disabled = checkbox.disabled; });
  form.querySelector("#agreement-label")!.textContent = `I accept the service agreement for ${title}.`;
  update();
  checkbox.addEventListener("change", update);
  read.addEventListener("click", () => dialog.showModal());
  form.querySelector("#close-agreement")!.addEventListener("click", () => dialog.close());
  try {
    const response = await fetch(`${endpoint}/apps/${encodeURIComponent(appId)}`, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error("Agreement unavailable");
    const agreement = (await response.json()).app?.agreement;
    if (!agreement || typeof agreement.version !== "string" || !agreement.version || typeof agreement.text !== "string" || !agreement.text) throw new Error("Agreement unavailable");
    if (!form.isConnected) return;
    checkbox.dataset.version = agreement.version;
    checkbox.disabled = false;
    checkbox.checked = checked;
    read.disabled = false;
    dialog.querySelector("#agreement-version")!.textContent = `Version ${agreement.version}`;
    dialog.querySelector("#agreement-text")!.textContent = agreement.text;
    status.textContent = "Required to sign in. Optional data choices stay separate.";
    update();
  } catch {
    if (form.isConnected) status.textContent = "The service agreement could not be loaded. Reload this page to try again.";
  }
}
