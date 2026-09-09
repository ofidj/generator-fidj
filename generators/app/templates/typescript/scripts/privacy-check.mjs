import {createHmac, randomUUID} from 'node:crypto';

try {
  const key = process.env.FIDJ_PRIVACY_ADAPTER_KEY;
  const appId = process.env.FIDJ_APP_ID;
  if (!appId || !key || key.length < 32) throw new Error('Set FIDJ_APP_ID and a private FIDJ_PRIVACY_ADAPTER_KEY of at least 32 characters in .env.');
  const url = new URL(process.env.FIDJ_APP_URL || `http://127.0.0.1:${process.env.PORT || 8200}`);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Use a trusted HTTPS app URL, or loopback HTTP for development.');
  url.pathname = url.pathname.replace(/\/$/, '') + '/fidj/privacy';
  const timestamp = String(Date.now());
  const data = {appId, subject: 'readiness-check', operation: 'check', requestId: randomUUID()};
  const text = JSON.stringify(data);
  const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-fidj-timestamp': timestamp, 'x-fidj-signature': createHmac('sha256', key).update(timestamp + '.' + text).digest('hex')}, body: text, signal: AbortSignal.timeout(5000), redirect: 'error'});
  if (!response.ok) throw new Error('The app-data handler could not be verified. Check the URL, shared secret and server.');
  const result = await response.json();
  if (result.requestId !== data.requestId || result.status !== 'completed' || result.storage !== 'ready' || !['export', 'erase'].every(capability => result.capabilities?.includes(capability))) throw new Error('The handler did not confirm both operations and writable storage.');
  console.log('Ready: app-data export, erasure and writable storage verified. No user data was created or erased.');
} catch (error) {
  console.error(error.message || 'The readiness check failed.');
  process.exitCode = 1;
}
