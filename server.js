const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
const uploadDir = path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'dh.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  avatar_url TEXT
);
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('game','numbers')),
  number_count INTEGER DEFAULT 50,
  owner_id INTEGER NOT NULL,
  status TEXT DEFAULT 'open',
  winner_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  number INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(draw_id,user_id),
  UNIQUE(draw_id,number),
  FOREIGN KEY(draw_id) REFERENCES draws(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS ip_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(draw_id,ip_hash),
  FOREIGN KEY(draw_id) REFERENCES draws(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sender TEXT NOT NULL DEFAULT 'DH SORTEIOS',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'system',
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_user_created ON inbox_messages(user_id, created_at DESC);
`);
try { db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT'); } catch (_) {}

const secret = process.env.JWT_SECRET || 'troque-esta-chave-antes-de-publicar-' + crypto.randomBytes(24).toString('hex');
const safeUser = u => ({ id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url || null });
const tokenFor = u => jwt.sign({ id: u.id }, secret, { expiresIn: '7d' });

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (!token) throw new Error('missing');
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Faça login para continuar.' });
  }
}
function hashIp(ip) {
  return crypto.createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex');
}
function adminKeyOk(req) {
  const key = String(req.headers['x-admin-key'] || '');
  const expected = String(process.env.ADMIN_KEY || '');
  return !!expected && key.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}

const BLOCKED_TEXT_MESSAGE = 'SOU CARENTE ME DESCULPA DH SORTEIO E 00 O MELHOR 💙👑';
function normalizeForModeration(value) {
  return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0]/g, 'o').replace(/[@]/g, 'a').replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e').replace(/[4]/g, 'a').replace(/[5$]/g, 's')
    .replace(/[7]/g, 't').replace(/[8]/g, 'b').replace(/[6]/g, 'g')
    .replace(/(.)\1{2,}/g, '$1$1').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Base PT-BR ampliada a partir de listas públicas de moderação. Não existe catálogo
// capaz de cobrir todos os palavrões, gírias, erros e códigos inventados pelos usuários.
// Termos de identidade (ex.: gay, lésbica) não são bloqueados por si só.
const blockedTerms = [
  'arrombado','arrombada','arrombados','arrombadas','babaca','babacas','baba ovo','babaovo',
  'bosta','bostao','bostinha','bostinha','buceta','bucetao','bucetinha','boceta','bocetao',
  'cagada','cagado','cagao','cagar','cagando','caganeira','caralho','carai','caraio','crlh','krl',
  'cacete','kct','corno','corna','cornudo','cornuda','cuzao','cuzona','cuzinho','cuzuda','cuzudo','cu',
  'desgraca','desgracado','desgracada','fdp','filho da puta','filha da puta','filhodaputa','filhadaputa',
  'foda','fodas','fodase','foda se','foder','fodendo','fudido','fudida','fudeu','fudendo','fude',
  'vai se foder','vai se fude','vaisefoder','vai tomar no cu','vaitomarnocu','vai tomar no',
  'inferno','merda','merdao','merdinha','m3rda','otario','otaria','pau no cu','paunocu','pica','picao',
  'pinto','porra','putaria','puta','puto','putinha','putinha','putaquepariu','puta que pariu',
  'puta que te pariu','rabao','rola','roludo','retardado','retardada','vadia','vagabundo','vagabunda',
  'imbecil','escroto','escrota','estupido','estupida','idiota','lazarento','lazarenta','desgraça',
  'bixa','bichona','baitola','boiola','viado','viadinho','safado','safada','piranha','quenga',
  'vtnc','vtmnc','vsf','tnc','tmnc','pqp','pqp','vsfd','vai a merda','vai pra merda','vai tomar banho',
  'bronha','punheta','punheteiro','punheteira','siririca','boquete','broxa','broxado','broxada',
  'piroca','piroco','xota','xoxota','xereca','xana','xavasca','xibiu','grelo','grelinho','rola',
  'tesao','tesuda','tesudo','gozar','gozada','gozado','gozando','esporra','esporrado','esporrada',
  'enrabado','enrabada','rabuda','rabudo','rabo','dar o rabo','dar o cu','pau','pica','pika',
  'cuzinho','cuzão','cuzona','brioco','fiofo','olho do cu','olhodocu','miolo de cu','miolodecu',
  'capiroto','filho de uma puta','filha de uma puta','filhoduma puta','fidumaegua',
  'merda nenhuma','bosta nenhuma','vai pra puta que pariu','vai se lascar','se foder',
  'fuck','fucking','shit','bullshit','bitch','asshole','bastard','motherfucker','dickhead','cunt','whore','slut',
  'son of a bitch','go fuck yourself','fuck you','damn','piss off',
  'mierda','puta madre','joder','cabron','cabrona','coño','gilipollas'
];
const normalizedBlockedTerms = [...new Set(blockedTerms.map(normalizeForModeration).filter(Boolean))];
function containsBlockedLanguage(value) {
  const normalized = normalizeForModeration(value);
  if (!normalized) return false;
  const padded = ' ' + normalized + ' ';
  const compact = normalized.replace(/ /g, '');
  return normalizedBlockedTerms.some(term => {
    if (padded.includes(' ' + term + ' ')) return true;
    // Detect common joined forms for phrases/long words, but avoid substring
    // matching tiny tokens such as "cu" inside harmless words like "curso".
    const joined = term.replace(/ /g, '');
    return joined.length >= 5 && compact.includes(joined);
  });
}
function rejectProfanity(res) { return res.status(422).json({ error: BLOCKED_TEXT_MESSAGE, blocked: true }); }
function moderationConfigOk() { return !!(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET); }
async function moderateProfileImage(buffer, mimetype) {
  if (!moderationConfigOk()) throw new Error('A moderação de imagens ainda não foi configurada pelo administrador.');
  const form = new FormData();
  form.append('media', new Blob([buffer], { type: mimetype }), 'avatar');
  form.append('models', 'nudity-2.1,weapon,gore-2.0,violence');
  form.append('api_user', process.env.SIGHTENGINE_API_USER);
  form.append('api_secret', process.env.SIGHTENGINE_API_SECRET);
  const response = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form });
  if (!response.ok) throw new Error('Não foi possível verificar a imagem agora. Tente novamente.');
  const result = await response.json();
  if (result.status !== 'success') throw new Error('A verificação da imagem falhou. Tente outra foto.');
  const flaggedKeys = ['sexual_activity','sexual_display','erotica','very_suggestive','weapon','firearm','gun','pistol','rifle','shotgun','knife','blade','sword','gore','violence'];
  let flagged = false;
  const walk = (o) => {
    if (!o || typeof o !== 'object' || flagged) return;
    for (const [key, val] of Object.entries(o)) {
      const k = key.toLowerCase();
      if (flaggedKeys.some(term => k === term || k.includes(term)) &&
          ((typeof val === 'number' && val >= 0.5) || val === true)) { flagged = true; return; }
      if (val && typeof val === 'object') walk(val);
    }
  };
  walk(result);
  if (flagged) throw new Error('POR FAVOR RESPEITO EM PRIMEIRO LUGAR DH AGRADECE SUA COMPREENSÃO 💙');
  return true;
}

app.post('/api/auth/register', (req, res) => {
  let { name, email, password } = req.body || {};
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (containsBlockedLanguage(name)) return rejectProfanity(res);
  if (name.length < 2 || name.length > 50 || !email.includes('@') || password.length < 6)
    return res.status(400).json({ error: 'Confira nome, e-mail e senha (mínimo 6 caracteres).' });
  try {
    const info = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')
      .run(name, email, bcrypt.hashSync(password, 10));
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    db.prepare("INSERT INTO inbox_messages(user_id,title,body,kind) VALUES(?,?,?,'system')")
      .run(u.id, 'Bem-vindo ao DH SORTEIOS!', 'Sua conta foi criada. Quando você ganhar um sorteio, enviaremos as instruções e os dados do prêmio para esta caixa de entrada privada.');
    res.json({ token: tokenFor(u), user: safeUser(u) });
  } catch {
    res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password))
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  res.json({ token: tokenFor(u), user: safeUser(u) });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!u) return res.status(401).json({ error: 'Conta não encontrada.' });
  res.json({ user: safeUser(u) });
});

app.post('/api/profile/avatar', auth, (req, res) => {
  avatarUpload.single('avatar')(req, res, async err => {
    if (err || !req.file) return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WEBP de até 4 MB.' });
    try {
      await moderateProfileImage(req.file.buffer, req.file.mimetype);
      const ext = req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';
      const filename = `avatar-${req.user.id}-${crypto.randomBytes(8).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
      const avatarUrl = `/uploads/${filename}`;
      db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run(avatarUrl, req.user.id);
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
      res.json({ user: safeUser(u), avatar_url: avatarUrl });
    } catch (e) {
      const msg = e.message || 'Não foi possível verificar essa imagem.';
      const blocked = msg.includes('POR FAVOR RESPEITO');
      res.status(blocked ? 422 : 503).json({ error: blocked ? 'POR FAVOR RESPEITO EM PRIMEIRO LUGAR DH AGRADECE SUA COMPREENSÃO 💙' : msg, blocked });
    }
  });
});

// Private support conversation: a member can write only to DH staff, never to another member.
app.post('/api/inbox/send', auth, (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (body.length < 2 || body.length > 1500) return res.status(400).json({ error: 'Escreva uma mensagem de 2 a 1.500 caracteres.' });
  if (containsBlockedLanguage(body)) return rejectProfanity(res);
  const recent = db.prepare("SELECT COUNT(*) n FROM inbox_messages WHERE user_id=? AND kind='user_message' AND created_at >= datetime('now','-10 minutes')").get(req.user.id).n;
  if (recent >= 5) return res.status(429).json({ error: 'Você enviou várias mensagens. Aguarde alguns minutos para enviar outra.' });
  const u = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id);
  const info = db.prepare("INSERT INTO inbox_messages(user_id,sender,title,body,kind,read_at) VALUES(?,?,?,?, 'user_message', CURRENT_TIMESTAMP)")
    .run(req.user.id, u?.name || 'Membro DH', 'Mensagem enviada para DH SORTEIOS', body);
  res.json({ ok: true, id: info.lastInsertRowid, message: 'Mensagem enviada somente para a equipe DH.' });
});

// Admin-only support inbox. ADMIN_KEY is never sent to regular members or stored in the frontend.
app.get('/api/admin/inbox', (req, res) => {
  if (!adminKeyOk(req)) return res.status(403).json({ error: 'Acesso administrativo negado.' });
  const messages = db.prepare(`
    SELECT m.id,m.user_id,m.title,m.body,m.created_at,u.name,u.email
    FROM inbox_messages m JOIN users u ON u.id=m.user_id
    WHERE m.kind='user_message' ORDER BY m.id DESC LIMIT 200
  `).all();
  res.json({ messages });
});
app.post('/api/admin/inbox/:id/reply', (req, res) => {
  if (!adminKeyOk(req)) return res.status(403).json({ error: 'Acesso administrativo negado.' });
  const original = db.prepare("SELECT * FROM inbox_messages WHERE id=? AND kind='user_message'").get(Number(req.params.id));
  if (!original) return res.status(404).json({ error: 'Mensagem não encontrada.' });
  const body = String(req.body?.body || '').trim();
  if (body.length < 2 || body.length > 1500) return res.status(400).json({ error: 'A resposta deve ter de 2 a 1.500 caracteres.' });
  if (containsBlockedLanguage(body)) return rejectProfanity(res);
  db.prepare("INSERT INTO inbox_messages(user_id,sender,title,body,kind) VALUES(?, 'DH SORTEIOS', 'Resposta da equipe DH', ?, 'admin_reply')")
    .run(original.user_id, body);
  res.json({ ok: true, message: 'Resposta enviada para a caixa privada do membro.' });
});

// Private inbox: every query is scoped to the authenticated account.
app.get('/api/inbox', auth, (req, res) => {
  const messages = db.prepare(`
    SELECT id, sender, title, body, kind, read_at, created_at
    FROM inbox_messages WHERE user_id=? ORDER BY id DESC LIMIT 100
  `).all(req.user.id);
  const unread = messages.filter(m => !m.read_at).length;
  res.json({ messages, unread });
});

app.post('/api/inbox/:id/read', auth, (req, res) => {
  const result = db.prepare(`
    UPDATE inbox_messages SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?
  `).run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Mensagem não encontrada.' });
  res.json({ ok: true });
});

app.delete('/api/inbox/:id', auth, (req, res) => {
  const result = db.prepare('DELETE FROM inbox_messages WHERE id=? AND user_id=?')
    .run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Mensagem não encontrada.' });
  res.json({ ok: true });
});

app.get('/api/draws', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*,u.name owner_name,
      (SELECT COUNT(*) FROM entries e WHERE e.draw_id=d.id) entries
    FROM draws d JOIN users u ON u.id=d.owner_id ORDER BY d.id DESC
  `).all();
  const win = db.prepare(`
    SELECT u.name winner_name,d.title draw_title
    FROM draws d JOIN users u ON u.id=d.winner_id
    WHERE d.status='finished' ORDER BY d.id DESC LIMIT 10
  `).all();
  res.json({
    draws: rows, winners: win,
    stats: {
      draws: rows.length,
      users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
      winners: win.length
    }
  });
});

app.post('/api/draws', auth, (req, res) => {
  const pin = String(req.headers['x-admin-pin'] || '');
  const expected = String(process.env.ADMIN_PIN || '');
  if (!expected || pin.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(expected)))
    return res.status(403).json({ error: 'PIN administrativo incorreto. Somente o dono pode publicar sorteios.' });

  let { title, description, type, number_count } = req.body || {};
  title = String(title || '').trim();
  if (containsBlockedLanguage(title) || containsBlockedLanguage(description)) return rejectProfanity(res);
  if (title.length < 3 || title.length > 80 || !['game', 'numbers'].includes(type))
    return res.status(400).json({ error: 'Preencha o título e escolha um tipo válido.' });
  number_count = Math.max(2, Math.min(500, Number(number_count) || 50));
  const info = db.prepare(`
    INSERT INTO draws(title,description,type,number_count,owner_id) VALUES(?,?,?,?,?)
  `).run(title, String(description || '').slice(0, 300), type, number_count, req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/draws/:id/enter', auth, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM draws WHERE id=?').get(id);
  if (!d || d.status !== 'open')
    return res.status(404).json({ error: 'Sorteio não encontrado ou encerrado.' });

  const ipHash = hashIp(req.ip);
  if (db.prepare('SELECT 1 FROM ip_entries WHERE draw_id=? AND ip_hash=?').get(id, ipHash))
    return res.status(409).json({ error: 'Este IP já participou deste sorteio. É permitida uma participação por IP.' });

  let number = null;
  if (d.type === 'numbers') {
    number = Number(req.body?.number);
    if (!Number.isInteger(number) || number < 1 || number > d.number_count)
      return res.status(400).json({ error: 'Escolha um número válido.' });
    if (db.prepare('SELECT 1 FROM entries WHERE draw_id=? AND number=?').get(id, number))
      return res.status(409).json({ error: 'Esse número já foi escolhido.' });
  }

  try {
    const add = db.transaction(() => {
      db.prepare('INSERT INTO entries(draw_id,user_id,number) VALUES(?,?,?)').run(id, req.user.id, number);
      db.prepare('INSERT INTO ip_entries(draw_id,ip_hash,user_id) VALUES(?,?,?)').run(id, ipHash, req.user.id);
    });
    add();
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE'))
      return res.status(409).json({ error: 'Esta conta ou este IP já participou deste sorteio.' });
    res.status(500).json({ error: 'Não foi possível registrar a participação.' });
  }
});

// Owner-only draw action: selects a winner and privately delivers the prize message.
app.post('/api/admin/draws/:id/draw', (req, res) => {
  if (!adminKeyOk(req)) return res.status(403).json({ error: 'Acesso administrativo negado.' });
  const id = Number(req.params.id);
  const d = db.prepare("SELECT * FROM draws WHERE id=? AND status='open'").get(id);
  if (!d) return res.status(404).json({ error: 'Sorteio aberto não encontrado.' });
  const entries = db.prepare('SELECT user_id FROM entries WHERE draw_id=?').all(id);
  if (!entries.length) return res.status(400).json({ error: 'Ainda não há participantes.' });

  const winnerId = entries[crypto.randomInt(entries.length)].user_id;
  const prizeMessage = String(req.body?.prize_message || '').trim().slice(0, 5000);
  const prizeTitle = String(req.body?.prize_title || '').trim().slice(0, 100) || `Você ganhou: ${d.title}`;
  if (containsBlockedLanguage(prizeTitle) || containsBlockedLanguage(prizeMessage)) return rejectProfanity(res);
  const messageBody = prizeMessage ||
    `Parabéns! Você foi o ganhador de "${d.title}". Entre em contato com a equipe DH para receber as instruções do seu prêmio.`;

  const finish = db.transaction(() => {
    db.prepare("UPDATE draws SET status='finished',winner_id=? WHERE id=?").run(winnerId, id);
    db.prepare(`
      INSERT INTO inbox_messages(user_id,sender,title,body,kind)
      VALUES(?, 'DH SORTEIOS', ?, ?, 'prize')
    `).run(winnerId, prizeTitle, messageBody);
  });
  finish();

  const winner = db.prepare('SELECT id,name FROM users WHERE id=?').get(winnerId);
  res.json({ winner: winner.name, message_sent: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log('DH Sorteios rodando na porta ' + port));
