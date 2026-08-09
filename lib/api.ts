'use client';

export class ApiError extends Error {}

/**
 * Fetch autenticado. Injeta o Bearer token e converte erro da API em exceção
 * com a mensagem que veio do servidor.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.clear();
    window.location.href = '/login';
    throw new ApiError('Sessão expirada');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string })?.error ?? 'Algo deu errado. Tente de novo.'
    );
  }

  return data as T;
}

/**
 * Envia FormData (upload de arquivo). Não define Content-Type de propósito:
 * o navegador precisa gerar o boundary do multipart sozinho.
 */
export async function apiUpload<T = unknown>(
  path: string,
  body: FormData
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(path, {
    method: 'POST',
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string })?.error ?? 'Não foi possível enviar a foto'
    );
  }

  return data as T;
}

/** Baixa uma imagem protegida e devolve um object URL para usar no <img>. */
export async function fetchImageUrl(path: string): Promise<string> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) throw new ApiError('Não foi possível carregar a imagem');

  return URL.createObjectURL(await res.blob());
}

/** Pega a posição atual do navegador com mensagens de erro em português. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new ApiError('Seu navegador não suporta geolocalização'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const messages: Record<number, string> = {
        1: 'Você precisa permitir o acesso à localização para fazer check-in',
        2: 'Não foi possível obter sua localização. Verifique o GPS.',
        3: 'A busca pela localização demorou demais. Tente de novo.',
      };
      reject(new ApiError(messages[err.code] ?? 'Erro ao obter localização'));
    }, { enableHighAccuracy: true, timeout: 15000 });
  });
}
