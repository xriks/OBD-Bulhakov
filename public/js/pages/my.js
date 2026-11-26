import { api } from '../core/api.js';
import { $, badge, esc, money, overdue, safe, toast } from '../core/ui.js';

export async function pageMy() {
  const rows = await api('/api/my/rentals');
  $('#view').innerHTML = `<h2 class="sec">Мої оренди</h2>` + (rows.length ? `<div class="tablewrap"><table><thead><tr>
    <th>№</th><th>Гра</th><th>Видано</th><th>Повернути до</th><th>Повернено</th><th>Статус</th><th>Сума</th><th>Оплата</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r.rental_id}</td><td><b>${esc(r.game_title)}</b><br><small>${esc(r.inventory_number)}</small>${r.delivery_address ? `<br><small>Доставка: ${esc(r.delivery_address)}</small>` : ''}</td><td>${r.rental_date}</td>
      <td>${r.due_date}${overdue(r) ? ' <span class="badge bad">прострочено</span>' : ''}</td><td>${r.return_date || '—'}</td><td>${badge('rental', r.status)}</td>
      <td>${money(r.total_amount)}${r.penalty_amount ? `<br><small>з них штраф ${money(r.penalty_amount)}</small>` : ''}</td><td>${badge('pay', r.payment_status)}</td>
      <td class="act">${r.payment_status === 'Pending' ? `<button class="btn sm" data-pay="${r.invoice_id}">Оплатити</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="panel empty">Ви ще не орендували ігор. <a href="#/">Перейти до каталогу</a></div>');
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = safe(async () => { await api(`/api/invoices/${b.dataset.pay}/pay`, { method: 'POST' }); toast('Оплату прийнято'); pageMy(); }));
}
