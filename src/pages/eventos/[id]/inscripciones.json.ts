import type { APIRoute } from "astro";
import { createInscription } from "../../../lib/create-inscription";
import { getBearerUser } from "../../../lib/bearer-user";
import { client } from "../../../db";
import { EventsTable, InscriptionsTable } from "../../../db/schema";
import { and, eq } from "drizzle-orm";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const eventId = Number(params.id);
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (!params.id || !/^[1-9][0-9]*$/.test(params.id) || !Number.isSafeInteger(eventId)) {
    return json({ success: false, error: "ID inválido" }, 400);
  }
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ success: false, error: "Bearer token requerido" }, 401);
  try {
    const user = await getBearerUser(authorization);
    if (!user) return json({ success: false, error: "Token inválido" }, 401);
    const event = await client.select({ id: EventsTable.id }).from(EventsTable)
      .where(eq(EventsTable.id, eventId)).get();
    if (!event) return json({ success: false, error: "Evento no encontrado" }, 404);
    const inscription = await client.select({
      id: InscriptionsTable.id, eventId: InscriptionsTable.eventId,
      status: InscriptionsTable.status, customData: InscriptionsTable.customData,
      createdAt: InscriptionsTable.createdAt,
    }).from(InscriptionsTable).where(and(
      eq(InscriptionsTable.eventId, eventId), eq(InscriptionsTable.userId, user.id),
    )).get();
    return json({ success: true, inscription: inscription ?? null });
  } catch (error) {
    console.error("Error fetching user inscription:", error);
    return json({ success: false, error: "No se pudo consultar la inscripción" }, 503);
  }
};

export const POST: APIRoute = (context) => {
  const id = context.params.id;
  const eventId = Number(id);
  if (!id || !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(eventId)) {
    return Response.json({ success: false, error: "ID inválido" }, { status: 400 });
  }
  if (!context.request.headers.has("Authorization")) {
    return Response.json({ success: false, error: "Bearer token requerido" }, { status: 401 });
  }
  return createInscription(context, eventId);
};
