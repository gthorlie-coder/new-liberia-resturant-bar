// One-time setup script: creates demo accounts (admin, staff, driver,
// customer) and a starter menu so the app has real data to order against
// the first time you connect it to this backend.
//
// Run this once after your database is created:
//   node seed.js
//
// Safe to run more than once — it skips anything that already exists.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');

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

async function seed() {
  console.log('Seeding demo accounts...');
  for (const acc of DEMO_ACCOUNTS) {
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [acc.phone]);
    if (existing.rows.length > 0) {
      console.log(`  skip (exists): ${acc.role} — ${acc.phone}`);
      continue;
    }
    const password_hash = await bcrypt.hash(acc.password, 10);
    await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [acc.full_name, acc.email, acc.phone, password_hash, acc.role]
    );
    console.log(`  created: ${acc.role} — phone ${acc.phone} / password ${acc.password}`);
  }

  console.log('Seeding categories...');
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const existing = await pool.query('SELECT id FROM menu_categories WHERE name = $1', [cat.name]);
    if (existing.rows.length > 0) {
      categoryIds[cat.name] = existing.rows[0].id;
      console.log(`  skip (exists): ${cat.name}`);
      continue;
    }
    const result = await pool.query(
      `INSERT INTO menu_categories (name, sort_order) VALUES ($1, $2) RETURNING id`,
      [cat.name, cat.sort_order]
    );
    categoryIds[cat.name] = result.rows[0].id;
    console.log(`  created: ${cat.name}`);
  }

  console.log('Seeding menu items...');
  for (const item of MENU_ITEMS) {
    const existing = await pool.query('SELECT id FROM menu_items WHERE name = $1', [item.name]);
    if (existing.rows.length > 0) {
      console.log(`  skip (exists): ${item.name}`);
      continue;
    }
    await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, is_drink) VALUES ($1, $2, $3, $4, $5)`,
      [categoryIds[item.category] || null, item.name, item.description, item.price, !!item.is_drink]
    );
    console.log(`  created: ${item.name} — $${item.price}`);
  }

  console.log('Seeding inventory...');
  for (const inv of INVENTORY_ITEMS) {
    const existing = await pool.query('SELECT id FROM inventory_items WHERE name = $1', [inv.name]);
    if (existing.rows.length > 0) {
      console.log(`  skip (exists): ${inv.name}`);
      continue;
    }
    await pool.query(
      `INSERT INTO inventory_items (name, qty, unit, threshold) VALUES ($1, $2, $3, $4)`,
      [inv.name, inv.qty, inv.unit, inv.threshold]
    );
    console.log(`  created: ${inv.name} (${inv.qty} ${inv.unit})`);
  }

  console.log('Seeding promotions...');
  for (const promo of PROMOTIONS) {
    const existing = await pool.query('SELECT id FROM promotions WHERE code = $1', [promo.code]);
    if (existing.rows.length > 0) {
      console.log(`  skip (exists): ${promo.code}`);
      continue;
    }
    const endsAt = new Date(Date.now() + promo.days_valid * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO promotions (code, description, discount_percent, min_orders_required, ends_at) VALUES ($1, $2, $3, $4, $5)`,
      [promo.code, promo.description, promo.discount_percent, promo.min_orders_required, endsAt]
    );
    console.log(`  created: ${promo.code}`);
  }

  console.log('\nDone. Demo login credentials (use the PHONE number to log in):');
  DEMO_ACCOUNTS.forEach((a) => console.log(`  ${a.role}: ${a.phone} / ${a.password}`));

  await pool.end();
}
seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
