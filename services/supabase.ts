
import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    // Retornamos um objeto mockado ou lançamos erro apenas quando tentarem usar
    // Para evitar que o app quebre no carregamento do módulo
    console.warn('Supabase URL ou Anon Key não configurados no menu Settings.');
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
