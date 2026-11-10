/**
 * billing-webhook — receives RevenueCat webhooks and grants/revokes Premium.
 *
 * RevenueCat wraps Google Play Billing and Apple StoreKit and verifies receipts
 * with the stores. Configure RevenueCat with the Supabase user id as the
 * `appUserID`, and set the webhook Authorization header to
 * `Bearer <REVENUECAT_WEBHOOK_SECRET>` (a function secret). The app never
 * grants Premium to itself.
 */
import { adminClient, error, json } from '../_shared/http.ts';

const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'TEMPORARY_ENTITLEMENT_GRANT']);
const REVOKE = new Set(['EXPIRATION']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return error('Method not allowed.', 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) return error('Webhook not configured.', 503);
  if (!safeEqual(req.headers.get('Authorization') ?? '', `Bearer ${secret}`)) return error('Unauthorized.', 401);

  let event: Record<string, unknown>;
  try {
    event = ((await req.json()) as { event?: Record<string, unknown> }).event ?? {};
  } catch {
    return error('invalid payload');
  }

  const type = String(event.type ?? '');
  const userId = String(event.app_user_id ?? '');
  if (!UUID.test(userId)) return json({ ignored: 'anonymous or unknown user' });

  const admin = adminClient();
  if (GRANT.has(type)) {
    const expires = typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms).toISOString() : null;
    const { error: e } = await admin.from('profiles').update({ is_premium: true, premium_until: expires }).eq('id', userId);
    if (e) return error('update failed', 500);
  } else if (REVOKE.has(type)) {
    const { error: e } = await admin.from('profiles').update({ is_premium: false }).eq('id', userId);
    if (e) return error('update failed', 500);
  }
  return json({ ok: true, type });
});
