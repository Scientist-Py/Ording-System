-- SQLite schema for Chapter One Cafe Standalone System

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, RESERVED
  is_revoked INTEGER DEFAULT 0,
  token_created_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS table_sessions (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables(id),
  session_code TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, CLOSED
  running_total REAL DEFAULT 0,
  started_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  consent_saved INTEGER DEFAULT 1,
  total_visits INTEGER DEFAULT 1,
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  favorite_items TEXT DEFAULT '[]', -- JSON
  first_visit_at TEXT NOT NULL,
  last_visit_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_devices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  is_revoked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  offer_price REAL,
  image_url TEXT,
  is_veg INTEGER DEFAULT 1,
  is_available INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  customizations TEXT DEFAULT '[]', -- JSON
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number INTEGER NOT NULL UNIQUE,
  table_id TEXT NOT NULL REFERENCES tables(id),
  table_session_id TEXT NOT NULL REFERENCES table_sessions(id),
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  subtotal REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT DEFAULT 'NEW', -- NEW, ACCEPTED, PREPARING, READY, SERVED, COMPLETED, REJECTED
  rejection_reason TEXT,
  special_instructions TEXT,
  idempotency_key TEXT UNIQUE,
  whatsapp_opened INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  item_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  customizations_selected TEXT DEFAULT '[]', -- JSON
  item_subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_requests (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables(id),
  table_session_id TEXT REFERENCES table_sessions(id),
  request_type TEXT NOT NULL, -- WAITER, BILL, WATER
  status TEXT DEFAULT 'PENDING', -- PENDING, ACKNOWLEDGED
  created_at TEXT NOT NULL,
  acknowledged_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

-- Indices for rapid lookups and constraints
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON tables(qr_token);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_devices_token ON customer_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_status ON customer_requests(status);
