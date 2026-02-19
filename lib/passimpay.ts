import crypto from "node:crypto";

/**
 * PassimPay signature
 * Contract: `${platformId};${bodyStr};${apiKey}` where apiKey is also the HMAC secret.
 * IMPORTANT: bodyStr MUST be exactly the JSON string you send / receive.
 */
export function passimpaySignature(platformId: string, body: unknown, apiKey: string) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const signatureContract = `${platformId};${bodyStr};${apiKey}`;
  return crypto.createHmac("sha256", apiKey).update(signatureContract, "utf8").digest("hex").toLowerCase();
}

export function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
