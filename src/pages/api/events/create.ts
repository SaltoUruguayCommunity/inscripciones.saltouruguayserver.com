import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { EventsTable } from '../../../db/schema';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, description, coverImage, eventDate, eventLocation, status, maxParticipants, requireDiscord, customFields } = body;

    if (!title) {
      return new Response(JSON.stringify({ success: false, error: 'El título es obligatorio' }), { status: 400 });
    }

    const result = await client
      .insert(EventsTable)
      .values({
        title,
        description: description || null,
        coverImage: coverImage || null,
        eventDate: eventDate || null,
        eventLocation: eventLocation || null,
        status: status || 'upcoming',
        maxParticipants: maxParticipants || null,
        requireDiscord: requireDiscord || false,
        customFields: customFields || null,
        createdBy: user.id,
      })
      .returning()
      .get();

    return new Response(JSON.stringify({ success: true, event: result }), { status: 201 });
  } catch (err) {
    console.error('Error creating event:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
