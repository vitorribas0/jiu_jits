'use client';

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Reduz a imagem antes do upload: fotos de celular chegam com 4–6MB e ficam
 * em torno de 300KB depois disso, sem perda visível na galeria.
 * `imageOrientation: 'from-image'` respeita o EXIF, senão fotos tiradas
 * na vertical sobem deitadas.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // formato que o navegador não decodifica: envia como veio
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  );

  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
  });
}
