
import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  // Tenta buscar de várias formas possíveis no ambiente do AI Studio
  const env = (import.meta as any).env || {};
  
  const sanitize = (val: any) => {
    if (typeof val !== 'string') return '';
    let cleaned = val.trim().replace(/^['"]|['"]$/g, '');
    cleaned = cleaned.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    if (cleaned === 'undefined' || cleaned === 'null') return '';
    return cleaned;
  };

  const supabaseUrl = sanitize(env.VITE_SUPABASE_URL);
  const supabaseAnonKey = sanitize(env.VITE_SUPABASE_ANON_KEY);

  console.log('[Supabase] Cliente frontend inicializado com anon key.');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('https://')) {
    return null;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    return supabaseInstance;
  } catch (e) {
    console.error('[Supabase] Erro ao criar cliente:', e);
    return null;
  }
};

// Proxy para manter a compatibilidade com o código existente que importa 'supabase' diretamente
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    try {
      if (prop === '_isMock') {
        return !getSupabase();
      }
      const instance = getSupabase();
      if (!instance) {
        // Mock minimalista para evitar crash em tempo de renderização
        if (prop === 'auth') {
          return {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            onAuthStateChanged: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ data: {}, error: new Error('Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no menu Settings.') }),
            signUp: async () => ({ data: {}, error: new Error('Supabase não configurado') }),
            resetPasswordForEmail: async () => ({ error: new Error('Supabase não configurado') }),
            signOut: async () => ({ error: null }),
            getSession: async () => ({ data: { session: null }, error: null }),
            getUser: async () => ({ data: { user: null }, error: null })
          };
        }
        if (prop === 'from') return () => ({ 
          select: () => ({ 
            eq: () => ({ single: () => ({ data: null, error: null }), order: () => ({ limit: () => ({ data: [], error: null }) }) }), 
            order: () => ({ limit: () => ({ data: [], error: null }) }) 
          }),
          insert: () => ({ data: null, error: new Error('Supabase não configurado') }),
          update: () => ({ eq: () => ({ data: null, error: new Error('Supabase não configurado') }) }),
          delete: () => ({ eq: () => ({ data: null, error: new Error('Supabase não configurado') }) })
        });
        
        return null;
      }
      
      const value = instance[prop];
      if (typeof value === 'function') {
        return (...args: any[]) => value.apply(instance, args);
      }
      return value;
    } catch (e) {
      console.warn('Supabase Proxy Error:', e);
      return null;
    }
  }
});
