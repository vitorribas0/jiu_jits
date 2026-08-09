'use client';

import { useEffect, useState } from 'react';
import { fetchImageUrl } from '@/lib/api';

export interface ClassImageRef {
  storage: 'cloudinary' | 'db';
  url?: string;
}

/**
 * Imagem da turma. Como nas fotos, a versão guardada no Mongo precisa do
 * token e `<img src>` não manda cabeçalho, então buscamos os bytes e usamos
 * um object URL. Sem imagem, mostra a inicial da turma.
 */
export function ClassImage({
  classId,
  image,
  name,
  className = '',
}: {
  classId: string;
  image?: ClassImageRef | null;
  name: string;
  className?: string;
}) {
  const [src, setSrc] = useState(image?.url ?? '');

  useEffect(() => {
    if (!image || image.url) {
      setSrc(image?.url ?? '');
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchImageUrl(`/api/classes/${classId}/image`)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [classId, image]);

  if (!src) {
    return (
      <div
        aria-hidden
        className={`flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 font-bold text-white ${className}`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <img src={src} alt="" className={`object-cover ${className}`} />;
}
