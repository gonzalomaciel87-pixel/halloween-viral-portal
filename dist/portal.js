const books = [
  { title: 'Halloween Viral', tag: 'Producto principal', count: '50 recetas saladas y una propuesta de fruta', icon: '🎃', cats: ['salado', 'chicos', 'rapido', 'venta'], glow: '#ff681f', file: 'recursos/halloween-viral.pdf' },
  { title: 'Dulces Macabros', tag: 'Bono 01', count: '25 postres de Halloween', icon: '🍰', cats: ['dulce', 'venta', 'chicos'], glow: '#c750d8', file: 'recursos/dulces-macabros.pdf' },
  { title: 'Fábrica de Golosinas Monstruosas', tag: 'Bono 02', count: '20 golosinas temáticas', icon: '🍬', cats: ['dulce', 'golosina', 'venta', 'chicos', 'rapido'], glow: '#b8ff4a', file: 'recursos/golosinas-monstruosas.pdf' },
  { title: 'El Horno Embrujado', tag: 'Bono 03', count: '20 recetas horneadas', icon: '🔥', cats: ['salado', 'dulce', 'horno', 'venta'], glow: '#f34d20', file: 'recursos/horno-embrujado.pdf' },
  { title: 'Pociones & Tragos Terroríficos', tag: 'Bono 04', count: '20 bebidas: 13 familiares y 7 para adultos', icon: '🧪', cats: ['bebida', 'chicos', 'venta'], glow: '#8f4dff', file: 'recursos/pociones-tragos.pdf' },
  { title: 'Halloween Rentable', tag: 'Bono 05 · Especial emprendedores', count: 'Guía práctica de costos, precios, packaging y ventas', icon: '💰', cats: ['venta'], glow: '#f5c66b', file: 'recursos/halloween-rentable.pdf', featured: true }
];

const grid = document.querySelector('#resources');
const reader = document.querySelector('#reader');
const availability = new Map();

async function detectResources() {
  await Promise.all(books.map(async (book) => {
    try {
      const response = await fetch(book.file, { method: 'HEAD', cache: 'no-store' });
      availability.set(book.file, response.ok && response.headers.get('content-type')?.includes('pdf'));
    } catch {
      availability.set(book.file, false);
    }
  }));
  render(document.querySelector('.filter.active')?.dataset.filter || 'all');
}

function openReader(book) {
  document.querySelector('#reader-title').textContent = book.title;
  document.querySelector('#reader-frame').src = book.file;
  reader.classList.add('open');
}

function render(filter = 'all') {
  grid.innerHTML = books
    .filter((book) => filter === 'all' || book.cats.includes(filter))
    .map((book) => {
      const ready = availability.get(book.file);
      const actions = ready
        ? `<button class="button button-primary read-book" data-book="${books.indexOf(book)}">Leer online</button><button class="button button-ghost download-disabled" type="button" disabled title="La descarga estará disponible próximamente">Descargar PDF</button>`
        : '<span class="button button-primary empty-link">Próximamente</span>';
      return `<article class="resource-card ${ready ? '' : 'coming'} ${book.featured ? 'featured-resource' : ''}"><div class="resource-cover" style="--glow:${book.glow}">${book.icon}</div><div class="resource-content"><span class="pill">${book.tag}</span><h2>${book.title}</h2><p>${book.count} · ${ready ? 'Disponible para leer dentro del portal.' : 'El PDF se habilitará cuando sea incorporado al portal.'}</p><div class="ebook-tags"><span>⏱ Tiempos detallados</span><span>★ Dificultad indicada</span>${book.cats.includes('venta') ? '<span>💰 Potencial para vender</span>' : ''}</div><div class="resource-actions">${actions}</div></div></article>`;
    })
    .join('');
  document.querySelectorAll('.read-book').forEach((button) => {
    button.addEventListener('click', () => openReader(books[Number(button.dataset.book)]));
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

render();
detectResources();
