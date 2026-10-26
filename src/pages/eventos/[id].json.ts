import type { APIRoute } from "astro";
import { and, eq, sql } from "drizzle-orm";
import { client } from "../../db";
import { EventsTable, InscriptionsTable } from "../../db/schema";
import { getBearerUser } from "../../lib/bearer-user";
import { getDiscordStatus, registrationEligibility } from "../../lib/registration-eligibility";

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
  const id = Number(params.id);
  if (!params.id || !/^[1-9][0-9]*$/.test(params.id) || !Number.isSafeInteger(id)) {
    return json({ success: false, error: "ID inválido" }, 400);
  }
  try {
    let user = locals.user;
    const authorization = request.headers.get('Authorization');
    if (authorization !== null) {
      try { user = await getBearerUser(authorization); }
      catch { return json({ success: false, error: 'No se pudo validar el token' }, 503); }
      if (!user) return json({ success: false, error: 'Token inválido' }, 401);
    }
    const event = await client.select({
      id: EventsTable.id, title: EventsTable.title, description: EventsTable.description,
      coverImage: EventsTable.coverImage, eventDate: EventsTable.eventDate,
      eventLocation: EventsTable.eventLocation, status: EventsTable.status,
      maxParticipants: EventsTable.maxParticipants, requireDiscord: EventsTable.requireDiscord,
      customFields: EventsTable.customFields, createdAt: EventsTable.createdAt, updatedAt: EventsTable.updatedAt,
    }).from(EventsTable).where(eq(EventsTable.id, id)).get();
    if (!event) return json({ success: false, error: "Evento no encontrado" }, 404);
    const count = await client.select({ count: sql<number>`count(*)` }).from(InscriptionsTable)
      .where(eq(InscriptionsTable.eventId, id)).get();
    const inscriptionCount = count?.count ?? 0;
    const [discordStatus, existing] = await Promise.all([
      getDiscordStatus(event.requireDiscord, user?.susId),
      user ? client.select({ id: InscriptionsTable.id }).from(InscriptionsTable)
        .where(and(eq(InscriptionsTable.eventId, id), eq(InscriptionsTable.userId, user.id))).get() : null,
    ]);
    return json({ success: true, event: {
      ...event, inscriptionCount,
      spotsLeft: event.maxParticipants == null ? null : Math.max(0, event.maxParticipants - inscriptionCount),
      registration: registrationEligibility(event, inscriptionCount, Boolean(user), Boolean(existing), discordStatus),
    } });
  } catch (error) {
    console.error("Error fetching event:", error);
    return json({ success: false, error: "Error interno" }, 500);
  }
};
