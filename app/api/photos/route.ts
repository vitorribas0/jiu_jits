import { db } from '@/lib/db';
import { requireRole, authenticate } from '@/lib/auth';
import { storeImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const classId = req.nextUrl.searchParams.get('classId');

  let query = db
    .from('photos')
    .select(`
      *,
      uploaded_by:uploaded_by (
        id, name
      ),
      class:class_id (
        id, name
      )
    `)
    .or('active.eq.true,active.is.null')
    .order('taken_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120);

  if (classId) {
    query = query.eq('class_id', classId);
  } else if (auth.user.role === 'aluno') {
    // Aluno vê fotos só das turmas em que está matriculado
    const { data: enrollments } = await db
      .from('class_students')
      .select('class_id')
      .eq('student_id', auth.user.id);

    const classIds = (enrollments || []).map((e: any) => e.class_id);
    if (classIds.length > 0) {
      query = query.in('class_id', classIds);
    } else {
      return NextResponse.json([]);
    }
  } else if (auth.user.role === 'professor') {
    // Professor vê fotos das suas turmas
    const { data: ownClasses } = await db
      .from('classes')
      .select('id')
      .eq('professor_id', auth.user.id);

    const classIds = (ownClasses || []).map((c: any) => c.id);
    if (classIds.length > 0) {
      query = query.in('class_id', classIds);
    } else {
      return NextResponse.json([]);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar fotos:', error);
    return NextResponse.json({ error: 'Erro ao buscar fotos' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Envio inválido' }, { status: 400 });
  }

  const file = form.get('file');
  const classId = String(form.get('classId') ?? '');
  const caption = String(form.get('caption') ?? '').trim();
  const takenAtRaw = String(form.get('takenAt') ?? '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione uma foto' }, { status: 400 });
  }

  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: 'Formato não aceito. Envie JPG, PNG ou WebP.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'A imagem passou de 8MB mesmo depois da compressão.' },
      { status: 400 }
    );
  }

  if (!classId) {
    return NextResponse.json({ error: 'Selecione a turma' }, { status: 400 });
  }

  const { data: turma, error: classError } = await db
    .from('classes')
    .select('id, professor_id')
    .eq('id', classId)
    .or('active.eq.true,active.is.null')
    .single();

  if (classError || !turma) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && turma.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode enviar fotos das suas turmas' },
      { status: 403 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeImage(buffer, file.type);

  const takenAt = takenAtRaw
    ? new Date(`${takenAtRaw}T12:00:00Z`).toISOString()
    : new Date().toISOString();

  const { data: photo, error } = await db
    .from('photos')
    .insert([
      {
        class_id: classId,
        uploaded_by: auth.user.id,
        taken_at: takenAt,
        caption: caption || null,
        content_type: file.type,
        bytes: buffer.length,
        ...stored,
      },
    ])
    .select(`
      *,
      uploaded_by:uploaded_by (
        id, name
      ),
      class:class_id (
        id, name
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao criar foto:', error);
    return NextResponse.json({ error: 'Erro ao criar foto' }, { status: 500 });
  }

  return NextResponse.json(photo, { status: 201 });
}
