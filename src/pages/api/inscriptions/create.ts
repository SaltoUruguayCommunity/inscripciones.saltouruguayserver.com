import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { InscriptionsTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Debes iniciar sesión' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { eventId, customData } = body;

    if (!eventId) {
      return new Response(JSON.stringify({ success: false, error: 'eventId requerido' }), { status: 400 });
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
