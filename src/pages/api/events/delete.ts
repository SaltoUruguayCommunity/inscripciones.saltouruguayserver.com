import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { EventsTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'ID requerido' }), { status: 400 });
    }

    await client.delete(EventsTable).where(eq(EventsTable.id, id)).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error deleting event:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
