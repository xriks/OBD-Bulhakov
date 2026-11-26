const fs = require('fs');
const path = require('path');
const { httpErr } = require('../lib/http');
const DIR = path.join(__dirname, '..', '..', 'public', 'img', 'games');
function saveImage(id, data) {
  if (!data) return;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data);
  const buf = m && Buffer.from(m[1], 'base64');
  if (!buf || buf.length > 5 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) throw httpErr(400, 'Фото має бути у форматі JPG до 5 МБ', 'image');
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${id}.jpg`), buf);
}
module.exports = { saveImage };
