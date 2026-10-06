import { supabase, requireBuyer, getSignedBookUrl, downloadBook } from './supabase-client.js';

const books = [
  { title: 'Halloween Viral', tag: 'Producto principal', count: '50 recetas saladas y una propuesta de fruta', cover: 'assets/covers/halloween-viral.webp', cats: ['salado', 'chicos', 'rapido', 'venta'], glow: '#ff681f', file: 'halloween-viral.pdf' },
  { title: 'Dulces Macabros', tag: 'Bono 01', count: '25 postres de Halloween', cover: 'assets/covers/dulces-macabros.webp', cats: ['dulce', 'venta', 'chicos'], glow: '#c750d8', file: 'dulces-macabros.pdf' },
  { title: 'Fábrica de Golosinas Monstruosas', tag: 'Bono 02', count: '20 golosinas temáticas', cover: 'assets/covers/golosinas-monstruosas.webp', cats: ['dulce', 'golosina', 'venta', 'chicos', 'rapido'], glow: '#b8ff4a', file: 'golosinas-monstruosas.pdf' },
  { title: 'El Horno Embrujado', tag: 'Bono 03', count: '20 recetas horneadas', cover: 'assets/covers/horno-embrujado.webp', cats: ['salado', 'dulce', 'horno', 'venta'], glow: '#f34d20', file: 'horno-embrujado.pdf' },
  { title: 'Pociones & Tragos Terroríficos', tag: 'Bono 04', count: '20 bebidas: 13 familiares y 7 para adultos', cover: 'assets/covers/pociones-tragos.webp', cats: ['bebida', 'chicos', 'venta'], glow: '#8f4dff', file: 'pociones-tragos.pdf' },
  { title: 'Halloween Rentable', tag: 'Bono 05 · Especial emprendedores', count: 'Guía práctica de costos, precios, packaging y ventas', cover: 'assets/covers/halloween-rentable.webp', cats: ['venta'], glow: '#f5c66b', file: 'halloween-rentable.pdf', featured: true }
];

const grid = document.querySelector('#resources');
const reader = document.querySelector('#reader');
const availability = new Map();

async function detectResources() {
  await Promise.all(books.map(async (book) => {
    try { availability.set(book.file, await getSignedBookUrl(book.file)); }
    catch { availability.set(book.file, null); }
  }));
  render(document.querySelector('.filter.active')?.dataset.filter || 'all');
}

function openReader(book) {
  document.querySelector('#reader-title').textContent = book.title;
  document.querySelector('#reader-frame').src = availability.get(book.file);
  reader.classList.add('open');
}

function render(filter = 'all') {
  grid.innerHTML = books
    .filter((book) => filter === 'all' || book.cats.includes(filter))
    .map((book) => {
      const ready = Boolean(availability.get(book.file));
      const actions = ready
        ? `<button class="button button-primary read-book" data-book="${books.indexOf(book)}">Leer online</button><button class="button button-ghost download-book" data-book="${books.indexOf(book)}" type="button">Descargar PDF</button>`
        : '<span class="button button-primary empty-link">Próximamente</span>';
      return `<article class="resource-card ${ready ? '' : 'coming'} ${book.featured ? 'featured-resource' : ''}"><div class="resource-cover" style="--glow:${book.glow}"><img src="${book.cover}" alt="Portada de ${book.title}" loading="lazy"></div><div class="resource-content"><span class="pill">${book.tag}</span><h2>${book.title}</h2><p>${book.count} · ${ready ? 'Disponible para leer dentro del portal.' : 'El PDF se habilitará cuando sea incorporado al portal.'}</p><div class="ebook-tags"><span>⏱ Tiempos detallados</span><span>★ Dificultad indicada</span>${book.cats.includes('venta') ? '<span>💰 Potencial para vender</span>' : ''}</div><div class="resource-actions">${actions}</div></div></article>`;
    })
    .join('');
  document.querySelectorAll('.read-book').forEach((button) => {
    button.addEventListener('click', () => openReader(books[Number(button.dataset.book)]));
  });
  document.querySelectorAll('.download-book').forEach((button) => {
    button.addEventListener('click', async () => {
      const book = books[Number(button.dataset.book)];
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Preparando…';
      try { await downloadBook(book.file); }
      catch { window.alert('No se pudo descargar el PDF. Volvé a iniciar sesión e intentá nuevamente.'); }
      finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
}

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.filter.active')?.classList.remove('active');
  button.classList.add('active');
  render(button.dataset.filter);
}));

document.querySelectorAll('[data-filter-jump]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.filter.active')?.classList.remove('active');
  render(button.dataset.filterJump);
  document.querySelector('#biblioteca').scrollIntoView({ behavior: 'smooth' });
}));

document.querySelector('#reader-close')?.addEventListener('click', () => {
  reader.classList.remove('open');
  document.querySelector('#reader-frame').src = 'about:blank';
});

document.querySelector('#logout')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.replace('/login.html');
});

const buyer = await requireBuyer();
if (buyer) {
  render();
  detectResources();
}
