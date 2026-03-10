
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
      // Se estivermos na Vercel, a mensagem deve ser diferente
      const isVercel = window.location.hostname.includes('vercel.app');
      const message = isVercel 
        ? 'Supabase não configurado na Vercel. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas "Environment Variables" do seu projeto na Vercel e faça um novo Deploy.'
        : 'Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no menu Settings do AI Studio.';
      
      throw new Error(message);
    }
    return instance[prop];
  }
});
