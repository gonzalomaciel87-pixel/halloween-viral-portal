import { sendMetaPurchase } from '../lib/meta-capi.mjs';

const getEnv = (name: string) => Netlify.env.get(name) || '';

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 404 });
  if (!getEnv('META_TEST_EVENT_CODE')) return new Response(null, { status: 404 });

  const result = await sendMetaPurchase({
    eventType: 'PURCHASE_APPROVED',
    status: 'APPROVED',
    creationDate: Date.now(),
    approvedDate: Date.now(),
    transaction: 'CAPI_TEST_20261015',
    productId: 8676601,
    productName: 'Halloween Viral',
    value: 33637,
    currency: 'COP',
    sck: '',
    buyer: {
      email: 'meta-capi-test@example.invalid',
      firstName: 'Meta',
      lastName: 'Test',
      countryIso: 'CO'
    }
  }, { getEnv });

  return Response.json({ ok: result.ok, eventsReceived: result.eventsReceived || 0, testMode: result.testMode === true }, {
    status: result.ok ? 200 : 502,
    headers: { 'cache-control': 'no-store' }
  });
};
