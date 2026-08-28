import 'dotenv/config';
import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await turso.executeMultiple(`
  DROP TABLE IF EXISTS inscriptions;

  CREATE TABLE IF NOT EXISTS inscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    custom_data TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (current_timestamp)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS user_event_uniq ON inscriptions(user_id, event_id);
`);

// Add custom_fields to events if it doesn'texists
const columns = await turso.execute("PRAGMA table_info(events)");
const hasCustomFields = columns.rows.some((col: any) => col.name === 'custom_fields');
if (!hasCustomFields) {
  await turso.execute("ALTER TABLE events ADD COLUMN custom_fields TEXT");
  console.log('Added custom_fields column to events');
}

console.log('Migration applied successfully');
await turso.close();
