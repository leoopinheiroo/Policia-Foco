import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl) {
  console.error('[Supabase] CRITICAL: SUPABASE_URL is not defined in environment variables.');
}

// Use service key for backend operations to bypass RLS if needed
// We initialize lazily or provide a dummy if missing to avoid crash at startup
export const supabase = supabaseUrl 
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
  : null as any;
