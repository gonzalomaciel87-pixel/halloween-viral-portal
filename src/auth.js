import { supabase, getBuyer } from './supabase-client.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const status = document.querySelector('#login-status');
const button = document.querySelector('#google-login');
const codeForm = document.querySelector('#code-form');

// Ingreso con código (para correos que no son Gmail): el código lo envía el vendedor por WhatsApp.
codeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#access-email').value.trim().toLowerCase();
  const code = document.querySelector('#access-code').value.replace(/\D/g, '');
  const submit = document.querySelector('#code-login');
  if (!email.includes('@') || code.length !== 6) {
    status.textContent = 'Escribí el correo de tu compra y el código de 6 números.';
    return;
  }
  submit.disabled = true;
  status.textContent = 'Verificando tu código…';
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/code-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email, code })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.token_hash) {
      status.textContent = res.status === 403
        ? 'Ese correo todavía no tiene el acceso habilitado. Escribinos por WhatsApp.'
        : 'El correo o el código no coinciden. Revisalos o pedinos uno nuevo por WhatsApp.';
      submit.disabled = false;
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'magiclink' });
    if (error) throw error;
    await routeIfAuthorized();
  } catch (error) {
    console.error('Code login error', error);
    status.textContent = 'No pudimos completar el ingreso. Intentá nuevamente.';
    submit.disabled = false;
  }
});

async function restoreOAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    if (location.hash) history.replaceState({}, document.title, `${location.pathname}${location.search}`);
    return;
  }
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) throw error;
  history.replaceState({}, document.title, `${location.pathname}${location.search}`);
}

async function routeIfAuthorized() {
  try {
    const buyer = await getBuyer();
    if (buyer) {
      location.replace(new URLSearchParams(location.search).get('next') || '/portal');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session && status) status.textContent = 'Tu cuenta todavía no está habilitada. Escribinos por WhatsApp después de realizar la transferencia.';
  } catch {
    if (status) status.textContent = 'No pudimos verificar tu acceso. Intentá nuevamente.';
  }
}

button?.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Abriendo Google…';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/login.html${location.search}` }
  });
  if (error) {
    status.textContent = 'No pudimos iniciar el acceso con Google.';
    button.disabled = false;
  }
});

try { await restoreOAuthSession(); }
catch (error) {
  console.error('OAuth session error', error);
  if (status) status.textContent = 'No pudimos completar el acceso con Google. Intentá nuevamente.';
}
await routeIfAuthorized();
