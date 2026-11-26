const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

module.exports = { today, addDays, diffDays };
