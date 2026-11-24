const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', '..', 'chapter_one.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Check if initial tables exist
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get().count;
  if (tableCount === 0) {
    seedInitialData();
  }
}

function generateSecureToken() {
  return crypto.randomBytes(16).toString('hex'); // 32 hex chars
}

function seedInitialData() {
  console.log('[DB] Seeding Chapter One Cafe initial tables, menu and settings...');
  const now = new Date().toISOString();

  // 1. Initial Tables
  const defaultTables = [
    'Table 01',
    'Table 02',
    'Table 03',
    'Table 04',
    'Table 05',
    'Table 06',
    'Basement',
    'Takeaway'
  ];

  const insertTable = db.prepare(`
    INSERT INTO tables (id, table_number, qr_token, status, is_revoked, token_created_at, created_at, updated_at)
    VALUES (?, ?, ?, 'AVAILABLE', 0, ?, ?, ?)
  `);

  const insertSession = db.prepare(`
    INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
    VALUES (?, ?, ?, 'ACTIVE', 0, ?)
  `);

  defaultTables.forEach((tName, idx) => {
    const tableId = crypto.randomUUID();
    const token = generateSecureToken();
    insertTable.run(tableId, tName, token, now, now, now);

    // Initial active session for each table
    const sessionId = crypto.randomUUID();
    const sessionCode = `SESS-${1000 + idx + 1}`;
    insertSession.run(sessionId, tableId, sessionCode, now);
  });

  // 2. Default Settings
  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `);

  insertSetting.run('cafe_name', 'Chapter One Cafe');
  insertSetting.run('cafe_tagline', 'Stories over Coffee & Bites');
  insertSetting.run('whatsapp_number', '919876543210');
  insertSetting.run('currency_symbol', '₹');
  insertSetting.run('admin_pin', '1234');
  insertSetting.run('notification_sound', 'chime_bell');
  insertSetting.run('sound_volume', '0.9');
  insertSetting.run('auto_print', 'false');

  // 3. Menu Categories
  const categories = [
    { name: 'Burgers', slug: 'burgers', sort_order: 1 },
    { name: 'Pizza', slug: 'pizza', sort_order: 2 },
    { name: 'Sandwiches', slug: 'sandwiches', sort_order: 3 },
    { name: 'Pasta', slug: 'pasta', sort_order: 4 },
    { name: 'Snacks', slug: 'snacks', sort_order: 5 },
    { name: 'Beverages', slug: 'beverages', sort_order: 6 },
    { name: 'Desserts', slug: 'desserts', sort_order: 7 },
    { name: 'Combos', slug: 'combos', sort_order: 8 },
    { name: 'Special Offers', slug: 'special-offers', sort_order: 9 }
  ];

  const insertCategory = db.prepare(`
    INSERT INTO menu_categories (id, name, slug, sort_order, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const catMap = {};
  categories.forEach(cat => {
    const id = crypto.randomUUID();
    insertCategory.run(id, cat.name, cat.slug, cat.sort_order);
    catMap[cat.slug] = id;
  });

  // 4. Menu Items with authentic prices, descriptions, customizations
  const items = [
    // Burgers
    {
      category: 'burgers',
      name: 'Special Burger',
      desc: 'Double crispy patty, aged cheddar, caramelized onions, house truffle mayo in a brioche bun.',
      price: 149,
      offer_price: 139,
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: [
        {
          name: 'Cheese Level',
          options: [
            { name: 'Standard Cheddar', price: 0 },
            { name: 'Extra Melted Cheese', price: 30 },
            { name: 'Double Smoked Mozzarella', price: 50 }
          ]
        },
        {
          name: 'Spice Level',
          options: [
            { name: 'Mild', price: 0 },
            { name: 'Medium Spice', price: 0 },
            { name: 'Peri-Peri Spicy', price: 15 }
          ]
        }
      ]
    },
    {
      category: 'burgers',
      name: 'Crispy Paneer Supreme Burger',
      desc: 'Spiced cottage cheese block crusted in golden flakes, layered with jalapeños and herb garlic sauce.',
      price: 169,
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: [
        {
          name: 'Add-ons',
          options: [
            { name: 'Grilled Mushrooms', price: 35 },
            { name: 'Extra Dip', price: 25 }
          ]
        }
      ]
    },
    {
      category: 'burgers',
      name: 'Smoked Chicken & Bacon Burger',
      desc: 'Juicy chargrilled chicken breast, crispy chicken bacon strips, BBQ glaze, and crunchy slaw.',
      price: 199,
      image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
      is_veg: 0,
      is_popular: 1,
      customizations: [
        {
          name: 'Patty Style',
          options: [
            { name: 'Grilled Herb', price: 0 },
            { name: 'Southern Fried Crispy', price: 20 }
          ]
        }
      ]
    },

    // Pizza
    {
      category: 'pizza',
      name: 'Classic Margherita Woodfired',
      desc: 'San Marzano tomato sauce, fresh buffalo mozzarella, virgin olive oil, and sweet garden basil.',
      price: 299,
      offer_price: 279,
      image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: [
        {
          name: 'Crust Type',
          options: [
            { name: 'Hand-Tossed Thin Crust', price: 0 },
            { name: 'Cheese Burst Crust', price: 60 }
          ]
        }
      ]
    },
    {
      category: 'pizza',
      name: 'Farmhouse Rustic Pizza',
      desc: 'Loaded with bell peppers, sweet corn, black olives, red onions, mushrooms, and mozzarella.',
      price: 349,
      image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: [
        {
          name: 'Extra Topping',
          options: [
            { name: 'Jalapeños', price: 25 },
            { name: 'Sun-dried Tomatoes', price: 35 }
          ]
        }
      ]
    },
    {
      category: 'pizza',
      name: 'BBQ Chicken Feast Pizza',
      desc: 'Smoked pulled chicken, smoky barbecue drizzle, red paprika, and stretchy gouda-mozzarella blend.',
      price: 389,
      image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
      is_veg: 0,
      is_popular: 1,
      customizations: []
    },

    // Sandwiches
    {
      category: 'sandwiches',
      name: 'Gourmet Club Sandwich',
      desc: 'Triple-decker toasted sourdough stuffed with roasted veggies, cheese slices, and pesto spread.',
      price: 180,
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: [
        {
          name: 'Bread Choice',
          options: [
            { name: 'Multigrain Sourdough', price: 0 },
            { name: 'White Brioche', price: 0 }
          ]
        }
      ]
    },
    {
      category: 'sandwiches',
      name: 'Grilled Chicken & Cheese Melt',
      desc: 'Pan-seared seasoned chicken tossed with dijonnaise and molten mozzarella on golden grilled bread.',
      price: 210,
      image_url: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80',
      is_veg: 0,
      is_popular: 1,
      customizations: []
    },

    // Pasta
    {
      category: 'pasta',
      name: 'Creamy Alfredo Penne',
      desc: 'Velvety parmesan and cream emulsion, garlic butter, fresh parsley, and toasted garlic baguette.',
      price: 260,
      image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: [
        {
          name: 'Protein Add-on',
          options: [
            { name: 'Sautéed Mushrooms & Corn', price: 40 },
            { name: 'Grilled Herb Chicken', price: 70 }
          ]
        }
      ]
    },
    {
      category: 'pasta',
      name: 'Spicy Arbiatta Fusilli',
      desc: 'Fiery slow-cooked tomato arrabbiata sauce with crushed red chilies, garlic, and fresh basil leaves.',
      price: 240,
      image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281729?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: []
    },

    // Snacks
    {
      category: 'snacks',
      name: 'French Fries',
      desc: 'Classic golden shoestring potatoes tossed with sea salt. Served with Chapter One signature dip.',
      price: 99,
      image_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: [
        {
          name: 'Seasoning Style',
          options: [
            { name: 'Classic Salted', price: 0 },
            { name: 'Peri-Peri Dust', price: 20 },
            { name: 'Cheesy Jalapeño Loaded', price: 40 }
          ]
        }
      ]
    },
    {
      category: 'snacks',
      name: 'Crispy Onion Rings',
      desc: 'Thick cut sweet onion rings in seasoned beer batter, fried until crunchy golden perfection.',
      price: 120,
      image_url: 'https://images.unsplash.com/photo-1639024471287-032f66455642?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: []
    },
    {
      category: 'snacks',
      name: 'Spicy Buffalo Wings (6 pcs)',
      desc: 'Crispy fried chicken wings smothered in fiery house cayenne glaze with ranch dip.',
      price: 220,
      image_url: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80',
      is_veg: 0,
      is_popular: 1,
      customizations: []
    },

    // Beverages
    {
      category: 'beverages',
      name: 'Cold Coffee',
      desc: 'Rich espresso blend chilled with whole milk, vanilla cream, and a dusting of cocoa.',
      price: 120,
      image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: [
        {
          name: 'Sweetness',
          options: [
            { name: 'Standard Sweet', price: 0 },
            { name: 'Less Sweet', price: 0 },
            { name: 'Sugar-Free', price: 0 }
          ]
        },
        {
          name: 'Milk Choice',
          options: [
            { name: 'Whole Dairy Milk', price: 0 },
            { name: 'Oat Milk (+₹30)', price: 30 },
            { name: 'Almond Milk (+₹35)', price: 35 }
          ]
        },
        {
          name: 'Ice Cream Scoop',
          options: [
            { name: 'Vanilla Ice Cream Scoop', price: 40 }
          ]
        }
      ]
    },
    {
      category: 'beverages',
      name: 'Iced Caramel Macchiato',
      desc: 'Steamed milk stained with dark roast espresso shots and finished with sweet buttery caramel drizzle.',
      price: 150,
      image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    },
    {
      category: 'beverages',
      name: 'Mint Mojito Sparkling Cooler',
      desc: 'Crushed garden spearmint, muddled Persian limes, raw cane sugar syrup, and fizzy soda.',
      price: 130,
      image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 0,
      customizations: []
    },

    // Desserts
    {
      category: 'desserts',
      name: 'Belgian Chocolate Waffle',
      desc: 'Freshly baked golden waffle smothered in warm Belgian dark chocolate ganache and vanilla gelato.',
      price: 180,
      image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    },
    {
      category: 'desserts',
      name: 'Warm Sizzling Brownie with Ice Cream',
      desc: 'Fudgy walnut brownie served on a cast-iron skillet with a scoop of vanilla ice cream and hot fudge.',
      price: 160,
      image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    },

    // Combos
    {
      category: 'combos',
      name: 'Cafe Solitude Combo',
      desc: '1 Special Burger + 1 French Fries + 1 Chilled Cold Coffee. The signature solo chapter.',
      price: 320,
      offer_price: 299,
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    },
    {
      category: 'combos',
      name: 'Chapter Duo Feast',
      desc: '1 Classic Margherita Pizza + 1 French Fries + 2 Cold Coffees. Perfect for two.',
      price: 549,
      offer_price: 499,
      image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    },

    // Special Offers
    {
      category: 'special-offers',
      name: 'Happy Hours: 2 Cold Coffees @ ₹199',
      desc: 'Double your brew! Two signature chilled cold coffees at a special Chapter One delight price.',
      price: 240,
      offer_price: 199,
      image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
      is_veg: 1,
      is_popular: 1,
      customizations: []
    }
  ];

  const insertItem = db.prepare(`
    INSERT INTO menu_items (
      id, category_id, name, description, price, offer_price, image_url,
      is_veg, is_available, is_popular, customizations, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach((item, idx) => {
    const id = crypto.randomUUID();
    const catId = catMap[item.category];
    insertItem.run(
      id,
      catId,
      item.name,
      item.desc,
      item.price,
      item.offer_price || null,
      item.image_url,
      item.is_veg,
      1,
      item.is_popular,
      JSON.stringify(item.customizations || []),
      idx + 1,
      now,
      now
    );
  });

  console.log('[DB] Seeding completed successfully.');
}

module.exports = {
  db,
  initDb,
  generateSecureToken
};
