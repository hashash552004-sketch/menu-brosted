const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
//  1. Database setup (SQLite local / PostgreSQL Render)
// ------------------------------------------------------------
const IS_SQLITE = !process.env.DATABASE_URL;
let db, seedDb;

if (IS_SQLITE) {
  const Database = require('better-sqlite3');
  db = new Database(path.join(__dirname, 'menu.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  seedDb = () => {};
} else {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  db = pool;
  seedDb = async () => {
    const client = await pool.connect();
    try {
      await client.query('CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL)');
      await client.query('CREATE TABLE IF NOT EXISTS dishes (id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL, description TEXT, description_ar TEXT, price REAL NOT NULL, cooking_time INTEGER, image TEXT, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT NOW())');
      await client.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    } finally {
      client.release();
    }
  };
}

// ------------------------------------------------------------
//  Unified async query helpers
// ------------------------------------------------------------
function pgSql(sql, params) {
  let idx = 0;
  const pg = sql.replace(/\?/g, () => `$${++idx}`);
  return { text: pg, params: params || [] };
}

function q(sql, params) {
  if (IS_SQLITE) {
    const stmt = db.prepare(sql);
    if (/^SELECT/i.test(sql.trim())) return Promise.resolve(stmt.all(...(params || [])));
    return Promise.resolve(stmt.run(...(params || [])));
  }
  return db.query(pgSql(sql, params)).then(r => r.rows);
}

function qRow(sql, params) {
  if (IS_SQLITE) return Promise.resolve(db.prepare(sql).get(...(params || [])));
  return db.query(pgSql(sql, params)).then(r => r.rows[0] || null);
}

function qExec(sql) {
  if (IS_SQLITE) { db.exec(sql); return Promise.resolve(); }
  return db.query(sql);
}

async function qInsert(sql, params) {
  if (IS_SQLITE) {
    const r = db.prepare(sql).run(...(params || []));
    return r.lastInsertRowid;
  }
  const pg = pgSql(sql + ' RETURNING id', params);
  const r = await db.query(pg);
  return r.rows[0].id;
}

// ------------------------------------------------------------
//  2. Init tables + seed
// ------------------------------------------------------------
async function initDB() {
  if (IS_SQLITE) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        description TEXT,
        description_ar TEXT,
        price REAL NOT NULL,
        cooking_time INTEGER,
        image TEXT,
        category_id INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // seed password
    const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();
    if (!row) db.prepare("INSERT INTO settings (key, value) VALUES ('admin_password', 'hashash')").run();
    // seed data
    const cnt = db.prepare('SELECT COUNT(*) as c FROM categories').get();
    if (cnt.c === 0) await seedData();
  } else {
    await seedDb();
    const row = await qRow("SELECT value FROM settings WHERE key = 'admin_password'");
    if (!row) await q("INSERT INTO settings (key, value) VALUES ('admin_password', 'hashash')");
    const cnt = await qRow('SELECT COUNT(*) as c FROM categories');
    if (parseInt(cnt.c) === 0) await seedData();
  }
}

async function seedData() {
  const cats = [
    ['grill', 'شواء'], ['appetizer', 'مقبلات'], ['main_course', 'أطباق رئيسية'],
    ['drink', 'مشروبات'], ['dessert', 'حلويات'],
  ];
  const catIds = [];
  for (const [en, ar] of cats) {
    const id = await qInsert('INSERT INTO categories (name, name_ar) VALUES (?, ?)', [en, ar]);
    catIds.push(id);
  }
  const dishes = [
    ['kebab', 'كباب', 'Grilled skewers of seasoned meat', 'لحم مفروم متبل على أسياخ مشوية', 35000, 20, catIds[0]],
    ['tikka', 'تكة', 'Marinated chicken pieces grilled to perfection', 'قطع دجاج متبلة مشوية', 40000, 25, catIds[0]],
    ['hummus', 'حمص', 'Creamy chickpea dip with tahini', 'غموس حمص ناعم مع طحينة', 15000, 10, catIds[1]],
    ['fattoush', 'فتوش', 'Fresh vegetable salad with crispy bread', 'سلطة خضار طازجة مع خبز مقرمش', 12000, 10, catIds[1]],
    ['mansaf', 'منسف', 'Lamb cooked in fermented dried yogurt served with rice', 'لحم ضأن بجميد الكرك مع رز', 55000, 60, catIds[2]],
    ['maqluba', 'مقلوبة', 'Upside-down rice pot with meat and vegetables', 'رز مقلوب مع لحم وخضار', 45000, 50, catIds[2]],
    ['ayran', 'عيران', 'Cold yogurt drink', 'مشروب لبن بارد', 8000, 2, catIds[3]],
    ['tamarind', 'تمر هندي', 'Sweet and tangy tamarind juice', 'عصير تمر هندي منعش', 10000, 5, catIds[3]],
    ['kunafa', 'كنافة', 'Crispy pastry with cheese soaked in syrup', 'عجينة كنافة ناعمة مع جبن وقطر', 25000, 20, catIds[4]],
    ['baklava', 'بقلاوة', 'Layered filo pastry with nuts and syrup', 'رقائق عجينة مع مكسرات وقطر', 30000, 25, catIds[4]],
  ];
  for (const d of dishes) {
    await q('INSERT INTO dishes (name, name_ar, description, description_ar, price, cooking_time, category_id) VALUES (?,?,?,?,?,?,?)', [d[0], d[1], d[2], d[3], d[4], d[5], d[6]]);
  }
}

// ------------------------------------------------------------
//  3. Sessions (in-memory)
// ------------------------------------------------------------
const sessions = new Set();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ------------------------------------------------------------
//  4. Image handling
// ------------------------------------------------------------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function fileToBase64(filepath) {
  const data = fs.readFileSync(filepath);
  const ext = path.extname(filepath).slice(1);
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
  return `data:${mime};base64,${data.toString('base64')}`;
}

// ------------------------------------------------------------
//  5. Middleware
// ------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ------------------------------------------------------------
//  6. Auth routes
// ------------------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const row = await qRow("SELECT value FROM settings WHERE key = 'admin_password'");
  const correct = row ? row.value : 'hashash';
  if (password === correct) {
    const token = generateToken();
    sessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'كلمة السر خطأ' });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.put('/api/admin/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const row = await qRow("SELECT value FROM settings WHERE key = 'admin_password'");
  const correct = row ? row.value : 'hashash';
  if (current_password !== correct) return res.status(403).json({ error: 'كلمة السر الحالية خطأ' });
  if (!new_password || new_password.length < 4) return res.status(400).json({ error: 'كلمة السر الجديدة يجب أن تكون 4 محارف على الأقل' });
  await q("UPDATE settings SET value = ? WHERE key = 'admin_password'", [new_password]);
  const currentToken = req.headers.authorization;
  for (const t of sessions) { if (t !== currentToken) sessions.delete(t); }
  res.json({ ok: true, message: 'تم تغيير كلمة السر بنجاح' });
});

// ------------------------------------------------------------
//  7. Public API – categories & dishes
// ------------------------------------------------------------
app.get('/api/categories', async (req, res) => {
  const cats = await q('SELECT * FROM categories');
  res.json(cats);
});

app.get('/api/dishes', async (req, res) => {
  const { category_id, search } = req.query;
  const params = [];
  const where = [];
  let sql;
  if (IS_SQLITE) {
    sql = `SELECT d.*, c.name_ar as category_name_ar FROM dishes d JOIN categories c ON c.id = d.category_id`;
  } else {
    sql = `SELECT d.*, c.name_ar as category_name_ar FROM dishes d JOIN categories c ON c.id = d.category_id`;
  }
  if (category_id) { where.push('d.category_id = ?'); params.push(Number(category_id)); }
  if (search) { where.push("(d.name_ar LIKE ? OR d.description_ar LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY d.id';
  const dishes = await q(sql, params);
  res.json(dishes);
});

app.get('/api/dishes/:id', async (req, res) => {
  const dish = await qRow(
    `SELECT d.*, c.name_ar as category_name_ar FROM dishes d JOIN categories c ON c.id = d.category_id WHERE d.id = ?`,
    [req.params.id]
  );
  if (!dish) return res.status(404).json({ error: 'غير موجود' });
  res.json(dish);
});

// ------------------------------------------------------------
//  8. Admin CRUD – dishes
// ------------------------------------------------------------
app.post('/api/admin/dishes', requireAuth, upload.single('image'), async (req, res) => {
  const { name, name_ar, description, description_ar, price, cooking_time, category_id } = req.body;
  let image = '';
  if (req.file) {
    if (IS_SQLITE) {
      image = '/uploads/' + req.file.filename;
    } else {
      image = fileToBase64(req.file.path);
      fs.unlinkSync(req.file.path);
    }
  }
  const id = await qInsert(
    'INSERT INTO dishes (name, name_ar, description, description_ar, price, cooking_time, image, category_id) VALUES (?,?,?,?,?,?,?,?)',
    [name, name_ar, description, description_ar, Number(price), Number(cooking_time), image, Number(category_id)]
  );
  res.json({ id: Number(id) });
});

app.put('/api/admin/dishes/:id', requireAuth, upload.single('image'), async (req, res) => {
  const { name, name_ar, description, description_ar, price, cooking_time, category_id } = req.body;
  const fields = ['name = ?', 'name_ar = ?', 'description = ?', 'description_ar = ?', 'price = ?', 'cooking_time = ?', 'category_id = ?'];
  const params = [name, name_ar, description, description_ar, Number(price), Number(cooking_time), Number(category_id)];

  if (req.file) {
    if (IS_SQLITE) {
      fields.push('image = ?');
      params.push('/uploads/' + req.file.filename);
      const old = await qRow('SELECT image FROM dishes WHERE id = ?', [req.params.id]);
      if (old && old.image && old.image.startsWith('/uploads/')) {
        const p = path.join(__dirname, 'public', old.image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } else {
      fields.push('image = ?');
      params.push(fileToBase64(req.file.path));
      fs.unlinkSync(req.file.path);
    }
  }

  params.push(req.params.id);
  await q(`UPDATE dishes SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

app.delete('/api/admin/dishes/:id', requireAuth, async (req, res) => {
  if (IS_SQLITE) {
    const old = await qRow('SELECT image FROM dishes WHERE id = ?', [req.params.id]);
    if (old && old.image && old.image.startsWith('/uploads/')) {
      const p = path.join(__dirname, 'public', old.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  await q('DELETE FROM dishes WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ------------------------------------------------------------
//  9. Admin CRUD – categories
// ------------------------------------------------------------
app.post('/api/admin/categories', requireAuth, async (req, res) => {
  const { name, name_ar } = req.body;
  const id = await qInsert('INSERT INTO categories (name, name_ar) VALUES (?, ?)', [name, name_ar]);
  res.json({ id: Number(id) });
});

app.delete('/api/admin/categories/:id', requireAuth, async (req, res) => {
  await q('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ------------------------------------------------------------
//  10. QR code
// ------------------------------------------------------------
app.get('/api/qrcode', async (req, res) => {
  const url = req.query.url || `${req.protocol}://${req.get('host')}`;
  try {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, width: 400, color: { dark: '#1a1a2e', light: '#ffffff' } });
    res.type('image/svg+xml').send(svg);
  } catch {
    res.status(500).json({ error: 'خطأ في توليد QR code' });
  }
});

// ------------------------------------------------------------
//  11. Start
// ------------------------------------------------------------
async function start() {
  await initDB();
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`المحلي: http://localhost:${PORT}`);
    if (ip) console.log(`الشبكة: http://${ip}:${PORT}`);
    if (process.env.DATABASE_URL) console.log('قاعدة البيانات: PostgreSQL (Render)');
    else console.log('قاعدة البيانات: SQLite (محلي)');
  });
}

function getLocalIP() {
  try {
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch {}
  return null;
}

start().catch(err => {
  console.error('ERROR STARTING SERVER:');
  console.error(err.message || err);
  console.error(err.stack || '');
  process.exit(1);
});
