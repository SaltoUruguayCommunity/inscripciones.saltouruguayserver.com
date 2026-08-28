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
    const { id, title, description, coverImage, eventDate, eventLocation, status, maxParticipants, customFields } = body;

    if (!id || !title) {
      return new Response(JSON.stringify({ success: false, error: 'ID y título son obligatorios' }), { status: 400 });
    }

    await client
      .update(EventsTable)
      .set({
        title,
        description: description || null,
        coverImage: coverImage || null,
        eventDate: eventDate || null,
        eventLocation: eventLocation || null,
        status: status || 'upcoming',
        maxParticipants: maxParticipants || null,
        customFields: customFields || null,
      })
      .where(eq(EventsTable.id, id))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error updating event:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
