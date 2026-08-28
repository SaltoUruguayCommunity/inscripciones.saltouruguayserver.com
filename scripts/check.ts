import 'dotenv/config';
import { createClient } from '@libsql/client';

const c = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await c.execute('PRAGMA table_info(events)');
console.log('Events columns:', r.rows.map((c) => c.name));

const events = await c.execute('SELECT id, title, cover_image FROM events');
console.log('Events:', events.rows);

await c.close();
