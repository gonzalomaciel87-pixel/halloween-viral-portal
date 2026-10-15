import { createHash } from 'node:crypto';

export const META_GRAPH_API_VERSION = 'v26.0';
export const META_PIXEL_ID = '1802357817632953';
export const META_EVENT_SOURCE_URL = 'https://halloween-viral.netlify.app/';

const META_ENDPOINT = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PIXEL_ID}/events`;
const PHONE_COUNTRY_CODES = Object.freeze({
  AR: '54',
  BO: '591',
  BR: '55',
  CL: '56',
  CO: '57',
  CR: '506',
  DO: '1',
  EC: '593',
  ES: '34',
  GT: '502',
  HN: '504',
  MX: '52',
  NI: '505',
  PA: '507',
  PE: '51',
  PR: '1',
  PY: '595',
  SV: '503',
  US: '1',
  UY: '598',
  VE: '58'
});

function text(value) {
  return String(value ?? '').trim();
}

function normalizePlainText(value) {
  return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hashed(value, normalize = normalizePlainText) {
  const normalized = normalize(value);
  return normalized ? [sha256(normalized)] : undefined;
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function normalizeCountry(value) {
  return text(value).slice(0, 2).toLowerCase();
}

function normalizePhone(value, countryIso, areaCode = '') {
  const rawPhone = text(value).replace(/\D/g, '');
  const rawAreaCode = text(areaCode).replace(/\D/g, '');
  if (!rawPhone) return '';

  const country = text(countryIso).toUpperCase();
  const callingCode = PHONE_COUNTRY_CODES[country] || '';
  if (!callingCode) return `${rawAreaCode}${rawPhone}`;

  const localPhone = `${rawAreaCode}${rawPhone}`;
  return localPhone.startsWith(callingCode) ? localPhone : `${callingCode}${localPhone}`;
}

function decodeSck(value) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

export function parseMetaSck(sck) {
  const attribution = {};
  const decoded = decodeSck(text(sck));
  decoded.split('|').forEach((segment) => {
    const match = segment.match(/^(fbc|fbp)[.=](.+)$/i);
    if (!match) return;
    const key = match[1].toLowerCase();
    const value = text(match[2]);
    if (/^fb\.\d+\.\d+\..+/.test(value)) attribution[key] = value;
  });
  return attribution;
}

function epochSeconds(value, fallback) {
  const numeric = Number(value || fallback);
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.floor(Date.now() / 1000);
  return Math.floor(numeric > 100_000_000_000 ? numeric / 1000 : numeric);
}

function buyerNames(buyer) {
  const fullName = text(buyer?.name).split(/\s+/).filter(Boolean);
  return {
    firstName: text(buyer?.firstName) || fullName[0] || '',
    lastName: text(buyer?.lastName) || fullName.slice(1).join(' ')
  };
}

export function buildMetaPurchaseEvent(event) {
  const buyer = event?.buyer || {};
  const countryIso = text(buyer.countryIso).toUpperCase();
  const { firstName, lastName } = buyerNames(buyer);
  const phone = normalizePhone(buyer.phone, countryIso, buyer.phoneAreaCode);
  const attribution = parseMetaSck(event?.sck);
  const userData = {
    em: hashed(buyer.email, normalizeEmail),
    ph: hashed(phone, (value) => text(value).replace(/\D/g, '')),
    fn: hashed(firstName),
    ln: hashed(lastName),
    ct: hashed(buyer.city),
    country: hashed(countryIso, normalizeCountry),
    ...attribution
  };
  Object.keys(userData).forEach((key) => {
    if (!userData[key] || (Array.isArray(userData[key]) && userData[key].length === 0)) delete userData[key];
  });

  const value = Number(event?.value);
  const productId = String(event?.productId || '');
  const customData = {
    currency: text(event?.currency).toUpperCase(),
    value: Number.isFinite(value) ? value : undefined,
    content_ids: productId ? [productId] : undefined,
    content_type: 'product',
    content_name: text(event?.productName) || 'Halloween Viral',
    contents: productId ? [{ id: productId, quantity: 1, ...(Number.isFinite(value) ? { item_price: value } : {}) }] : undefined,
    order_id: text(event?.transaction)
  };
  Object.keys(customData).forEach((key) => {
    if (customData[key] === undefined || customData[key] === '') delete customData[key];
  });

  return {
    event_name: 'Purchase',
    event_time: epochSeconds(event?.approvedDate, event?.creationDate),
    event_source_url: META_EVENT_SOURCE_URL,
    action_source: 'website',
    event_id: `hotmart_${text(event?.transaction)}`,
    user_data: userData,
    custom_data: customData
  };
}

function safeEventReference(event) {
  return sha256(text(event?.transaction) || 'unknown').slice(0, 12);
}

function sanitizedFailure(error) {
  if (error?.name === 'AbortError') return 'timeout';
  if (String(error?.message || '').startsWith('meta_http_')) return String(error.message);
  return 'request_failed';
}

export async function sendMetaPurchase(event, { getEnv, fetchImpl = fetch, logger = console, timeoutMs = 5000 } = {}) {
  const token = text(getEnv?.('META_CAPI_TOKEN'));
  if (!token) {
    logger.warn?.('meta_capi_skipped', { reason: 'missing_token', event_ref: safeEventReference(event) });
    return { ok: false, reason: 'missing_token' };
  }

  const body = { data: [buildMetaPurchaseEvent(event)] };
  const testEventCode = text(getEnv?.('META_TEST_EVENT_CODE'));
  if (testEventCode) body.test_event_code = testEventCode;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(META_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`meta_http_${response.status}`);
    const result = await response.json();
    logger.info?.('meta_capi_purchase', {
      ok: true,
      event_ref: safeEventReference(event),
      events_received: Number(result?.events_received || 0),
      test_mode: Boolean(testEventCode)
    });
    return { ok: true, eventsReceived: Number(result?.events_received || 0), testMode: Boolean(testEventCode) };
  } catch (error) {
    const reason = sanitizedFailure(error);
    logger.error?.('meta_capi_failed', { reason, event_ref: safeEventReference(event), test_mode: Boolean(testEventCode) });
    return { ok: false, reason, testMode: Boolean(testEventCode) };
  } finally {
    clearTimeout(timeout);
  }
}
