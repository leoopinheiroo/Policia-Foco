import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service key for backend operations to bypass RLS if needed
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
