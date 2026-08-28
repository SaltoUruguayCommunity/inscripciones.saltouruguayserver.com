import 'dotenv/config';
import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const columns = await turso.execute("PRAGMA table_info(users)");

if (!columns.rows.some((col: any) => col.name === 'discord_id')) {
  await turso.execute("ALTER TABLE users ADD COLUMN discord_id TEXT");
  console.log('Added discord_id column');
}

if (!columns.rows.some((col: any) => col.name === 'discord_username')) {
  await turso.execute("ALTER TABLE users ADD COLUMN discord_username TEXT");
  console.log('Added discord_username column');
}

console.log('Done');
await turso.close();
