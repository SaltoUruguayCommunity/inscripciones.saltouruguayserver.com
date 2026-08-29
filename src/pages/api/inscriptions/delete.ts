import type { APIRoute } from 'astro';
import { client } from '../../../db';
import { InscriptionsTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { inscriptionId } = body;

    if (!inscriptionId) {
      return new Response(JSON.stringify({ success: false, error: 'inscriptionId requerido' }), { status: 400 });
    }

    const deleted = await client
      .delete(InscriptionsTable)
      .where(eq(InscriptionsTable.id, inscriptionId))
      .returning()
      .get();

    if (!deleted) {
      return new Response(JSON.stringify({ success: false, error: 'Inscripción no encontrada' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error deleting inscription:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
