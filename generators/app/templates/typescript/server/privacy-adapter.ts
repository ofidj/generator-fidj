import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPrivacyRequest(
  key: string | undefined,
  timestamp: string,
  signature: string,
  payload: unknown,
) {
  if (
    !key ||
    key.length < 32 ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", key)
    .update(timestamp + "." + JSON.stringify(payload))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
