import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { InscriptionsTable, UsersTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  const eventId = url.searchParams.get('eventId');
  if (!eventId) {
    return new Response(JSON.stringify({ success: false, error: 'eventId requerido' }), { status: 400 });
  }

  try {
    const inscriptions = await client
      .select({
        id: InscriptionsTable.id,
        customData: InscriptionsTable.customData,
        notes: InscriptionsTable.notes,
        status: InscriptionsTable.status,
        createdAt: InscriptionsTable.createdAt,
        displayName: UsersTable.displayName,
        email: UsersTable.email,
        avatar: UsersTable.avatar,
        username: UsersTable.username,
      })
      .from(InscriptionsTable)
      .innerJoin(UsersTable, eq(InscriptionsTable.userId, UsersTable.id))
      .where(eq(InscriptionsTable.eventId, Number(eventId)))
      .all();

    return new Response(JSON.stringify({ success: true, inscriptions }), { status: 200 });
  } catch (err) {
    console.error('Error fetching inscriptions:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
