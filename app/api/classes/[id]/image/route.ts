import { db } from '@/lib/db';
import { authenticate, requireRole } from '@/lib/auth';
import { removeImage, storeImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: turma, error } = await db
    .from('classes')
    .select('id, image')
    .eq('id', id)
    .single();

  if (error || !turma?.image?.data) {
    return NextResponse.json({ error: 'Turma sem imagem' }, { status: 404 });
  }

  // Decodificar base64 se necessário
  let buffer: Buffer;
  if (typeof turma.image.data === 'string') {
    buffer = Buffer.from(turma.image.data, 'base64');
  } else {
    buffer = Buffer.from(turma.image.data);
  }

  return new NextResponse(buffer.toString('binary'), {
    headers: {
      'Content-Type': turma.image.contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione uma imagem' }, { status: 400 });
  }

  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: 'Formato não aceito. Envie JPG, PNG ou WebP.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'A imagem passou de 4MB mesmo depois da compressão.' },
      { status: 400 }
    );
  }

  const { id } = await params;

  const { data: turma, error: classError } = await db
    .from('classes')
    .select('id, professor_id, image')
    .eq('id', id)
    .or('active.eq.true,active.is.null')
    .single();

  if (classError || !turma) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && turma.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode mudar a imagem das suas turmas' },
      { status: 403 }
    );
  }

  // Remover imagem anterior
  if (turma.image?.publicId) {
    await removeImage(turma.image.publicId);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeImage(buffer, file.type);

  await db
    .from('classes')
    .update({
      image: { ...stored, contentType: file.type },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    message: 'Imagem da turma atualizada',
    image: {
      storage: stored.storage,
      url: stored.storage === 'cloudinary' ? stored.url : undefined,
      contentType: file.type,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: turma, error } = await db
    .from('classes')
    .select('id, professor_id, image')
    .eq('id', id)
    .single();

  if (error || !turma) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && turma.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode mudar a imagem das suas turmas' },
      { status: 403 }
    );
  }

  if (turma.image?.publicId) {
    await removeImage(turma.image.publicId);
  }

  await db
    .from('classes')
    .update({
      image: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({ message: 'Imagem removida' });
}
