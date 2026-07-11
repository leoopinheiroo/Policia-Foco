import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  fetchFilteredQuestions,
  fetchSinglePoliceQuestion,
  generateQuestionsForSubject,
  correctEssayWithAi,
  generateFlashcardsBatch,
  mentoriaChat,
  computeXpFromHistory,
} from '../services/geminiServer';

const app = express();

type AuthedRequest = express.Request & {
  supabase: SupabaseClient;
  user: { id: string; email: string };
};

const sanitize = (val: string | undefined) => {
  let cleaned = (val || '').trim().replace(/^['"]|['"]$/g, '');
  return cleaned.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
};

const getSupabaseEnv = () => {
  const url = sanitize(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceKey = sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = sanitize(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  return { url, serviceKey, anonKey, key: serviceKey || anonKey };
};

let supabaseClient: SupabaseClient | null = null;
const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  const { url, key } = getSupabaseEnv();
  if (!url || !key || !url.startsWith('https://')) return null;
  try {
    supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return supabaseClient;
  } catch {
    return null;
  }
};

const checkSupabase = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const supabase = getSupabase();
  if (!supabase) {
    const { url, serviceKey, anonKey } = getSupabaseEnv();
    const missing: string[] = [];
    if (!url) missing.push('SUPABASE_URL');
    if (!serviceKey && !anonKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({
      error: `Supabase não configurado: ${missing.join(', ') || 'erro de inicialização'}.`,
    });
  }
  (req as AuthedRequest).supabase = supabase;
  next();
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const supabase = (req as AuthedRequest).supabase || getSupabase();
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado.' });
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Token ausente.' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    (req as AuthedRequest).supabase = supabase;
    (req as AuthedRequest).user = {
      id: data.user.id,
      email: data.user.email.trim().toLowerCase(),
    };
    next();
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'Falha na autenticação.' });
  }
};

const getStripe = () => {
  let key = (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '').trim();
  key = key.replace(/['"\s\u200B-\u200D\uFEFF]/g, '');
  if (!key) throw new Error('Stripe key missing');
  return new Stripe(key, { apiVersion: '2024-06-20' as any });
};

const defaultHistory = () => ({
  answeredQuestions: {},
  savedQuestions: [] as string[],
  studySessions: [] as any[],
  missionProgress: {} as Record<string, any>,
  streak: 0,
  lastStudyDate: null as string | null,
});

const ensureUserRow = async (
  supabase: SupabaseClient,
  email: string,
  name?: string
) => {
  const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert([{
      email,
      name: name || 'Operador',
      subscription_status: 'pending',
      history: defaultHistory(),
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

const updateStreak = (history: any) => {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = history.lastStudyDate;
  if (lastDate !== today) {
    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      history.streak = lastDate === yesterdayStr ? (history.streak || 0) + 1 : 1;
    } else {
      history.streak = 1;
    }
    history.lastStudyDate = today;
  }
  return history;
};

app.use(cors());

app.get('/api/health', async (_req, res) => {
  const supabase = getSupabase();
  const missingKeys: string[] = [];
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missingKeys.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET) missingKeys.push('STRIPE_SECRET_KEY');
  if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) missingKeys.push('GEMINI_API_KEY');

  let dbStatus = 'not_initialized';
  let dbError: string | null = null;
  if (supabase) {
    try {
      const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      dbStatus = error ? 'error' : 'connected';
      dbError = error?.message || null;
    } catch (e: any) {
      dbStatus = 'exception';
      dbError = e.message;
    }
  }

  res.json({
    status: 'ok',
    supabase: !!supabase,
    database_connectivity: dbStatus,
    database_error: dbError,
    missing_keys: missingKeys,
    env: process.env.NODE_ENV,
  });
});

// Webhook ANTES do express.json() para preservar raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), checkSupabase, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    if (!sig || !endpointSecret) throw new Error('Missing signature or secret');
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = (req as AuthedRequest).supabase;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = (session.customer_email || session.customer_details?.email || '').toLowerCase();
      if (email) {
        await ensureUserRow(supabase, email);
        await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('email', email);
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      let email = (invoice.customer_email || '').toLowerCase();
      if (!email && invoice.customer) {
        try {
          const stripe = getStripe();
          const customer = await stripe.customers.retrieve(invoice.customer as string);
          if (!('deleted' in customer) && customer.email) {
            email = customer.email.toLowerCase();
          }
        } catch (e) {
          console.error('Failed to resolve invoice customer email', e);
        }
      }
      if (email) {
        await supabase.from('users').update({ subscription_status: 'active' }).eq('email', email);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from('users')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', subscription.customer);
      break;
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '2mb' }));

// --- Profile bootstrap (após signup Supabase Auth) ---
app.post('/api/user/ensure-profile', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const name = (req.body?.name as string) || 'Operador';
    const user = await ensureUserRow((req as AuthedRequest).supabase, email, name);
    if (name && name !== 'Operador' && (!user.name || user.name === 'Operador')) {
      await (req as AuthedRequest).supabase.from('users').update({ name }).eq('email', email);
      user.name = name;
    }
    res.json({ success: true, email: user.email, name: user.name, status: user.subscription_status });
  } catch (error: any) {
    console.error('ensure-profile error:', error);
    res.status(500).json({ error: error.message || 'Erro ao garantir perfil.' });
  }
});

app.get('/api/user/status', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const user = await ensureUserRow((req as AuthedRequest).supabase, email);
    res.json({ status: user.subscription_status || 'pending', name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status.' });
  }
});

app.get('/api/user/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const user = await ensureUserRow((req as AuthedRequest).supabase, email);
    res.json({ history: user.history || defaultHistory() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

app.post('/api/user/history/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { questionId, result, missionProgress } = req.body;

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    if (!history.answeredQuestions) history.answeredQuestions = {};
    if (!history.studySessions) history.studySessions = [];
    if (!history.savedQuestions) history.savedQuestions = [];
    if (!history.missionProgress) history.missionProgress = {};

    if (questionId && result) {
      history.answeredQuestions[questionId] = { ...result, timestamp: Date.now() };
      updateStreak(history);
    }

    if (missionProgress && typeof missionProgress === 'object') {
      history.missionProgress = { ...history.missionProgress, ...missionProgress };
    }

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true, history });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ error: 'Erro ao salvar histórico.' });
  }
});

app.post('/api/user/dossier/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { questionId, remove } = req.body;
    if (!questionId) return res.status(400).json({ error: 'questionId obrigatório.' });

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    const saved: string[] = Array.isArray(history.savedQuestions) ? [...history.savedQuestions] : [];

    if (remove) {
      history.savedQuestions = saved.filter(id => id !== questionId);
    } else if (!saved.includes(questionId)) {
      history.savedQuestions = [...saved, questionId];
    } else {
      history.savedQuestions = saved;
    }

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true, savedQuestions: history.savedQuestions });
  } catch (error) {
    console.error('Dossier save error:', error);
    res.status(500).json({ error: 'Erro ao salvar no dossiê.' });
  }
});

app.post('/api/user/study/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { duration, type } = req.body;
    if (duration === undefined) return res.status(400).json({ error: 'Dados incompletos.' });

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    if (!history.studySessions) history.studySessions = [];

    const now = Date.now();
    history.studySessions.push({
      startTime: now - duration * 1000,
      duration,
      type: type || 'TIMER',
      timestamp: now,
    });
    updateStreak(history);

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Save study session error:', error);
    res.status(500).json({ error: 'Erro ao salvar sessão de estudo.' });
  }
});

app.post('/api/user/simulados/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { score_percentage, correct_count, total_questions, subjects } = req.body;
    const { error } = await (req as AuthedRequest).supabase.from('simulados_history').insert([{
      user_email: email,
      score_percentage,
      correct_count,
      total_questions,
      subjects,
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Save simulado error:', error);
    res.status(500).json({ error: 'Erro ao salvar simulado.' });
  }
});

app.get('/api/user/simulados/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await (req as AuthedRequest).supabase
      .from('simulados_history')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de simulados.' });
  }
});

app.post('/api/user/flashcards/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { materia, assunto, front, back, status } = req.body;
    const { error } = await (req as AuthedRequest).supabase.from('user_flashcards').insert([{
      user_email: email,
      materia,
      assunto,
      front,
      back,
      status: status || 'new',
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar flashcard.' });
  }
});

app.get('/api/user/flashcards/list', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await (req as AuthedRequest).supabase
      .from('user_flashcards')
      .select('*')
      .eq('user_email', email);
    if (error) throw error;
    res.json({ flashcards: data });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar flashcards.' });
  }
});

app.post('/api/user/essays/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { theme, content, correction_json, final_score } = req.body;
    const { error } = await (req as AuthedRequest).supabase.from('essays_history').insert([{
      user_email: email,
      theme,
      content,
      correction_json,
      final_score,
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar redação.' });
  }
});

app.get('/api/user/essays/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await (req as AuthedRequest).supabase
      .from('essays_history')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de redações.' });
  }
});

app.get('/api/user/ranking', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data: users, error } = await (req as AuthedRequest).supabase
      .from('users')
      .select('email, name, history')
      .limit(200);
    if (error) throw error;

    const ranking = (users || [])
      .map((u: any) => {
        const { xp, level } = computeXpFromHistory(u.history || {});
        return {
          name: u.name || u.email?.split('@')[0] || 'Operador',
          email: u.email,
          xp,
          level,
          avatar: u.email === email ? '👤' : '👮',
          isCurrentUser: u.email === email,
        };
      })
      .sort((a: any, b: any) => b.xp - a.xp)
      .slice(0, 50);

    const myIndex = ranking.findIndex((r: any) => r.isCurrentUser);
    res.json({ ranking, myPosition: myIndex >= 0 ? myIndex + 1 : null });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Erro ao carregar ranking.' });
  }
});

app.post('/api/create-checkout-session', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { plan } = req.body;
    await ensureUserRow(supabase, email);

    const stripe = getStripe();
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const prices: Record<string, string> = {
      MONTHLY: (process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_MONTHLY_PRICE_ID || '').trim(),
      ANNUAL: (process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_ANNUAL_PRICE_ID || '').trim(),
    };

    const priceId = prices[plan];
    if (!priceId) {
      return res.status(400).json({
        error: `ID do preço para o plano ${plan} não configurado.`,
      });
    }

    const sessionConfig: any = {
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?status=cancel`,
      metadata: { email, plan },
      payment_method_types: ['card', 'boleto'],
      billing_address_collection: 'required',
      subscription_data: { metadata: { email, plan } },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (stripeError: any) {
      if (stripeError.message?.includes('recurring') || stripeError.message?.includes('subscription')) {
        session = await stripe.checkout.sessions.create({
          ...sessionConfig,
          mode: 'payment',
          subscription_data: undefined,
        });
      } else {
        throw stripeError;
      }
    }
    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Session Error:', error);
    res.status(500).json({ error: `Erro no Stripe: ${error.message}` });
  }
});

// --- AI proxies (authenticated) ---
app.post('/api/ai/questions', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { filters = {}, count = 10 } = req.body;
    const user = await ensureUserRow((req as AuthedRequest).supabase, (req as AuthedRequest).user.email);
    const questions = await fetchFilteredQuestions(filters, count, user.history);
    res.json({ questions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao gerar questões.' });
  }
});

app.post('/api/ai/question', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, topic } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject e topic obrigatórios.' });
    const question = await fetchSinglePoliceQuestion(subject, topic);
    res.json({ question });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao gerar questão.' });
  }
});

app.post('/api/ai/simulado', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, count = 10 } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject obrigatório.' });
    const questions = await generateQuestionsForSubject(subject, count);
    res.json({ questions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao gerar simulado.' });
  }
});

app.post('/api/ai/essay', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { essay, theme } = req.body;
    if (!essay || !theme) return res.status(400).json({ error: 'essay e theme obrigatórios.' });
    const feedback = await correctEssayWithAi(essay, theme);
    res.json({ feedback });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao corrigir redação.' });
  }
});

app.post('/api/ai/flashcards', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, count = 10 } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject obrigatório.' });
    const flashcards = await generateFlashcardsBatch(subject, count);
    res.json({ flashcards });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao gerar flashcards.' });
  }
});

app.post('/api/ai/mentoria', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { messages = [], userMessage } = req.body;
    if (!userMessage) return res.status(400).json({ error: 'userMessage obrigatório.' });
    const text = await mentoriaChat(messages, userMessage);
    res.json({ text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro na mentoria.' });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ error: 'Erro interno no servidor.', message: err.message });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.url}` });
});

export default app;
