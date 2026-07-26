require("dotenv").config();
const pool = require("../config/db");

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const branch = await client.query(
      `INSERT INTO branches (name, address, city, phone)
       VALUES ('New Liberia Restaurant & Bar - Sinkor', 'Tubman Boulevard', 'Monrovia', '+231770000000')
       RETURNING id`
    );
    const branchId = branch.rows[0].id;

    const foodCat = await client.query(
      `INSERT INTO categories (branch_id, name, type, sort_order) VALUES ($1, 'Main Dishes', 'food', 1) RETURNING id`,
      [branchId]
    );
    const drinkCat = await client.query(
      `INSERT INTO categories (branch_id, name, type, sort_order) VALUES ($1, 'Cocktails', 'drink', 2) RETURNING id`,
      [branchId]
    );

    await client.query(
      `INSERT INTO menu_items (branch_id, category_id, name, description, price, is_alcoholic, prep_time_minutes)
       VALUES
        ($1, $2, 'Jollof Rice with Grilled Chicken', 'Smoky Liberian jollof rice with a grilled chicken quarter', 12.00, false, 20),
        ($1, $2, 'Fufu and Pepper Soup', 'Traditional fufu served with spicy goat pepper soup', 10.50, false, 25),
        ($1, $3, 'Monrovia Sunset', 'House rum cocktail with passionfruit and ginger', 8.00, true, 5)
       RETURNING id`,
      [branchId, foodCat.rows[0].id, drinkCat.rows[0].id]
    );

    await client.query(
      `INSERT INTO tables (branch_id, label, capacity) VALUES ($1, 'T1', 4), ($1, 'T2', 2), ($1, 'T3', 6)`,
      [branchId]
    );

    await client.query("COMMIT");
    console.log(`Seeded demo branch: ${branchId}`);
    console.log("Use this branch id in the Flutter app's MenuScreen(branchId: ...)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
