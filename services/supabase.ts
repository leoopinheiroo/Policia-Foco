
import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  // Tenta buscar de várias formas possíveis no ambiente do AI Studio
  const env = (import.meta as any).env || {};
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

  console.log('[Supabase Debug] Verificando chaves no frontend...');
  console.log('[Supabase Debug] URL encontrada:', supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'NÃO ENCONTRADA');
  console.log('[Supabase Debug] Key encontrada:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'NÃO ENCONTRADA');

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// Proxy para manter a compatibilidade com o código existente que importa 'supabase' diretamente
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const instance = getSupabase();
    if (!instance) {
      // Se alguém tentar acessar uma propriedade (como supabase.auth), lançamos um erro amigável
      throw new Error('Supabase não configurado. Por favor, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no menu Settings do AI Studio.');
    }
    return instance[prop];
  }
});
