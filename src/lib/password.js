const crypto = require('crypto');

const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
const verify = (pw, h) => { const [s, k] = (h || '').split(':'); return !!k && crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, s, 32)); };

module.exports = { hash, verify };
