import { supabase } from './supabase-client.js';

const form = document.querySelector('#buyer-form');
const status = document.querySelector('#admin-status');
const list = document.querySelector('#buyer-list');

async function sessionToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace('/login.html?next=%2Fadmin.html');
    throw new Error('no_session');
  }
  return session.access_token;
}

async function api(options = {}) {
  const token = await sessionToken();
  const response = await fetch('/.netlify/functions/manage-buyers', {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  if (response.status === 403) throw new Error('not_authorized');
  if (!response.ok) throw new Error('request_failed');
  return response.json();
}

function renderBuyers(buyers) {
  list.replaceChildren();
  if (!buyers.length) {
    const row = list.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = 'Todavía no hay compradores.';
    return;
  }
  buyers.forEach((buyer) => {
    const row = list.insertRow();
    row.insertCell().textContent = buyer.email;
    const stateCell = row.insertCell();
    const badge = document.createElement('span');
    badge.className = `admin-state ${buyer.active ? 'active' : ''}`;
    badge.textContent = buyer.active ? 'Activo' : 'Inactivo';
    stateCell.appendChild(badge);
    row.insertCell().textContent = new Date(buyer.created_at).toLocaleDateString('es-AR');
  });
}

async function loadBuyers() {
  try { renderBuyers(await api()); }
  catch (error) {
    if (error.message === 'not_authorized') document.querySelector('.admin-shell').innerHTML = '<section class="admin-intro"><p class="eyebrow">Acceso restringido</p><h1>Esta cuenta no administra el portal.</h1><p>Ingresá con el correo administrador de Halloween Viral.</p></section>';
    else list.innerHTML = '<tr><td colspan="3">No pudimos cargar la lista.</td></tr>';
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const email = form.email.value.trim().toLowerCase();
  button.disabled = true;
  status.textContent = 'Habilitando acceso…';
  try {
    await api({ method: 'POST', body: JSON.stringify({ email, notes: form.notes.value }) });
    form.email.value = '';
    status.textContent = `Acceso habilitado para ${email}.`;
    await loadBuyers();
  } catch { status.textContent = 'No se pudo habilitar el correo. Revisá los datos e intentá nuevamente.'; }
  finally { button.disabled = false; }
});

document.querySelector('#refresh')?.addEventListener('click', loadBuyers);
document.querySelector('#logout')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.replace('/login.html?next=%2Fadmin.html'); });
loadBuyers();
