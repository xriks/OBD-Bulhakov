import { api } from '../core/api.js';
import { modal } from '../core/ui.js';
import { state } from '../core/state.js';

const SESSION_KEY = 'hooked_welcome';
let open = false;

function needed() {
  if (state.me) return state.me.onboarded === 0;
  try { return !sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}

export function maybeShowWelcome() {
  if (open || !needed()) return;
  open = true;
  const user = state.me;
  const m = modal(`<h3>Як взяти гру?</h3>
    <div class="steps">
      <div>Обирай гру в каталозі та тисни «Забронювати»</div>
      <div>Вкажи кількість діб і додаткові послуги</div>
      <div>Грай та повертай — адміністратор прийме гру</div>
      <div>Оплати рахунок у розділі «Мої оренди»</div>
    </div>
    <div class="btns">${user ? '' : '<a class="btn ghost" href="#/login" data-close>Увійти</a>'}<button class="btn" data-close>Зрозуміло</button></div>`);
  m.onclose = () => {
    open = false;
    if (user) { user.onboarded = 1; api('/api/onboarded', { method: 'POST' }).catch(() => { }); }
    else { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ігноруємо */ } }
  };
}
