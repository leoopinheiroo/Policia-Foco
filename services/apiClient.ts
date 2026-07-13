import { supabase } from './supabase';

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(path, { ...options, headers });
}

export async function apiJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await apiFetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as any)?.error || `Erro na API (${res.status})`);
    }
    return data as T;
  } catch (e: any) {
    if (e?.name === 'AbortError' || options.signal?.aborted) {
      throw new Error('TIMEOUT');
    }
    throw e;
  }
}
