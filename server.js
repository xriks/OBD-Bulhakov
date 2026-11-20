// server.js — точка входу: Express, статика, підключення маршрутів
const express = require('express');
const path = require('path');
const { seed } = require('./src/db/seed');
const { attachUser } = require('./src/middleware/session');

seed();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachUser);

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/catalog'));
app.use(require('./src/routes/client'));
app.use(require('./src/routes/admin'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Не знайдено' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hooked працює: http://localhost:${PORT}`));
