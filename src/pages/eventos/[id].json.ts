import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";
import { client } from "../../db";
import { EventsTable, InscriptionsTable } from "../../db/schema";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!params.id || !/^[1-9][0-9]*$/.test(params.id) || !Number.isSafeInteger(id)) {
    return Response.json({ success: false, error: "ID inválido" }, { status: 400 });
  }
  try {
    const event = await client.select({
      id: EventsTable.id, title: EventsTable.title, description: EventsTable.description,
      coverImage: EventsTable.coverImage, eventDate: EventsTable.eventDate,
      eventLocation: EventsTable.eventLocation, status: EventsTable.status,
      maxParticipants: EventsTable.maxParticipants, requireDiscord: EventsTable.requireDiscord,
      customFields: EventsTable.customFields, createdAt: EventsTable.createdAt, updatedAt: EventsTable.updatedAt,
    }).from(EventsTable).where(eq(EventsTable.id, id)).get();
    if (!event) return Response.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
    const count = await client.select({ count: sql<number>`count(*)` }).from(InscriptionsTable)
      .where(eq(InscriptionsTable.eventId, id)).get();
    const inscriptionCount = count?.count ?? 0;
    return Response.json({ success: true, event: {
      ...event, inscriptionCount,
      spotsLeft: event.maxParticipants == null ? null : Math.max(0, event.maxParticipants - inscriptionCount),
    } });
  } catch (error) {
    console.error("Error fetching event:", error);
    return Response.json({ success: false, error: "Error interno" }, { status: 500 });
  }
};
