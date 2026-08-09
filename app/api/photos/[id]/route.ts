import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { removeImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: photo, error } = await db
    .from('photos')
    .select('id, uploaded_by, public_id, active')
    .eq('id', id)
    .single();

  if (error || !photo || photo.active === false) {
    return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && photo.uploaded_by !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode remover as fotos que enviou' },
      { status: 403 }
    );
  }

  if (photo.public_id) {
    await removeImage(photo.public_id);
  }

  await db.from('photos').delete().eq('id', id);

  return NextResponse.json({ message: 'Foto removida' });
}
