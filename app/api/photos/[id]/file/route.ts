import { db } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: photo, error } = await db
    .from('photos')
    .select('id, data, content_type, active')
    .eq('id', id)
    .single();

  if (error || !photo || photo.active === false || !photo.data) {
    return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
  }

  // Decodificar base64 se necessário
  let buffer: Buffer;
  if (typeof photo.data === 'string') {
    buffer = Buffer.from(photo.data, 'base64');
  } else {
    buffer = Buffer.from(photo.data);
  }

  return new NextResponse(buffer.toString('binary'), {
    headers: {
      'Content-Type': photo.content_type,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
