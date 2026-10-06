import { isAdminEmail, isValidBuyerEmail, normalizeBuyerEmail } from '../lib/buyer-admin.mjs';

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function authenticateAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = Netlify.env.get('SUPABASE_URL');
  const anonKey = Netlify.env.get('SUPABASE_ANON_KEY');
  const adminEmail = Netlify.env.get('ADMIN_EMAIL');
  if (!token || !url || !anonKey || !adminEmail) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return isAdminEmail(user.email, adminEmail) ? user : null;
}

export default async (request: Request) => {
  const admin = await authenticateAdmin(request);
  if (!admin) return json({ error: 'not_authorized' }, 403);
  const url = Netlify.env.get('SUPABASE_URL');
  const serviceKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'server_not_configured' }, 503);
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };

  if (request.method === 'GET') {
    const response = await fetch(`${url}/rest/v1/buyer_access?select=email,active,lifetime_access,created_at,notes&order=created_at.desc`, { headers });
    return json(response.ok ? await response.json() : { error: 'list_failed' }, response.status);
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: { email?: string; active?: boolean; notes?: string };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!isValidBuyerEmail(body.email)) return json({ error: 'invalid_email' }, 400);
  const email = normalizeBuyerEmail(body.email);
  const active = body.active !== false;
  const notes = String(body.notes || 'Pago por transferencia').trim().slice(0, 500);
  const response = await fetch(`${url}/rest/v1/buyer_access?on_conflict=email`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ email, active, lifetime_access: true, notes })
  });
  if (!response.ok) return json({ error: 'save_failed' }, response.status);
  return json({ ok: true, buyer: (await response.json())[0] });
};
