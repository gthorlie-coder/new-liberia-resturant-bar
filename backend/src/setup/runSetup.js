const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function runMigration() {
  const sqlPath = path.join(__dirname, '../../migration_001.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  return 'Migration applied (or already up to date).';
}

const DEMO_ACCOUNTS = [
  { full_name: 'Gibrill Thorlie', phone: '231770000001', email: 'gthorlie@gmail.com', password: 'Admin@2026', role: 'admin' },
  { full_name: 'Demo Staff', phone: '231770000002', email: 'staff@newliberia.com', password: 'Staff@2026', role: 'staff' },
  { full_name: 'Demo Driver', phone: '231770000003', email: 'driver@newliberia.com', password: 'Driver@2026', role: 'driver' },
  { full_name: 'Demo Customer', phone: '231770000004', email: 'customer@newliberia.com', password: 'Customer@2026', role: 'customer' },
];

const CATEGORIES = [
  { name: 'Liberian Food', sort_order: 1 },
  { name: 'BBQ', sort_order: 2 },
  { name: 'Seafood', sort_order: 3 },
  { name: 'Drinks', sort_order: 4 },
];

const MENU_ITEMS = [
  { category: 'Liberian Food', name: 'Jollof Rice Special', description: 'Smoky party-style jollof with grilled chicken', price: 9.0 },
  { category: 'Liberian Food', name: 'Cassava Leaf & Rice', description: 'Pounded cassava leaf, smoked fish, palm oil', price: 8.5 },
  { category: 'BBQ', name: 'Suya Skewers (5pc)', description: 'Spiced grilled beef skewers', price: 6.0 },
  { category: 'Seafood', name: 'Banku & Tilapia', description: 'Grilled tilapia with banku and pepper sauce', price: 10.0 },
  { category: 'Drinks', name: 'Ginger Beer', description: 'House-made spiced ginger beer', price: 2.5, is_drink: true },
  { category: 'Drinks', name: 'Cold Club Beer', description: 'Ice cold Club beer', price: 3.0, is_drink: true },
];

const INVENTORY_ITEMS = [
  { name: 'Chicken (whole)', qty: 4, unit: 'birds', threshold: 6 },
  { name: 'Palm Oil (5L)', qty: 0, unit: 'jugs', threshold: 2 },
  { name: 'Rice (50kg bag)', qty: 12, unit: 'bags', threshold: 3 },
  { name: 'Club Beer (case)', qty: 8, unit: 'cases', threshold: 4 },
];

const PROMOTIONS = [
  { code: 'LAUNCH25', description: '25% off for first 3 months for frequent users', discount_percent: 25, min_orders_required: 3, days_valid: 90 },
];

async function runSeed() {
  const log = [];

  for (const acc of DEMO_ACCOUNTS) {
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [acc.phone]);
    if (existing.rows.length > 0) { log.push(`skip (exists): ${acc.role}`); continue; }
    const password_hash = await bcrypt.hash(acc.password, 10);
    await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [acc.full_name, acc.email, acc.phone, password_hash, acc.role]
    );
    log.push(`created account: ${acc.role} (${acc.phone} / ${acc.password})`);
  }

  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const existing = await pool.query('SELECT id FROM menu_categories WHERE name = $1', [cat.name]);
    if (existing.rows.length > 0) { categoryIds[cat.name] = existing.rows[0].id; continue; }
    const result = await pool.query(`INSERT INTO menu_categories (name, sort_order) VALUES ($1, $2) RETURNING id`, [cat.name, cat.sort_order]);
    categoryIds[cat.name] = result.rows[0].id;
    log.push(`created category: ${cat.name}`);
  }

  for (const item of MENU_ITEMS) {
    const existing = await pool.query('SELECT id FROM menu_items WHERE name = $1', [item.name]);
    if (existing.rows.length > 0) continue;
    await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, is_drink) VALUES ($1, $2, $3, $4, $5)`,
      [categoryIds[item.category] || null, item.name, item.description, item.price, !!item.is_drink]
    );
    log.push(`created menu item: ${item.name}`);
  }

  for (const inv of INVENTORY_ITEMS) {
    const existing = await pool.query('SELECT id FROM inventory_items WHERE name = $1', [inv.name]);
    if (existing.rows.length > 0) continue;
    await pool.query(`INSERT INTO inventory_items (name, qty, unit, threshold) VALUES ($1, $2, $3, $4)`, [inv.name, inv.qty, inv.unit, inv.threshold]);
    log.push(`created inventory item: ${inv.name}`);
  }

  for (const promo of PROMOTIONS) {
    const existing = await pool.query('SELECT id FROM promotions WHERE code = $1', [promo.code]);
    if (existing.rows.length > 0) continue;
    const endsAt = new Date(Date.now() + promo.days_valid * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO promotions (code, description, discount_percent, min_orders_required, ends_at) VALUES ($1, $2, $3, $4, $5)`,
      [promo.code, promo.description, promo.discount_percent, promo.min_orders_required, endsAt]
    );
    log.push(`created promotion: ${promo.code}`);
  }

  return log;
}

module.exports = { runMigration, runSeed };
