import crypto from 'crypto';

/**
 * Validate Freepik webhook signature using HMAC-SHA256
 * Based on Freepik webhook security documentation
 *
 * @param webhookId - The webhook ID from the 'webhook-id' header
 * @param webhookTimestamp - The timestamp from the 'webhook-timestamp' header
 * @param webhookSignature - The signature from the 'webhook-signature' header
 * @param rawBody - The raw request body as a string
 * @param secret - The webhook secret from environment variables
 * @returns true if signature is valid, false otherwise
 */
export function validateWebhookSignature(
  webhookId: string | null,
  webhookTimestamp: string | null,
  webhookSignature: string | null,
  rawBody: string,
  secret: string | undefined
): boolean {
  if (!webhookId || !webhookTimestamp || !webhookSignature || !secret) {
    console.error('Missing webhook validation parameters');
    return false;
  }

  // Signature = HMAC-SHA256(webhookId.webhookTimestamp.rawBody, secret)
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('base64');

  // Extract signature from header (format: "v1,signature1 v1,signature2")
  const signatures = webhookSignature.split(' ');

  for (const sig of signatures) {
    const [version, signature] = sig.split(',');
    if (version === 'v1' && signature === expectedSignature) {
      return true;
    }
  }

  console.error('Webhook signature validation failed');
  return false;
}
