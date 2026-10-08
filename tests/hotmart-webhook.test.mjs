import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOrderedEvent,
  createHotmartHandler,
  effectiveAccess
} from '../netlify/lib/hotmart-webhook.mjs';

const HOTTOK = 'test-hottok-never-used-in-production';
const PRODUCT_ID = '8676601';

function payload(overrides = {}) {
  const event = overrides.event || 'PURCHASE_APPROVED';
  const status = overrides.status || (event === 'PURCHASE_APPROVED' ? 'APPROVED' : 'WAITING_PAYMENT');
  return {
    id: overrides.id || `evt-${Math.random()}`,
    creation_date: overrides.creationDate || 100,
    event,
    version: '2.0.0',
    data: {
      product: { id: overrides.productId ?? 8676601, ucode: overrides.productUcode || 'hv-reference' },
      buyer: { email: overrides.email || 'Comprador@GMAIL.com' },
      purchase: { transaction: overrides.transaction || 'HP0001', status }
    }
  };
}

function createMemorySystem({ manual = {} } = {}) {
  const events = new Set();
  const transactions = new Map();
  const manualAccess = new Map(Object.entries(manual));
  const processEvent = async (incoming) => {
    if (events.has(incoming.eventId)) return { outcome: 'duplicate' };
    events.add(incoming.eventId);
    const current = transactions.get(incoming.transaction);
    const next = applyOrderedEvent(current, {
      creationDate: incoming.creationDate,
      status: incoming.status,
      active: incoming.active ?? current?.active ?? false,
      email: incoming.email
    });
    if (next === current) return { outcome: 'out_of_order' };
    transactions.set(incoming.transaction, next);
    return { outcome: 'processed' };
  };
  const getEnv = (name) => ({
    HOTMART_HOTTOK: HOTTOK,
    HOTMART_PRODUCT_ID: PRODUCT_ID,
    HOTMART_PRODUCT_UCODE: ''
  })[name] || '';
  const handler = createHotmartHandler({ getEnv, processEvent });
  const send = (body, token = HOTTOK) => handler(new Request('https://example.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hotmart-hottok': token },
    body: JSON.stringify(body)
  }));
  const hasAccess = (email) => effectiveAccess(manualAccess.get(email) === true, [...transactions.values()].filter((row) => row.email === email));
  return { send, events, transactions, hasAccess };
}

test('compra aprobada normaliza el correo y habilita acceso', async () => {
  const system = createMemorySystem();
  const response = await system.send(payload({ id: 'approved-1' }));
  assert.equal(response.status, 200);
  assert.equal(system.transactions.get('HP0001').email, 'comprador@gmail.com');
  assert.equal(system.hasAccess('comprador@gmail.com'), true);
});

test('pago pendiente se registra sin habilitar acceso', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'pending-1', event: 'PURCHASE_AWAITING_PAYMENT', status: 'WAITING_PAYMENT' }));
  assert.equal(system.transactions.get('HP0001').active, false);
  assert.equal(system.hasAccess('comprador@gmail.com'), false);
});

test('un estado pendiente posterior no quita una autorización ya aprobada', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'approved-before-pending', creationDate: 100 }));
  await system.send(payload({ id: 'pending-after-approved', event: 'PURCHASE_AWAITING_PAYMENT', status: 'WAITING_PAYMENT', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), true);
});

test('solicitud de reembolso no retira acceso antes del reembolso efectivo', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'approved-before-request', creationDate: 100 }));
  await system.send(payload({ id: 'refund-request', event: 'PURCHASE_REFUND_REQUESTED', status: 'APPROVED', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), true);
});

test('reembolso retira el derecho de esa transacción', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'approved-2', creationDate: 100 }));
  await system.send(payload({ id: 'refund-2', event: 'PURCHASE_REFUNDED', status: 'REFUNDED', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), false);
});

test('contracargo retira acceso inmediatamente', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'approved-3', creationDate: 100 }));
  await system.send(payload({ id: 'chargeback-3', event: 'PURCHASE_CHARGEBACK', status: 'CHARGEBACK', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), false);
});

test('evento duplicado es idempotente', async () => {
  const system = createMemorySystem();
  const first = await system.send(payload({ id: 'same-event' }));
  const second = await system.send(payload({ id: 'same-event' }));
  assert.equal((await first.json()).outcome, 'processed');
  assert.equal((await second.json()).outcome, 'duplicate');
  assert.equal(system.events.size, 1);
});

test('evento aprobado antiguo no reactiva una compra reembolsada', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'refund-new', event: 'PURCHASE_REFUNDED', status: 'REFUNDED', creationDate: 300 }));
  const old = await system.send(payload({ id: 'approved-old', creationDate: 100 }));
  assert.equal((await old.json()).outcome, 'out_of_order');
  assert.equal(system.transactions.get('HP0001').status, 'REFUNDED');
  assert.equal(system.hasAccess('comprador@gmail.com'), false);
});

test('una transacción terminal tampoco revive con una aprobación posterior inconsistente', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'refund-terminal', event: 'PURCHASE_REFUNDED', status: 'REFUNDED', creationDate: 300 }));
  const later = await system.send(payload({ id: 'approved-after-refund', creationDate: 400 }));
  assert.equal((await later.json()).outcome, 'out_of_order');
  assert.equal(system.transactions.get('HP0001').status, 'REFUNDED');
  assert.equal(system.hasAccess('comprador@gmail.com'), false);
});

test('dos compras del mismo correo conservan acceso si una sigue válida', async () => {
  const system = createMemorySystem();
  await system.send(payload({ id: 'purchase-a', transaction: 'HP-A', creationDate: 100 }));
  await system.send(payload({ id: 'purchase-b', transaction: 'HP-B', creationDate: 110 }));
  await system.send(payload({ id: 'refund-a', transaction: 'HP-A', event: 'PURCHASE_REFUNDED', status: 'REFUNDED', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), true);
});

test('acceso manual coexiste con una compra reembolsada', async () => {
  const system = createMemorySystem({ manual: { 'comprador@gmail.com': true } });
  await system.send(payload({ id: 'purchase-manual', creationDate: 100 }));
  await system.send(payload({ id: 'refund-manual', event: 'PURCHASE_REFUNDED', status: 'REFUNDED', creationDate: 200 }));
  assert.equal(system.hasAccess('comprador@gmail.com'), true);
});

test('rechaza Hottok incorrecto y no procesa otro producto', async () => {
  const system = createMemorySystem();
  const unauthorized = await system.send(payload({ id: 'bad-token' }), 'incorrecto');
  const otherProduct = await system.send(payload({ id: 'other-product', productId: 999 }));
  assert.equal(unauthorized.status, 401);
  assert.equal((await otherProduct.json()).outcome, 'ignored_product');
  assert.equal(system.transactions.size, 0);
});
