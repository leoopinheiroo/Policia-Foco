
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
    try {
      const instance = getSupabase();
      if (!instance) {
        // Mock minimalista para evitar crash em tempo de renderização
        if (prop === 'auth') {
          return {
            onAuthStateChanged: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ data: {}, error: new Error('Supabase não configurado') }),
            signUp: async () => ({ data: {}, error: new Error('Supabase não configurado') }),
            resetPasswordForEmail: async () => ({ error: new Error('Supabase não configurado') }),
            signOut: async () => ({ error: null })
          };
        }
        if (prop === 'from') return () => ({ select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }), order: () => ({ limit: () => ({ data: [], error: null }) }) }) });
        
        return null;
      }
      return instance[prop];
    } catch (e) {
      console.warn('Supabase Proxy Error:', e);
      return null;
    }
  }
});
