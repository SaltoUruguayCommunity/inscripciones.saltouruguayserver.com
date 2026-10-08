import type { APIRoute } from 'astro';
import { INSCRIPTIONS_API_KEY } from 'astro:env/server';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { client } from '../../../db';
import { EventsTable, InscriptionsTable } from '../../../db/schema';

const VALID_STATUSES = ['upcoming', 'open', 'ongoing', 'closed', 'finished'] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

/**
 * GET /api/events/list — Listado público de eventos (server-to-server).
 *
 * Auth: header `X-API-Key: <INSCRIPTIONS_API_KEY>`.
 *
 * Query params (todos opcionales):
 * - `id`: un id concreto (detalle). Ignora paginación.
 * - `status`: uno o varios separados por coma (`open`, `upcoming`, ...).
 *   Alias: `active` = `open,upcoming,ongoing`. Por defecto: todos.
 * - `q`: búsqueda parcial en título/descripción.
 * - `from` / `to`: filtra por `eventDate` (ISO, `YYYY-MM-DD` o datetime).
 * - `limit`: 1–100 (defecto 20). `offset`: >= 0 (defecto 0).
 * - `sort`: `eventDate_asc` (defecto) | `eventDate_desc` | `createdAt_desc`.
 * - `includeCounts`: `true` (defecto) | `false` — incluye
 *   `inscriptionCount` y `spotsLeft`.
 *
 * Pensado para que la web principal lo consuma con el token interno
 * y lo exponga al mobile vía Astro Action (`inscriptions.listEvents`).
 */
export const GET: APIRoute = async ({ url, request }) => {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== INSCRIPTIONS_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
  }

  const params = url.searchParams;

  // --- Paginación / orden ---
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const sort = params.get('sort') ?? 'eventDate_asc';
  if (!['eventDate_asc', 'eventDate_desc', 'createdAt_desc'].includes(sort)) {
    return new Response(JSON.stringify({ success: false, error: 'sort inválido (eventDate_asc | eventDate_desc | createdAt_desc)' }), { status: 400 });
  }
  const includeCounts = (params.get('includeCounts') ?? 'true') !== 'false';

  // --- Filtros ---
  const idParam = params.get('id');
  const id = idParam ? Number(idParam) : null;
  if (idParam && (!Number.isInteger(id) || (id as number) <= 0)) {
    return new Response(JSON.stringify({ success: false, error: 'id inválido' }), { status: 400 });
  }

  let statuses: EventStatus[] | null = null;
  const statusParam = params.get('status');
  if (statusParam) {
    const raw = statusParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const expanded = raw.flatMap((s) => (s === 'active' ? ['open', 'upcoming', 'ongoing'] : [s]));
    const invalid = expanded.filter((s) => !(VALID_STATUSES as readonly string[]).includes(s));
    if (invalid.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `status inválido: ${invalid.join(', ')} (válidos: ${VALID_STATUSES.join(', ')} | alias: active)` }),
        { status: 400 },
      );
    }
    statuses = [...new Set(expanded)] as EventStatus[];
  }

  const q = params.get('q')?.trim() || null;
  const from = params.get('from')?.trim() || null;
  const to = params.get('to')?.trim() || null;

  const conditions = [];
  if (id !== null) conditions.push(eq(EventsTable.id, id as number));
  if (statuses && statuses.length > 0) {
    conditions.push(
      statuses.length === 1 ? eq(EventsTable.status, statuses[0]) : inArray(EventsTable.status, statuses),
    );
  }
  if (q) {
    conditions.push(or(like(EventsTable.title, `%${q}%`), like(EventsTable.description, `%${q}%`)));
  }
  if (from) conditions.push(sql`${EventsTable.eventDate} >= ${from}`);
  if (to) conditions.push(sql`${EventsTable.eventDate} <= ${to}`);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    sort === 'eventDate_desc'
      ? [desc(EventsTable.eventDate)]
      : sort === 'createdAt_desc'
        ? [desc(EventsTable.createdAt)]
        : [asc(EventsTable.eventDate)];

  try {
    const totalRow = await client
      .select({ count: sql<number>`count(*)` })
      .from(EventsTable)
      .where(where)
      .get();
    const total = totalRow?.count ?? 0;

    const baseQuery = client
      .select({
        id: EventsTable.id,
        title: EventsTable.title,
        description: EventsTable.description,
        coverImage: EventsTable.coverImage,
        eventDate: EventsTable.eventDate,
        eventLocation: EventsTable.eventLocation,
        status: EventsTable.status,
        maxParticipants: EventsTable.maxParticipants,
        requireDiscord: EventsTable.requireDiscord,
        createdAt: EventsTable.createdAt,
        updatedAt: EventsTable.updatedAt,
      })
      .from(EventsTable)
      .where(where)
      .orderBy(...orderBy);

    const rows =
      id !== null
        ? await baseQuery.limit(1).all()
        : await baseQuery.limit(limit).offset(offset).all();

    // Conteo de inscriptos por evento en una sola query (evita N+1).
    let counts = new Map<number, number>();
    if (includeCounts && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const countRows = await client
        .select({ eventId: InscriptionsTable.eventId, count: sql<number>`count(*)` })
        .from(InscriptionsTable)
        .where(ids.length === 1 ? eq(InscriptionsTable.eventId, ids[0]) : inArray(InscriptionsTable.eventId, ids))
        .groupBy(InscriptionsTable.eventId)
        .all();
      counts = new Map(countRows.map((r) => [r.eventId, r.count]));
    }

    const events = rows.map((r) => {
      const inscriptionCount = counts.get(r.id) ?? 0;
      return {
        ...r,
        ...(includeCounts
          ? {
              inscriptionCount,
              spotsLeft: r.maxParticipants != null ? Math.max(0, r.maxParticipants - inscriptionCount) : null,
            }
          : {}),
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        total,
        limit: id !== null ? events.length : limit,
        offset: id !== null ? 0 : offset,
        events,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Error listing events:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
