const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', '..', 'chapter_one.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // temporarily disable FK for clean batch deletion

console.log('[Clean] Wiping all demo orders, requests, test customers, and test tables...');

// 1. Delete all order data
db.prepare('DELETE FROM order_items').run();
db.prepare('DELETE FROM orders').run();
console.log('✓ Cleared all orders and order items');

// 2. Delete all customer assistance requests
db.prepare('DELETE FROM customer_requests').run();
console.log('✓ Cleared all customer assistance requests');

// 3. Delete all demo customers & device tokens
db.prepare('DELETE FROM customer_devices').run();
db.prepare('DELETE FROM customers').run();
console.log('✓ Cleared all demo customer profiles and device tokens');

// 4. Delete all audit logs
db.prepare('DELETE FROM audit_logs').run();
console.log('✓ Cleared all audit logs');

// 5. Delete all old table sessions
db.prepare('DELETE FROM table_sessions').run();
console.log('✓ Cleared all previous table sessions');

// 6. Delete test tables
db.prepare("DELETE FROM tables WHERE id LIKE 'test-%' OR table_number LIKE 'Test%'").run();

// 7. Reset standard cafe tables: Table 01 - Table 06, Basement, Takeaway
const standardTables = [
  'Table 01',
  'Table 02',
  'Table 03',
  'Table 04',
  'Table 05',
  'Table 06',
  'Basement',
  'Takeaway'
];

// Ensure all standard tables exist, are AVAILABLE, not revoked, and have fresh tokens
const existingTables = db.prepare('SELECT * FROM tables').all();
const existingMap = new Map(existingTables.map(t => [t.table_number, t]));

const updateTable = db.prepare(`
  UPDATE tables 
  SET status = 'AVAILABLE', is_revoked = 0, qr_token = ?, token_created_at = ?, updated_at = ?
  WHERE id = ?
`);

const insertTable = db.prepare(`
  INSERT INTO tables (id, table_number, qr_token, status, is_revoked, token_created_at, created_at, updated_at)
  VALUES (?, ?, ?, 'AVAILABLE', 0, ?, ?, ?)
`);

const insertSession = db.prepare(`
  INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
  VALUES (?, ?, ?, 'ACTIVE', 0, ?)
`);

const now = new Date().toISOString();

standardTables.forEach((tName, idx) => {
  const token = crypto.randomBytes(16).toString('hex');
  let tableId;

  if (existingMap.has(tName)) {
    tableId = existingMap.get(tName).id;
    updateTable.run(token, now, now, tableId);
  } else {
    tableId = crypto.randomUUID();
    insertTable.run(tableId, tName, token, now, now, now);
  }

  // Create clean active session
  const sessionId = crypto.randomUUID();
  const sessionCode = `SESS-${1000 + idx + 1}`;
  insertSession.run(sessionId, tableId, sessionCode, now);
});

// 8. Reset all menu items to AVAILABLE
db.prepare('UPDATE menu_items SET is_available = 1').run();
console.log('✓ All menu items set to available');

db.pragma('foreign_keys = ON');

// 9. Verify clean counts
const counts = {
  orders: db.prepare('SELECT COUNT(*) as count FROM orders').get().count,
  order_items: db.prepare('SELECT COUNT(*) as count FROM order_items').get().count,
  customers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
  customer_requests: db.prepare('SELECT COUNT(*) as count FROM customer_requests').get().count,
  table_sessions: db.prepare('SELECT COUNT(*) as count FROM table_sessions').get().count,
  tables: db.prepare('SELECT COUNT(*) as count FROM tables').get().count
};

console.log('[Clean] Reset Complete! Current DB status:');
console.log(counts);

const activeTables = db.prepare('SELECT table_number, qr_token, status, is_revoked FROM tables').all();
console.log('\n[Clean] Clean Active Tables:');
console.table(activeTables);
