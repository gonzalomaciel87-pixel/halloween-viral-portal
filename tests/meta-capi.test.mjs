import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  META_GRAPH_API_VERSION,
  buildMetaPurchaseEvent,
  parseMetaSck,
  sendMetaPurchase
} from '../netlify/lib/meta-capi.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

function approvedEvent(overrides = {}) {
  return {
    eventType: 'PURCHASE_APPROVED',
    status: 'APPROVED',
    creationDate: 1_760_000_000_000,
    approvedDate: 1_760_000_123_000,
    transaction: 'HP-TEST-001',
    productId: 8676601,
    productName: 'Halloween Viral',
    value: 33637,
    currency: 'COP',
    sck: 'fbc.fb.1.1760000000000.click-id|fbp.fb.1.1760000000000.browser-id',
    buyer: {
      email: ' Buyer@Example.COM ',
      firstName: 'Ána',
      lastName: 'Pérez',
      phone: '300 123 4567',
      city: 'Bogotá',
      countryIso: 'CO'
    },
    ...overrides
  };
}

test('construye Purchase con datos normalizados, hash y atribución sin hash', () => {
  const event = buildMetaPurchaseEvent(approvedEvent());
  assert.equal(META_GRAPH_API_VERSION, 'v26.0');
  assert.equal(event.event_id, 'hotmart_HP-TEST-001');
  assert.equal(event.event_time, 1_760_000_123);
  assert.equal(event.action_source, 'website');
  assert.equal(event.custom_data.value, 33637);
  assert.equal(event.custom_data.currency, 'COP');
  assert.deepEqual(event.custom_data.content_ids, ['8676601']);
  assert.equal(event.custom_data.order_id, 'HP-TEST-001');
  assert.deepEqual(event.user_data.em, [hash('buyer@example.com')]);
  assert.deepEqual(event.user_data.ph, [hash('573001234567')]);
  assert.deepEqual(event.user_data.fn, [hash('ana')]);
  assert.deepEqual(event.user_data.ln, [hash('perez')]);
  assert.deepEqual(event.user_data.ct, [hash('bogota')]);
  assert.deepEqual(event.user_data.country, [hash('co')]);
  assert.equal(event.user_data.fbc, 'fb.1.1760000000000.click-id');
  assert.equal(event.user_data.fbp, 'fb.1.1760000000000.browser-id');
});

test('omite datos de usuario ausentes y acepta sck codificado', () => {
  assert.deepEqual(parseMetaSck('fbc.fb.1.1.a%7Cfbp.fb.1.2.b'), {
    fbc: 'fb.1.1.a',
    fbp: 'fb.1.2.b'
  });
  const event = buildMetaPurchaseEvent(approvedEvent({ buyer: { email: 'buyer@example.com' }, sck: '' }));
  assert.deepEqual(Object.keys(event.user_data), ['em']);
});

test('envía el token por Authorization y agrega el código de prueba solo cuando existe', async () => {
  let request;
  const logger = { info() {}, warn() {}, error() {} };
  const result = await sendMetaPurchase(approvedEvent(), {
    getEnv: (name) => ({ META_CAPI_TOKEN: 'secret-token', META_TEST_EVENT_CODE: 'test-code' })[name] || '',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json({ events_received: 1 });
    },
    logger
  });
  const body = JSON.parse(request.options.body);
  assert.equal(result.ok, true);
  assert.match(request.url, /\/v26\.0\/1802357817632953\/events$/);
  assert.equal(request.options.headers.authorization, 'Bearer secret-token');
  assert.equal(body.test_event_code, 'test-code');
  assert.equal(body.data[0].event_name, 'Purchase');
});

test('un fallo de Meta queda contenido y sanitizado', async () => {
  const errors = [];
  const result = await sendMetaPurchase(approvedEvent(), {
    getEnv: (name) => name === 'META_CAPI_TOKEN' ? 'secret-token' : '',
    fetchImpl: async () => new Response('sensitive response', { status: 400 }),
    logger: { info() {}, warn() {}, error(name, data) { errors.push({ name, data }); } }
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'meta_http_400');
  assert.equal(errors[0].name, 'meta_capi_failed');
  assert.deepEqual(Object.keys(errors[0].data).sort(), ['event_ref', 'reason', 'test_mode']);
});
