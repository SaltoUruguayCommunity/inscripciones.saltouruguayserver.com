import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { UsersTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getUserDiscordInfo } from '../../../lib/discord';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), { status: 401 });
  }

  try {
    let discordId = (user as any).discordId || null;
    console.log(`[check-discord] User ${user.id} (susId=${(user as any).susId}): session discordId=${discordId}`);

    if (!discordId) {
      console.log(`[check-discord] No discordId in session, fetching fresh from upstream...`);
      const freshDiscord = await getUserDiscordInfo((user as any).susId);
      console.log(`[check-discord] Fresh response:`, JSON.stringify(freshDiscord));

      if (freshDiscord.discordId) {
        discordId = freshDiscord.discordId;
        await client
          .update(UsersTable)
          .set({ discordId: freshDiscord.discordId, discordUsername: freshDiscord.discordUsername })
          .where(eq(UsersTable.id, user.id))
          .run();
        console.log(`[check-discord] Updated DB for user ${user.id} with discordId=${freshDiscord.discordId}`);
      } else {
        console.log(`[check-discord] Upstream returned no discordId for user ${user.id}`);
      }
    }

    return new Response(JSON.stringify({ discordId }), { status: 200 });
  } catch (err) {
    console.error('[check-discord] Error checking Discord:', err);
    return new Response(JSON.stringify({ discordId: null }), { status: 200 });
  }
};