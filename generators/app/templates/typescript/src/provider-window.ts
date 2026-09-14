// Signing in happens in a window of its own.
//
// Fidj's screens are served from another origin — Fidj's front end, or the API
// itself, depending on the deployment — and that origin refuses to be framed,
// so no dialog drawn inside this page can hold them. A window can, and it keeps
// the page the person was already on: they come back to what they were reading,
// not to a shell that reloaded underneath them and forgot where they were.
//
// The window is opened empty and synchronously, before anything is awaited. A
// window opened after an await is a window the browser no longer connects to
// the click that asked for it, and every popup blocker refuses it — so the
// authorization URL, which takes a discovery round-trip to build, is fetched
// afterwards and navigated into a window that already exists.

// One window per page, not one per browser.
//
// Naming it is what lets a second press reuse the window instead of stacking
// another one on top, and that much is wanted. Sharing the name across tabs is
// not: the answer comes back to whichever page opened the window, so a second
// tab reusing the first tab's window would hand that tab's sign-in to a page
// that never asked, and leave the one that did waiting forever. Stable for this
// document, unique to it.
const WINDOW_NAME = "fidj-signin-" + Math.random().toString(36).slice(2, 10);
const CALLBACK = "fidj:oidc-callback";

// Comfortable rather than minimal: the provider asks for a password, states who
// is asking and where the person is going back to, and a cramped window turns
// that into scrolling. Clamped to the screen so a small display still gets a
// window it can show whole, and centred on the display the opener is on.
function features() {
  const width = Math.min(560, Math.max(320, window.screen.availWidth - 80));
  const height = Math.min(760, Math.max(480, window.screen.availHeight - 80));
  const left = Math.round(
    (window.screenX || 0) + Math.max(0, (window.outerWidth - width) / 2),
  );
  const top = Math.round(
    (window.screenY || 0) + Math.max(0, (window.outerHeight - height) / 3),
  );
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

export type ProviderWindow = {
  // Send the opened window to the provider. Separate from opening it because
  // the URL is not known yet at the moment the click has to be honoured.
  show(url: string): void;
  // Still open, and still the one being waited for.
  isOpen(): boolean;
  // Bring it back in front. A window can be behind the page that opened it, on
  // another desktop, or minimised, and from the page that looks exactly like
  // nothing having happened — so the page needs to be able to fetch it.
  focus(): void;
  // Close it: the provider could not be reached and there is nothing for the
  // window to show, or the person asked to stop.
  giveUp(): void;
  // The callback the provider handed to that window, or null when the person
  // closed it without finishing. Closing is a decision, not a failure: it
  // resolves so the entry simply reappears, with nothing said.
  answer(): Promise<URL | null>;
};

export function openProviderWindow(): ProviderWindow | null {
  let opened: Window | null = null;
  try {
    opened = window.open("", WINDOW_NAME, features());
  } catch {
    opened = null;
  }
  // Blocked, or a browser that refuses named windows. The caller falls back to
  // leaving this page, which is the flow this one replaced.
  if (!opened) return null;
  try {
    opened.document.write(
      '<!doctype html><meta charset="utf-8"><title>Signing in with Fidj</title><body style="margin:0;font:15px/1.5 system-ui;color:#4a4540;display:grid;place-items:center;height:100vh">Opening Fidj…</body>',
    );
    opened.document.close();
  } catch {}
  return {
    show(url: string) {
      // `replace`, so the blank placeholder is not a history entry the person
      // can press Back into.
      try {
        opened!.location.replace(url);
      } catch {
        opened!.location.href = url;
      }
    },
    isOpen() {
      try {
        return !opened!.closed;
      } catch {
        return false;
      }
    },
    focus() {
      try {
        opened!.focus();
      } catch {}
    },
    giveUp() {
      try {
        opened!.close();
      } catch {}
    },
    answer() {
      return new Promise<URL | null>((resolve) => {
        let done = false;
        const finish = (result: URL | null) => {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          window.clearInterval(watch);
          try {
            opened!.close();
          } catch {}
          resolve(result);
        };
        const onMessage = (event: MessageEvent) => {
          // Only this origin, and only the window this entry opened: the
          // callback carries a single-use authorization code, and anything else
          // posting into this page is not part of this conversation.
          if (event.origin !== window.location.origin) return;
          if (event.source !== opened) return;
          const data = event.data as { fidj?: string; href?: string } | null;
          if (!data || data.fidj !== CALLBACK || typeof data.href !== "string")
            return;
          let callback: URL;
          try {
            callback = new URL(data.href);
          } catch {
            return;
          }
          if (callback.origin !== window.location.origin) return;
          finish(callback);
        };
        window.addEventListener("message", onMessage);
        // A window closed by hand answers nothing, and nothing is what this
        // page would wait for forever otherwise. `closed` is the only signal a
        // cross-origin window gives, so it is polled.
        const watch = window.setInterval(() => {
          if (opened!.closed) finish(null);
        }, 400);
      });
    },
  };
}

// The other half, running in that window: the provider has just answered into
// it, and its only remaining job is to hand the answer back and get out of the
// way. It never completes the sign-in itself — the transaction that has to
// match the answer was written by the page that opened it, and session storage
// is copied into a new window, not shared with it.
//
// Answering `true` means the hand-off was made and this window asked to close;
// the caller shows one line and, if the browser refuses to close a window it
// did not see scripted open, finishes the sign-in here after all.
export function relayProviderAnswer(): boolean {
  let opener: Window | null = null;
  try {
    opener = window.opener as Window | null;
  } catch {
    return false;
  }
  if (!opener || opener === window || opener.closed) return false;
  if (!new URL(window.location.href).searchParams.has("state")) return false;
  try {
    opener.postMessage(
      { fidj: CALLBACK, href: window.location.href },
      window.location.origin,
    );
  } catch {
    return false;
  }
  try {
    window.close();
  } catch {}
  return true;
}
