import { supabase, getBuyer } from './supabase-client.js';

const status = document.querySelector('#login-status');
const button = document.querySelector('#google-login');

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

await routeIfAuthorized();
