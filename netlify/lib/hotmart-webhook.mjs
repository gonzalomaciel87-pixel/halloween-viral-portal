import { timingSafeEqual } from 'node:crypto';
import { isValidBuyerEmail, normalizeBuyerEmail } from './buyer-admin.mjs';

const GRANT_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const REVOKE_EVENTS = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED']);
const KNOWN_EVENTS = new Set([
  ...GRANT_EVENTS,
  ...REVOKE_EVENTS,
  'PURCHASE_REFUND_REQUESTED',
  'PURCHASE_BILLET_PRINTED',
  'PURCHASE_EXPIRED',
  'PURCHASE_DELAYED',
  'PURCHASE_OVERDUE',
  'PURCHASE_AWAITING_PAYMENT'
]);

export function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function normalizeHotmartEvent(payload) {
  const eventType = String(payload?.event || '').toUpperCase();
  const purchase = payload?.data?.purchase || {};
  const product = payload?.data?.product || {};
  const buyer = payload?.data?.buyer || {};
  const status = String(purchase.status || '').toUpperCase();
  const email = normalizeBuyerEmail(buyer.email);
  const productId = Number.isSafeInteger(Number(product.id)) ? Number(product.id) : null;
  const productUcode = String(product.ucode || '').trim();
  const creationDate = Number(payload?.creation_date);
  return {
    eventId: String(payload?.id || '').trim(),
    version: String(payload?.version || '').trim(),
    eventType,
    creationDate,
    transaction: String(purchase.transaction || '').trim(),
    email,
    productId,
    productUcode,
    status,
    active: GRANT_EVENTS.has(eventType) ? ['APPROVED', 'COMPLETE'].includes(status) : null
  };
}

export function validateHotmartEvent(event) {
  if (event.version !== '2.0.0') return 'unsupported_version';
  if (!event.eventId || event.eventId.length > 200) return 'invalid_event_id';
  if (!KNOWN_EVENTS.has(event.eventType)) return 'unsupported_event';
  if (!Number.isSafeInteger(event.creationDate) || event.creationDate <= 0) return 'invalid_creation_date';
  if (!event.transaction || event.transaction.length > 200) return 'invalid_transaction';
  if (!isValidBuyerEmail(event.email)) return 'invalid_email';
  if (!event.productId && !event.productUcode) return 'invalid_product';
  if (!event.status) return 'invalid_status';
  return null;
}

export function matchesConfiguredProduct(event, expectedId, expectedUcode) {
  const idConfigured = String(expectedId || '').trim();
  const ucodeConfigured = String(expectedUcode || '').trim();
  if (!idConfigured && !ucodeConfigured) return false;
  return (!idConfigured || String(event.productId) === idConfigured)
    && (!ucodeConfigured || event.productUcode === ucodeConfigured);
}

export function eventAccessState(event) {
  if (GRANT_EVENTS.has(event.eventType)) return event.active;
  if (REVOKE_EVENTS.has(event.eventType)) return false;
  return null;
}

export function effectiveAccess(manualAccess, transactions) {
  return Boolean(manualAccess || transactions.some((transaction) => transaction.active));
}

export function applyOrderedEvent(current, incoming) {
  if (!current) return incoming;
  const currentTerminal = ['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(current.status);
  const incomingTerminal = ['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(incoming.status);
  if (incoming.creationDate < current.creationDate) return current;
  if (currentTerminal && !incomingTerminal) return current;
  return incoming;
}

export function createHotmartHandler({ getEnv, processEvent }) {
  return async function handle(request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    if (!secureEqual(request.headers.get('x-hotmart-hottok'), getEnv('HOTMART_HOTTOK'))) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload;
    try { payload = await request.json(); }
    catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

    const event = normalizeHotmartEvent(payload);
    const validationError = validateHotmartEvent(event);
    if (validationError === 'unsupported_event') return Response.json({ ok: true, outcome: 'ignored_event' });
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    if (!matchesConfiguredProduct(event, getEnv('HOTMART_PRODUCT_ID'), getEnv('HOTMART_PRODUCT_UCODE'))) {
      return Response.json({ ok: true, outcome: 'ignored_product' });
    }

    const result = await processEvent({ ...event, active: eventAccessState(event) });
    return Response.json({ ok: true, outcome: result?.outcome || 'processed' });
  };
}
