import { api } from '../core/api.js';
import { esc, modal, money, safe, toast, today } from '../core/ui.js';
import { state } from '../core/state.js';

export function rentModal(g) {
  if (!state.me) { toast('Щоб забронювати гру, увійдіть в акаунт'); location.hash = '#/login'; return; }
  const m = modal(`<div class="mimg"><img src="img/games/${g.game_id}.jpg" alt="" onerror="this.remove()"></div><h3>Оренда: ${esc(g.title)}</h3>
    <div class="row">
      <div class="daterow"><label class="field">Дата початку<input id="r-from" type="date"></label><label class="field">Дата повернення<input id="r-to" type="date"></label></div>
      <p class="hint" id="r-days-hint"></p><div class="formerr" id="r-err" hidden></div>
      <div class="field">Додаткові послуги<div class="svcs">${state.lookups.services.map(s => `<label class="chk"><input type="checkbox" class="r-svc" value="${s.service_id}" data-cost="${s.cost}"><span>${esc(s.service_name)}</span><em>${money(s.cost)}</em></label>`).join('')}</div></div>
      <label class="field" id="r-addr-box" hidden>Вулиця та номер будинку (обов’язково)<input id="r-addr" maxlength="120" placeholder="вул. Хрещатик, 1, кв. 5"></label>
      <div class="total" id="r-total"></div></div>
    <div class="btns"><button class="btn ghost" data-close>Скасувати</button><button class="btn" id="r-ok">Підтвердити оренду</button></div>`);
  const $q = x => m.querySelector(x), iso = d => d.toISOString().slice(0, 10);
  const add = (v, n) => { const d = new Date(v + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const from = $q('#r-from'), to = $q('#r-to'), addr = $q('#r-addr');
  const isDelivery = () => [...m.querySelectorAll('.r-svc:checked')].some(c => /^Доставка/.test(c.nextElementSibling.textContent));
  const days = () => Math.round((new Date(to.value) - new Date(from.value)) / 864e5);
  from.min = today(); from.value = today(); to.value = add(today(), 3);
  const limits = () => { to.min = add(from.value, 1); to.max = add(from.value, 30); if (to.value < to.min || to.value > to.max) to.value = to.max; };
  limits();
  const calc = () => {
    limits();
    const d = days(), extra = [...m.querySelectorAll('.r-svc:checked')].reduce((s, c) => s + +c.dataset.cost, 0);
    $q('#r-days-hint').textContent = `Період оренди: ${d} ${d % 10 === 1 && d !== 11 ? 'доба' : d % 10 >= 2 && d % 10 <= 4 && (d < 12 || d > 14) ? 'доби' : 'діб'}`;
    $q('#r-addr-box').hidden = !isDelivery();
    $q('#r-total').textContent = `Разом: ${money(d * g.price_per_day + extra)}`;
  };
  m.addEventListener('input', calc); calc();
  const fail = (t, el) => { const e = $q('#r-err'); e.textContent = t; e.hidden = false; (el || e).focus?.(); };
  $q('#r-ok').onclick = safe(async () => {
    $q('#r-err').hidden = true;
    if (!from.value || !to.value || days() < 1 || days() > 30) return fail('Оберіть період від 1 до 30 діб', to);
    if (isDelivery() && addr.value.trim().length < 5) { addr.classList.add('bad'); return fail('Вкажіть вулицю та номер будинку для доставки', addr); }
    try {
      await api('/api/rent', { method: 'POST', body: { game_id: g.game_id, days: days(), start_date: from.value, address: addr.value, service_ids: [...m.querySelectorAll('.r-svc:checked')].map(c => +c.value) } });
    } catch (e) { return fail(e.message); }
    m.close(); toast('Гру заброньовано! Рахунок — у розділі «Мої оренди»'); location.hash = '#/my';
  });
}
