-- SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
-- Copie e cole este script no "SQL Editor" do seu painel do Supabase e clique em "Run".

-- 1. Criar a tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    subscription_status TEXT DEFAULT 'pending',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    history JSONB DEFAULT '{"answeredQuestions": {}}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar a tabela de histórico de simulados
CREATE TABLE IF NOT EXISTS simulados_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email),
    score_percentage NUMERIC,
    correct_count INTEGER,
    total_questions INTEGER,
    subjects JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar a tabela de flashcards do usuário
CREATE TABLE IF NOT EXISTS user_flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email),
    materia TEXT,
    assunto TEXT,
    front TEXT,
    back TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criar a tabela de histórico de redações
CREATE TABLE IF NOT EXISTS essays_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT REFERENCES users(email),
    theme TEXT,
    content TEXT,
    correction_json JSONB,
    final_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Configurar permissões básicas (Opcional, dependendo da sua política de RLS)
-- Por padrão, como estamos usando a service_role key no backend, o RLS pode ser ignorado.
-- Se você quiser ativar RLS, precisará de políticas específicas.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulados_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE essays_history ENABLE ROW LEVEL SECURITY;

-- Exemplo de política: Permitir que o backend (service_role) faça tudo
-- (Geralmente a service_role já ignora RLS, então isso é apenas para referência)
