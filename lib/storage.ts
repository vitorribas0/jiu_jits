import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/**
 * Só considera o Cloudinary configurado se as três variáveis existirem e não
 * forem os placeholders que vêm no .env.local de exemplo.
 */
export const usingCloudinary = Boolean(
  CLOUD_NAME &&
    API_KEY &&
    API_SECRET &&
    !CLOUD_NAME.startsWith('seu_') &&
    !API_KEY.startsWith('sua_') &&
    !API_SECRET.startsWith('seu_')
);

if (usingCloudinary) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
  });
}

export type StoredFile =
  | { storage: 'cloudinary'; url: string; publicId: string }
  | { storage: 'db'; data: Buffer };

/**
 * Guarda a imagem no Cloudinary quando há credenciais; caso contrário devolve
 * o buffer para ser salvo no próprio documento do Mongo. Assim o upload
 * funciona em desenvolvimento sem precisar de conta em serviço externo.
 */
export async function storeImage(
  buffer: Buffer,
  contentType: string
): Promise<StoredFile> {
  if (!usingCloudinary) {
    return { storage: 'db', data: buffer };
  }

  const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'gavioes/treinos',
    resource_type: 'image',
  });

  return {
    storage: 'cloudinary',
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/** Remove do Cloudinary. Fotos guardadas no Mongo somem junto com o documento. */
export async function removeImage(publicId?: string | null) {
  if (!usingCloudinary || !publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // A foto já foi marcada como removida no banco; falhar aqui só deixaria
    // um arquivo órfão no Cloudinary, então não interrompe a requisição.
    console.error('Falha ao remover imagem do Cloudinary:', err);
  }
}
