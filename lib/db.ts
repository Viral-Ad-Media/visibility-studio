import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 10,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  summary_md TEXT,
  error TEXT,
  csv_drive_url TEXT,
  csv_drive_backed_up_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL REFERENCES audits(id),
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  website TEXT,
  maps_url TEXT,
  phone TEXT,
  email TEXT,
  rating TEXT,
  review_count TEXT,
  source_urls_json TEXT,
  homepage_headline TEXT,
  main_cta TEXT,
  seo_score INTEGER,
  conversion_score INTEGER,
  trust_score INTEGER,
  opportunity_score INTEGER,
  priority TEXT,
  visibility_issues TEXT,
  website_improvements TEXT,
  local_seo_opportunities TEXT,
  content_opportunities TEXT,
  outreach_angle TEXT,
  outreach_subject TEXT,
  outreach_email TEXT,
  audit_notes TEXT,
  crm_status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL REFERENCES audits(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  stage TEXT NOT NULL DEFAULT 'Selected',
  redesign_status TEXT NOT NULL DEFAULT 'pending',
  redesign_html TEXT,
  redesign_error TEXT,
  booking_status TEXT NOT NULL DEFAULT 'pending',
  booking_link TEXT,
  booking_event_type TEXT,
  booking_error TEXT,
  redesign_drive_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, business_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

// Lightweight, idempotent migrations for columns added after a table already
// existed — CREATE TABLE IF NOT EXISTS above doesn't retrofit existing tables.
function migrate(db: Database.Database) {
  function addColumnIfMissing(table: string, column: string, ddl: string) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }
  addColumnIfMissing("audits", "csv_drive_url", "csv_drive_url TEXT");
  addColumnIfMissing("audits", "csv_drive_backed_up_at", "csv_drive_backed_up_at TEXT");
  addColumnIfMissing("campaign_businesses", "redesign_drive_url", "redesign_drive_url TEXT");
}

function open(): Database.Database {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "visibility.db"));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Cache across Next.js dev hot reloads so we don't leak handles.
const globalForDb = globalThis as unknown as { __visibilityDb?: Database.Database };
const db = globalForDb.__visibilityDb ?? open();
globalForDb.__visibilityDb = db;

export default db;

export * from "./shared";
