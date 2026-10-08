import { createHotmartHandler } from '../lib/hotmart-webhook.mjs';

const getEnv = (name: string) => Netlify.env.get(name) || '';

async function processEvent(event: any) {
  const url = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('server_not_configured');

  const response = await fetch(`${url}/rest/v1/rpc/process_hotmart_event`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      p_event_id: event.eventId,
      p_creation_date: event.creationDate,
      p_event_type: event.eventType,
      p_transaction: event.transaction,
      p_email: event.email,
      p_product_id: event.productId,
      p_product_ucode: event.productUcode || null,
      p_status: event.status,
      p_active: event.active
    })
  });
  if (!response.ok) throw new Error(`supabase_rpc_failed:${response.status}`);
  return response.json();
}

export default createHotmartHandler({ getEnv, processEvent });
