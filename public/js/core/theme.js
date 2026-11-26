const KEY = 'hooked_theme';
const SVG = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  light: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  dark: SVG('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
};

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function paint(btn) {
  const t = current();
  const label = t === 'dark' ? 'Темна тема. Увімкнути світлу' : 'Світла тема. Увімкнути темну';
  btn.innerHTML = ICONS[t];
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

export function initTheme() {
  const btn = document.getElementById('theme');
  if (!btn) return;
  paint(btn);
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* сховище недоступне — тема діє до закриття сторінки */ }
    paint(btn);
  });
}
