const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { stripTypeScriptTypes } = require("node:module");

const templates = path.join(
  __dirname,
  "../generators/app/templates/typescript/src",
);

// "I have to sign in again" after half an hour, on every new tab. The shell
// asked `isLoggedIn()` — which reads only the refresh token's expiry — and then
// sent the stored ID token, which lives thirty minutes, without refreshing it.
// The API answered 401, and the 401 branch called `logout(true)`: that deletes
// the refresh token on the server and in the browser. A session that had days
// left was ended by the one request meant to read it.
//
// So a request made on the SDK's own session refreshes first, and a 401 is
// retried once on a forced refresh before anything is thrown away.
async function load() {
  const file = path.join(templates, "api-request.ts");
  const code = stripTypeScriptTypes(fs.readFileSync(file, "utf8"));
  return import("data:text/javascript," + encodeURIComponent(code));
}

const jwt = (exp) =>
  `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;

function fakeSdk() {
  const calls = [];
  let token = jwt(Math.floor(Date.now() / 1000) - 60); // expired
  let loggedIn = true;
  return {
    calls,
    sdk: {
      async sync(options) {
        calls.push(["sync", !!options?.forceRefresh]);
        token = jwt(Math.floor(Date.now() / 1000) + 1800);
      },
      async fidjGetIdToken() {
        calls.push(["token"]);
        return token;
      },
      async logout(force) {
        calls.push(["logout", force]);
        loggedIn = false;
      },
      isLoggedIn: () => loggedIn,
    },
    get token() {
      return token;
    },
  };
}

const answer = (status, body = {}) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

test("an expired ID token is refreshed before it is sent", async () => {
  const { authorizedRequest } = await load();
  const fake = fakeSdk();
  const sent = [];
  let signedOut = false;
  const request = authorizedRequest({
    sdk: fake.sdk,
    providerSession: () => false,
    baseUrl: "https://api.example/v3",
    onSignedOut: () => (signedOut = true),
    fetch: async (url, init) => {
      sent.push(init.headers.Authorization);
      const exp = JSON.parse(
        Buffer.from(init.headers.Authorization.split(".")[1], "base64url"),
      ).exp;
      return exp * 1000 > Date.now() ? answer(200, { ok: 1 }) : answer(401);
    },
  });
  assert.deepEqual(await request("/me"), { ok: 1 });
  assert.deepEqual(fake.calls[0], ["sync", false]);
  assert.equal(sent.length, 1);
  assert.ok(!fake.calls.some(([name]) => name === "logout"));
  assert.equal(signedOut, false);
});

test("a 401 is retried once on a forced refresh before signing out", async () => {
  const { authorizedRequest } = await load();
  const fake = fakeSdk();
  let answers = [answer(401), answer(200, { ok: 2 })];
  const request = authorizedRequest({
    sdk: fake.sdk,
    providerSession: () => false,
    baseUrl: "",
    onSignedOut: () => assert.fail("signed out on a recoverable 401"),
    fetch: async () => answers.shift(),
  });
  assert.deepEqual(await request("/me"), { ok: 2 });
  assert.ok(fake.calls.some(([name, force]) => name === "sync" && force));
  assert.ok(!fake.calls.some(([name]) => name === "logout"));
});

test("a session the refresh cannot save is ended, once", async () => {
  const { authorizedRequest } = await load();
  const fake = fakeSdk();
  let signedOut = 0;
  const request = authorizedRequest({
    sdk: fake.sdk,
    providerSession: () => false,
    baseUrl: "",
    onSignedOut: () => signedOut++,
    fetch: async () => answer(401, { message: "gone" }),
  });
  await assert.rejects(request("/me"), /gone/);
  assert.equal(signedOut, 1);
  assert.equal(fake.calls.filter(([name]) => name === "logout").length, 1);
});

test("a provider session refreshes itself and is not synced", async () => {
  const { authorizedRequest } = await load();
  const fake = fakeSdk();
  const request = authorizedRequest({
    sdk: fake.sdk,
    providerSession: () => true,
    baseUrl: "",
    onSignedOut: () => {},
    fetch: async () => answer(200, {}),
  });
  await request("/me");
  assert.ok(!fake.calls.some(([name]) => name === "sync"));
});

test("both starters send their requests through it", () => {
  for (const name of ["content.ts", "main.ts"]) {
    const source = fs.readFileSync(path.join(templates, name), "utf8");
    assert.match(source, /from "\.\/api-request(\.js)?"/, name);
    assert.doesNotMatch(
      source,
      /const token = await sdk\.fidjGetIdToken\(\)/,
      `${name} still reads the stored token without refreshing it`,
    );
  }
});

test("a 403 refuses one action and signs nobody out", async () => {
  const { authorizedRequest } = await load();
  const fake = fakeSdk();
  const request = authorizedRequest({
    sdk: fake.sdk,
    providerSession: () => false,
    baseUrl: "",
    onSignedOut: () => assert.fail("signed out on a 403"),
    fetch: async () => answer(403, { message: "forbidden" }),
  });
  await assert.rejects(request("/me"), /forbidden/);
  assert.ok(!fake.calls.some(([name]) => name === "logout"));
});
