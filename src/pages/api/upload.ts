import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.is_admin) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return new Response(JSON.stringify({ success: false, error: 'No image provided' }), { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const uniqueName = `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const formData = new URLSearchParams();
    formData.append('key', import.meta.env.IMGBB_API_KEY);
    formData.append('source', base64Data);
    formData.append('name', uniqueName);
    formData.append('format', 'json');

    const res = await fetch('https://imgcdn.dev/api/1/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      return new Response(JSON.stringify({ success: true, url: data.image.url }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ success: false, error: data.error?.message || data.status_txt || 'Upload failed' }), { status: 500 });
    }
  } catch (err) {
    console.error('Error uploading image:', err);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
};
