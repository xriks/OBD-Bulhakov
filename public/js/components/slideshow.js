import { esc } from '../core/ui.js';

let timer = null;
export function stopSlideshow() { clearInterval(timer); timer = null; }

export function mountSlideshow(box, games, onPick) {
  if (!box) return;
  if (!games.length) { box.remove(); return; }
  box.setAttribute('role', 'region');
  box.setAttribute('aria-roledescription', 'carousel');
  box.setAttribute('aria-label', 'Ігри з каталогу');
  const many = games.length > 1;
  box.innerHTML = games.map(g => `<a class="slide" href="#game-${g.game_id}" data-id="${g.game_id}" aria-label="${esc(g.title)}">
      <img src="img/games/${g.game_id}.jpg" alt="${esc(g.title)}" onerror="this.remove()"></a>`).join('')
    + `<div class="sinfo" aria-live="polite"><h3></h3><p></p></div>`
    + (many ? `<button class="snav prev" type="button" aria-label="Попередня гра"></button><button class="snav next" type="button" aria-label="Наступна гра"></button>
      <div class="dots">${games.map((g, i) => `<button type="button" data-i="${i}" aria-label="Гра ${i + 1}: ${esc(g.title)}"></button>`).join('')}</div>` : '');

  const slides = [...box.querySelectorAll('.slide')];
  const dots = [...box.querySelectorAll('.dots button')];
  const info = box.querySelector('.sinfo');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0, swiped = false;

  const show = i => {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('on', k === cur); s.tabIndex = k === cur ? 0 : -1; s.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); });
    dots.forEach((d, k) => d.classList.toggle('on', k === cur));
    info.querySelector('h3').textContent = games[cur].title; info.querySelector('p').textContent = games[cur].description || '';
  };
  const play = () => {
    stopSlideshow();
    if (many && !reduced) timer = setInterval(() => (box.isConnected ? show(cur + 1) : stopSlideshow()), 4500);
  };

  box.querySelector('.prev')?.addEventListener('click', () => { show(cur - 1); play(); });
  box.querySelector('.next')?.addEventListener('click', () => { show(cur + 1); play(); });
  dots.forEach(d => d.addEventListener('click', () => { show(+d.dataset.i); play(); }));
  slides.forEach(s => s.addEventListener('click', e => { e.preventDefault(); if (!swiped) onPick(+s.dataset.id); swiped = false; }));

  let x0 = null;
  box.addEventListener('pointerdown', e => { x0 = e.clientX; });
  box.addEventListener('pointerup', e => {
    if (x0 !== null && Math.abs(e.clientX - x0) > 40) { swiped = true; show(cur + (e.clientX < x0 ? 1 : -1)); play(); }
    x0 = null;
  });
  box.addEventListener('mouseenter', stopSlideshow);
  box.addEventListener('mouseleave', play);
  box.addEventListener('focusin', stopSlideshow);
  box.addEventListener('focusout', play);
  show(0); play();
}
