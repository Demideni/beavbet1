import crypto from "crypto";

function escapeSlashes(json: string) {
  // PassimPay examples show escaping forward slashes before signing.
  return json.replace(/\//g, "\\/");
}

export function passimpaySignature(platformId: number | string, body: any, secret: string) {
  const bodyJson = escapeSlashes(JSON.stringify(body));
  const contract = `${platformId};${bodyJson};${secret}`;
  return crypto.createHmac("sha256", secret).update(contract).digest("hex");
}

export function passimpayVerifySignature(platformId: number | string, rawBody: string, secret: string, receivedSignature: string | null) {
  if (!receivedSignature) return false;
  // Re-serialize body as in docs (parse then JSON.stringify) to keep canonical formatting
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = passimpaySignature(platformId, body, secret);
  // Timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(receivedSignature, "utf8"));
  } catch {
    return false;
  }
}
