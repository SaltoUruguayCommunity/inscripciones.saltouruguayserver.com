import type { APIContext } from 'astro';
import { getBearerUser } from './bearer-user';
import { client } from '../db';
import { InscriptionsTable, EventsTable, type CustomField } from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { isDiscordMember, getUserDiscordInfo } from './discord';

export async function createInscription({ request, locals }: Pick<APIContext, "request" | "locals">, routeEventId?: number) {
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
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'JSON inválido' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'JSON inválido' }, { status: 400 });
    }
    const eventId = routeEventId ?? body.eventId;
    const { customData } = body;

    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
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

    const existing = await client.select({ id: InscriptionsTable.id }).from(InscriptionsTable)
      .where(and(eq(InscriptionsTable.userId, user.id), eq(InscriptionsTable.eventId, eventId))).get();
    if (existing) {
      return Response.json({ success: false, error: 'Ya estás inscrito en este evento' }, { status: 409 });
    }
    if (event.status !== 'open') {
      return Response.json({ success: false, error: 'Las inscripciones no están abiertas' }, { status: 409 });
    }
    if (customData != null && (typeof customData !== 'object' || Array.isArray(customData))) {
      return Response.json({ success: false, error: 'Campos personalizados inválidos' }, { status: 400 });
    }
    const answers: Record<string, string> = {};
    for (const field of (event.customFields ?? []) as CustomField[]) {
      const value = customData?.[field.name] ?? '';
      if (typeof value !== 'string' || (field.required && !value.trim())) {
        return Response.json({ success: false, error: `Revisá el campo: ${field.label}` }, { status: 400 });
      }
      if (value && (field.type === 'select' || field.type === 'radio') && !field.options?.includes(value)) {
        return Response.json({ success: false, error: `Opción inválida: ${field.label}` }, { status: 400 });
      }
      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return Response.json({ success: false, error: `Email inválido: ${field.label}` }, { status: 400 });
      }
      if (value && field.type === 'url') {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
        } catch {
          return Response.json({ success: false, error: `URL inválida: ${field.label}` }, { status: 400 });
        }
      }
      answers[field.name] = value;
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

    // Check capacity and insert in one SQLite statement to avoid overbooking.
    const result = await client.get<{ id: number }>(sql`
      INSERT INTO inscriptions (event_id, user_id, custom_data)
      SELECT ${eventId}, ${user.id}, ${JSON.stringify(answers)}
      WHERE EXISTS (
        SELECT 1 FROM events WHERE id = ${eventId} AND status = 'open'
        AND (max_participants IS NULL OR
          (SELECT count(*) FROM inscriptions WHERE event_id = ${eventId}) < max_participants)
      )
      ON CONFLICT (user_id, event_id) DO NOTHING
      RETURNING id
    `);
    if (!result) {
      return Response.json({ success: false, error: 'No se pudo inscribir: cupos agotados, evento cerrado o inscripción existente' }, { status: 409 });
    }
    const inscription = await client.select().from(InscriptionsTable).where(eq(InscriptionsTable.id, result.id)).get();

    return Response.json({ success: true, inscription }, { status: 201 });
  } catch (err) {
    console.error('Error creating inscription:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
