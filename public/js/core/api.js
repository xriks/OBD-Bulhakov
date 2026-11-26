export async function api(url, o = {}) {
  const r = await fetch(url, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Помилка запиту'), { field: d.field, locked: d.locked, status: r.status });
  return d;
}
