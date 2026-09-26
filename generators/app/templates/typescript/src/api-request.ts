// A request made for the person signed in, and what a 401 is allowed to cost.
//
// The SDK's own session keeps an ID token that lives half an hour and a refresh
// token that lives for days, and `isLoggedIn()` reads only the second. Sending
// the stored ID token as it stood therefore failed on every tab opened more
// than thirty minutes after signing in, and the 401 branch then ended the
// session for good — `logout(true)` deletes the refresh token on the server and
// in the browser. So the token is refreshed before it is sent, and a 401 is
// retried once on a forced refresh before anything is thrown away.
//
// A provider (OIDC) session refreshes its own token when it reads it, so it is
// not synced here: that would cost a round trip on every request.

type Sdk = {
  sync(options: { forceRefresh: boolean }): Promise<unknown>;
  fidjGetIdToken(): Promise<string | undefined> | string | undefined;
  logout(force?: boolean): Promise<unknown>;
  isLoggedIn(): boolean;
};

export function authorizedRequest(options: {
  sdk: Sdk;
  providerSession: () => boolean;
  baseUrl: string;
  onSignedOut: () => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}) {
  const send = async (
    path: string,
    method: string,
    data: unknown,
    forceRefresh: boolean,
  ) => {
    if (!options.providerSession()) await options.sdk.sync({ forceRefresh });
    const token = await options.sdk.fidjGetIdToken();
    return (options.fetch ?? fetch)(options.baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });
  };

  return async function request(
    path: string,
    method = "GET",
    data?: unknown,
  ): Promise<any> {
    let response: Response;
    try {
      response = await send(path, method, data, false);
      if (response.status === 401 && !options.providerSession())
        response = await send(path, method, data, true);
    } catch (error) {
      // A refresh the API refused has already ended the session in the SDK;
      // one that only failed to reach it leaves it standing.
      if (!options.sdk.isLoggedIn()) options.onSignedOut();
      throw error;
    }
    const result = await response.json();
    if (!response.ok) {
      // Only a 401 means the session is gone; a 403 refuses one action to
      // somebody still signed in, and signing them out for it ended the
      // console's session on the first forbidden request.
      if (response.status === 401) {
        options.onSignedOut();
        await options.sdk.logout(true);
      }
      throw new Error(result.message || result.status || "Please retry.");
    }
    return result;
  };
}
