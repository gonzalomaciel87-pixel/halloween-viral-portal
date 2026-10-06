import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase todavía no está configurado.');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function getBuyer() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) return null;
  const { data, error } = await supabase.from('buyer_access').select('email, active, lifetime_access').eq('email', session.user.email.toLowerCase()).eq('active', true).maybeSingle();
  if (error) throw error;
  return data ? { user: session.user, access: data } : null;
}

export async function requireBuyer() {
  const buyer = await getBuyer();
  if (!buyer) {
    location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }
  return buyer;
}

export async function getSignedBookUrl(path) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadBook(path) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error) throw error;
  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = path;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
