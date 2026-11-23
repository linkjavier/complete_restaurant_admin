import { createHmac } from 'crypto';
import { isValidMetaWebhookSignature, isValidWebhookChallenge } from './meta-webhook-security';

describe('Meta WhatsApp webhook validation', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'app-secret-for-test';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts a valid challenge and webhook signature', () => {
    expect(isValidWebhookChallenge('subscribe', 'verify-me', 'verify-me')).toBe(true);
    expect(isValidMetaWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects invalid challenge values, signatures, and missing configuration', () => {
    expect(isValidWebhookChallenge('subscribe', 'wrong', 'verify-me')).toBe(false);
    expect(isValidWebhookChallenge('unsubscribe', 'verify-me', 'verify-me')).toBe(false);
    expect(isValidMetaWebhookSignature(body, signature, undefined)).toBe(false);
    expect(isValidMetaWebhookSignature(body, 'sha256=invalid', secret)).toBe(false);
    expect(isValidMetaWebhookSignature(Buffer.from('tampered'), signature, secret)).toBe(false);
  });
});
