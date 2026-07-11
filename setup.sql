-- SCRIPT DE CONFIGURAÇÃO / MIGRAÇÃO DO BANCO (SUPABASE)
-- Alinhado ao schema real do projeto (PK = email).

-- 1. Tabela de usuários (Auth via Supabase Auth; sem senha local obrigatória)
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password TEXT,
    name TEXT,
    subscription_status TEXT DEFAULT 'pending',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    history JSONB DEFAULT '{"answeredQuestions": {}, "savedQuestions": [], "studySessions": [], "missionProgress": {}}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
UPDATE users SET subscription_status = 'pending' WHERE subscription_status = 'inactive' OR subscription_status IS NULL;
ALTER TABLE users ALTER COLUMN history SET DEFAULT '{"answeredQuestions": {}, "savedQuestions": [], "studySessions": [], "missionProgress": {}}'::jsonb;
UPDATE users SET history = COALESCE(history, '{"answeredQuestions": {}, "savedQuestions": [], "studySessions": [], "missionProgress": {}}'::jsonb);

CREATE TABLE IF NOT EXISTS simulados_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email) ON DELETE CASCADE,
    score_percentage NUMERIC,
    correct_count INTEGER,
    total_questions INTEGER,
    subjects TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email) ON DELETE CASCADE,
    materia TEXT,
    assunto TEXT,
    front TEXT,
    back TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS essays_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email) ON DELETE CASCADE,
    theme TEXT,
    content TEXT,
    correction_json JSONB,
    final_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulados_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE essays_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "simulados_select_own" ON simulados_history;
DROP POLICY IF EXISTS "simulados_insert_own" ON simulados_history;
DROP POLICY IF EXISTS "flashcards_select_own" ON user_flashcards;
DROP POLICY IF EXISTS "flashcards_insert_own" ON user_flashcards;
DROP POLICY IF EXISTS "flashcards_update_own" ON user_flashcards;
DROP POLICY IF EXISTS "flashcards_delete_own" ON user_flashcards;
DROP POLICY IF EXISTS "essays_select_own" ON essays_history;
DROP POLICY IF EXISTS "essays_insert_own" ON essays_history;

CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'email') = email);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING ((auth.jwt()->>'email') = email)
  WITH CHECK ((auth.jwt()->>'email') = email);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->>'email') = email);

CREATE POLICY "simulados_select_own" ON simulados_history
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'email') = user_email);

CREATE POLICY "simulados_insert_own" ON simulados_history
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->>'email') = user_email);

CREATE POLICY "flashcards_select_own" ON user_flashcards
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'email') = user_email);

CREATE POLICY "flashcards_insert_own" ON user_flashcards
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->>'email') = user_email);

CREATE POLICY "flashcards_update_own" ON user_flashcards
  FOR UPDATE TO authenticated
  USING ((auth.jwt()->>'email') = user_email)
  WITH CHECK ((auth.jwt()->>'email') = user_email);

CREATE POLICY "flashcards_delete_own" ON user_flashcards
  FOR DELETE TO authenticated
  USING ((auth.jwt()->>'email') = user_email);

CREATE POLICY "essays_select_own" ON essays_history
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'email') = user_email);

CREATE POLICY "essays_insert_own" ON essays_history
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->>'email') = user_email);
