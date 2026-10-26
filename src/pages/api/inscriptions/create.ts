import type { APIRoute } from 'astro';
import { getBearerUser } from '../../../lib/bearer-user';
import { client } from '../../../db';
import { InscriptionsTable, EventsTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { isDiscordMember, getUserDiscordInfo } from '../../../lib/discord';

export const POST: APIRoute = async ({ request, locals }) => {
  let user = locals.user;
  const authorization = request.headers.get('Authorization');
  if (authorization !== null) {
    try {
      user = await getBearerUser(authorization);
    } catch (error) {
      console.error('Error validating main-site token:', error);
      return Response.json({ success: false, error: 'No se pudo validar el token' }, { status: 503 });
    }
  }
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Debes iniciar sesión' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { eventId, customData } = body;

    if (!eventId) {
      return new Response(JSON.stringify({ success: false, error: 'eventId requerido' }), { status: 400 });
    }

    const event = await client
      .select()
      .from(EventsTable)
      .where(eq(EventsTable.id, eventId))
      .get();

    if (!event) {
      return new Response(JSON.stringify({ success: false, error: 'Evento no encontrado' }), { status: 404 });
    }

    if (event.requireDiscord) {
      console.log(`[create-inscription] Event ${eventId} requires Discord, checking user ${user.id} (susId=${user.susId})...`);
      const freshDiscord = await getUserDiscordInfo(user.susId);
      console.log(`[create-inscription] Fresh Discord response:`, JSON.stringify(freshDiscord));

      if (!freshDiscord.discordId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Debes vincular tu cuenta de Discord en saltouruguayserver.com/usuario' }),
          { status: 403 }
        );
      }

      const member = await isDiscordMember(freshDiscord.discordId);
      if (!member) {
        return new Response(
          JSON.stringify({ success: false, error: 'Debes ser miembro del servidor de Discord de SaltoUruguayServer' }),
          { status: 403 }
        );
      }
    }

    const alreadyInscribed = await client
      .select()
      .from(InscriptionsTable)
      .where(eq(InscriptionsTable.userId, user.id))
      .all()
      .then((rows) => rows.some((i) => i.eventId === eventId));

    if (alreadyInscribed) {
      return new Response(JSON.stringify({ success: false, error: 'Ya estás inscrito en este evento' }), { status: 400 });
    }

    const result = await client
      .insert(InscriptionsTable)
      .values({
        eventId,
        userId: user.id,
        customData: customData || null,
      })
      .returning()
      .get();

    return new Response(JSON.stringify({ success: true, inscription: result }), { status: 201 });
  } catch (err) {
    console.error('Error creating inscription:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
