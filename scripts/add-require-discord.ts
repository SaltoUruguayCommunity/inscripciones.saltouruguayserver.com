import 'dotenv/config';
import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const columns = await turso.execute("PRAGMA table_info(events)");

if (!columns.rows.some((col: any) => col.name === 'require_discord')) {
  await turso.execute("ALTER TABLE events ADD COLUMN require_discord INTEGER NOT NULL DEFAULT 0");
  console.log('Added require_discord column');
}

console.log('Done');
await turso.close();
