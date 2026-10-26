import type { APIRoute } from 'astro';
import { createInscription } from '../../../lib/create-inscription';

export const POST: APIRoute = (context) => createInscription(context);
