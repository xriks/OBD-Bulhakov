import { badge, esc, money } from '../core/ui.js';
import { state } from '../core/state.js';

export const sel = (src, v, t) => () => state.lookups[src].map(x => [x[v], x[t]]);
export const CONDS = [['добра', 'Добра'], ['задовільна', 'Задовільна'], ['пошкоджена', 'Пошкоджена']];
export const ADMIN = {
  games: { pk: 'game_id', title: 'Ігри', name: r => r.title, cols: [['title', 'Назва'], ['genre_name', 'Жанр'], ['level_name', 'Складність', r => r.level_name ? esc(r.level_name) : '<span class="badge bad">не вказано</span>'], ['min_players', 'Мін.'], ['max_players', 'Макс.'],
    ['price_per_day', 'Ціна за добу', r => money(r.price_per_day)], ['available_copies', 'Вільно'], ['completeness_note', 'Комплектність']],
    fields: [{ k: 'title', l: 'Назва', req: 1 }, { k: 'genre_id', l: 'Жанр', t: 'select', o: sel('genres', 'genre_id', 'genre_name') }, { k: 'difficulty_id', l: 'Складність', t: 'select', o: sel('difficulty_levels', 'difficulty_id', 'level_name') },
      { k: 'min_players', l: 'Мін. гравців (1–12)', t: 'number', min: 1, max: 12 }, { k: 'max_players', l: 'Макс. гравців (1–12)', t: 'number', min: 1, max: 12 }, { k: 'price_per_day', l: 'Ціна за добу, грн', t: 'number', min: 1, step: '0.01' }, { k: 'completeness_note', l: 'Комплектність' }, { k: 'description', l: 'Короткий опис', t: 'textarea' }, { k: 'image', l: 'Фото (JPG)', t: 'file' }] },
  game_copies: { pk: 'copy_id', title: 'Копії ігор', name: r => r.inventory_number, cols: [['inventory_number', 'Інв. номер'], ['title', 'Гра'], ['status', 'Статус', r => badge('copy', r.status)]],
    fields: [{ k: 'game_id', l: 'Гра', t: 'select', o: sel('games', 'game_id', 'title') }, { k: 'inventory_number', l: 'Інвентарний номер', req: 1 }, { k: 'status', l: 'Статус', t: 'select', o: () => [['available', 'Вільна'], ['rented', 'Видана'], ['repair', 'Ремонт']] }] },
  customers: { pk: 'customer_id', title: 'Клієнти', name: r => `${r.first_name} ${r.last_name}`, cols: [['customer_id', 'ID'], ['full_name', 'Користувач'], ['email', 'E-mail'], ['phone', 'Телефон'], ['role', 'Роль', r => badge('role', r.role)]],
    fields: [{ k: 'first_name', l: 'Ім’я', req: 1 }, { k: 'last_name', l: 'Прізвище', req: 1 }, { k: 'email', l: 'E-mail', t: 'email', req: 1 }, { k: 'phone', l: 'Телефон (+380XXXXXXXXX)', t: 'tel' },
      { k: 'role', l: 'Роль', t: 'select', o: () => [['client', 'Клієнт'], ['admin', 'Адміністратор']] }, { k: 'password', l: 'Пароль (необов’язково)', t: 'password', createOnly: 1 }] },
  invoices: { pk: 'invoice_id', title: 'Рахунки', ro: 1, noDel: 1, cols: [['invoice_id', '№'], ['customer_name', 'Клієнт'], ['total_amount', 'Сума', r => money(r.total_amount)], ['issue_date', 'Дата'], ['payment_status', 'Оплата', r => badge('pay', r.payment_status)]],
    fields: [{ k: 'payment_status', l: 'Статус оплати', t: 'select', o: () => [['Pending', 'Очікує оплати'], ['Paid', 'Сплачено'], ['Cancelled', 'Скасовано']] }] },
  services: { pk: 'service_id', title: 'Послуги', name: r => r.service_name, cols: [['service_name', 'Послуга'], ['cost', 'Вартість', r => money(r.cost)]],
    fields: [{ k: 'service_name', l: 'Назва послуги', req: 1 }, { k: 'cost', l: 'Вартість, грн', t: 'number', min: 0, step: '0.01' }] },
  genres: { pk: 'genre_id', title: 'Жанри', name: r => r.genre_name, cols: [['genre_id', 'ID'], ['genre_name', 'Жанр']], fields: [{ k: 'genre_name', l: 'Назва жанру', req: 1 }] },
  difficulty_levels: { pk: 'difficulty_id', title: 'Рівні складності', name: r => r.level_name, cols: [['difficulty_id', 'ID'], ['level_name', 'Рівень'], ['description', 'Опис']], fields: [{ k: 'level_name', l: 'Назва рівня' }, { k: 'description', l: 'Для кого підходить', t: 'textarea' }] },
  damage_reports: { pk: 'damage_id', title: 'Пошкодження', ro: 1, name: r => `${r.game_title}: ${r.description}`, cols: [['game_title', 'Гра'], ['description', 'Опис'], ['report_date', 'Дата'], ['damage_level', 'Рівень']],
    fields: [{ k: 'description', l: 'Опис', req: 1 }, { k: 'damage_level', l: 'Рівень', t: 'select', o: () => [['Незначне', 'Незначне'], ['Середнє', 'Середнє'], ['Критичне', 'Критичне']] }, { k: 'report_date', l: 'Дата', t: 'date' }] },
};
export const MENU = [['overview', 'Огляд'], ['rentals', 'Оренди та повернення'], ['_Каталог'], ['games', 'Ігри'], ['game_copies', 'Копії'], ['genres', 'Жанри'], ['difficulty_levels', 'Складність'], ['services', 'Послуги'],
  ['_Люди та гроші'], ['customers', 'Клієнти'], ['invoices', 'Рахунки'], ['damage_reports', 'Пошкодження'], ['_Система'], ['changes', 'Історія змін']];
