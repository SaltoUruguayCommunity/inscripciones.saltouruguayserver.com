import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { InscriptionsTable, UsersTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { INSCRIPTIONS_API_KEY } from 'astro:env/server';

export const GET: APIRoute = async ({ url, request }) => {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== INSCRIPTIONS_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401 }
    );
  }

  const eventId = url.searchParams.get('eventId') || '3';
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    const inscriptions = await client
      .select({
        id: InscriptionsTable.id,
        customData: InscriptionsTable.customData,
        status: InscriptionsTable.status,
        createdAt: InscriptionsTable.createdAt,
        displayName: UsersTable.displayName,
        email: UsersTable.email,
        avatar: UsersTable.avatar,
        username: UsersTable.username,
        discordUsername: UsersTable.discordUsername,
        susId: UsersTable.susId,
      })
      .from(InscriptionsTable)
      .innerJoin(UsersTable, eq(InscriptionsTable.userId, UsersTable.id))
      .where(eq(InscriptionsTable.eventId, Number(eventId)))
      .all();

    if (dryRun) {
      // Return preview with mapped fields
      const preview = inscriptions.map((insc) => {
        const custom = insc.customData || {};
        return {
          adminId: insc.id,
          userId: insc.susId,
          displayName: insc.displayName,
          email: insc.email,
          discordUsername: insc.discordUsername,
          minecraft_username: custom.minecraft_username || null,
          participated_sc: custom.participated_sc || null,
          instagram: custom.instagram || null,
          createdAt: insc.createdAt,
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          total: preview.length,
          inscriptions: preview,
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inscriptions }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error exporting inscriptions:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500 }
    );
  }
};
