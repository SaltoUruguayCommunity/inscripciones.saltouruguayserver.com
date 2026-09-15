import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { UsersTable } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { getUserDiscordInfo } from '../../../lib/discord';

export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const users = await client
      .select()
      .from(UsersTable)
      .where(sql`${UsersTable.discordId} IS NULL`)
      .all();

    if (users.length === 0) {
      return new Response(JSON.stringify({ success: true, total: 0, synced: 0, updated: 0, errors: 0 }), { status: 200 });
    }

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const u of users) {
      try {
        const discordInfo = await getUserDiscordInfo(u.susId);
        synced++;

        if (discordInfo.discordId !== u.discordId || discordInfo.discordUsername !== u.discordUsername) {
          await client
            .update(UsersTable)
            .set({
              discordId: discordInfo.discordId,
              discordUsername: discordInfo.discordUsername,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(UsersTable.id, u.id))
            .run();
          updated++;
        }
      } catch (err) {
        console.error(`[sync-discord] Error syncing user ${u.susId}:`, err);
        errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, total: users.length, synced, updated, errors }), { status: 200 });
  } catch (err) {
    console.error('[sync-discord] Error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};