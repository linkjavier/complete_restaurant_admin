import { createHmac, timingSafeEqual } from 'crypto';

export function isValidWebhookChallenge(
  mode: string | undefined,
  suppliedToken: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (mode !== 'subscribe' || !suppliedToken || !expectedToken) return false;
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isValidMetaWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const supplied = Buffer.from(signature.slice('sha256='.length), 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
