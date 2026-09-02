import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { InscriptionsTable, EventsTable, UsersTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { isDiscordMember, getUserDiscordInfo } from '../../../lib/discord';

export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const discordEvents = await client
      .select()
      .from(EventsTable)
      .where(eq(EventsTable.requireDiscord, true))
      .all();

    if (discordEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0, checked: 0 }), { status: 200 });
    }

    let totalDeleted = 0;
    let totalChecked = 0;

    for (const event of discordEvents) {
      const inscriptions = await client
        .select({
          id: InscriptionsTable.id,
          userId: InscriptionsTable.userId,
        })
        .from(InscriptionsTable)
        .where(eq(InscriptionsTable.eventId, event.id))
        .all();

      for (const ins of inscriptions) {
        totalChecked++;
        try {
          const discordInfo = await getUserDiscordInfo(ins.userId);

          if (!discordInfo.discordId) {
            await client.delete(InscriptionsTable).where(eq(InscriptionsTable.id, ins.id)).run();
            totalDeleted++;
            continue;
          }

          const member = await isDiscordMember(discordInfo.discordId);
          if (!member) {
            await client.delete(InscriptionsTable).where(eq(InscriptionsTable.id, ins.id)).run();
            totalDeleted++;
          }
        } catch (err) {
          console.error(`Error checking inscription ${ins.id}:`, err);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, deleted: totalDeleted, checked: totalChecked }), { status: 200 });
  } catch (err) {
    console.error('Error cleaning invalid inscriptions:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
