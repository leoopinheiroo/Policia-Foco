import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para verificar se o Supabase está configurado
  const checkSupabase = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[Middleware] Checking Supabase for ${req.method} ${req.url}`);
    if (!supabase) {
      console.error('[Middleware] Supabase client is NULL');
      return res.status(500).json({ 
        error: 'O banco de dados (Supabase) não está configurado. Verifique as chaves SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no menu Settings.' 
      });
    }
    next();
  };

  // Initialize Stripe lazily to avoid crash if key is missing
  const getStripe = () => {
    let key = '';
    let usedVar = '';

    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim()) {
      key = process.env.STRIPE_SECRET_KEY.trim();
      usedVar = 'STRIPE_SECRET_KEY';
    } else if (process.env.STRIPE_SECRET && process.env.STRIPE_SECRET.trim()) {
      key = process.env.STRIPE_SECRET.trim();
      usedVar = 'STRIPE_SECRET';
    }
    
    // Remove possíveis aspas ou caracteres invisíveis que podem vir da Vercel
    key = key.replace(/['"\s\u200B-\u200D\uFEFF]/g, '');

    const availableKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('STRIPE'));
    console.log(`[Stripe] Usando variável: ${usedVar}. Chaves detectadas:`, availableKeys);

    if (!key) {
      throw new Error(`Nenhuma chave secreta do Stripe encontrada. Verifique se STRIPE_SECRET_KEY está configurada na Vercel. Variáveis detectadas: ${availableKeys.join(', ') || 'nenhuma'}`);
    }
    
    // Stripe keys start with sk_ (secret) or rk_ (restricted)
    if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
      // Se a chave começar com pk_, o usuário inverteu as chaves
      if (key.startsWith('pk_')) {
        throw new Error(`A variável ${usedVar} contém uma CHAVE PÚBLICA (pk_) em vez de uma CHAVE SECRETA (sk_). Inverta as chaves no painel da Vercel.`);
      }
      throw new Error(`A chave na variável ${usedVar} começa com "${key.substring(0, 3)}...", mas deve começar com "sk_" ou "rk_". Verifique se você não copiou a chave errada ou se há espaços/caracteres extras.`);
    }
    
    return new Stripe(key, {
      apiVersion: '2024-06-20' as any,
    });
  };

  app.use(cors());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Server is running', 
      supabase: !!supabase,
      env: process.env.NODE_ENV 
    });
  });
  
  // Stripe Webhook (must be before express.json())
  app.post('/api/webhook', express.raw({ type: 'application/json' }), checkSupabase, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      const stripe = getStripe();
      if (!sig || !endpointSecret) throw new Error('Missing signature or secret');
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching users for webhook:', fetchError);
      return res.status(500).send('Database error');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.customer_details?.email;
        if (email) {
          await supabase
            .from('users')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string
            })
            .eq('email', email);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        if (email) {
          await supabase
            .from('users')
            .update({ subscription_status: 'active' })
            .eq('email', email);
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

  app.use(express.json());

  // Auth Routes
  app.post('/api/auth/register', checkSupabase, async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (existingUser) return res.status(400).json({ error: 'Operador já cadastrado.' });

      const { error: insertError } = await supabase
        .from('users')
        .insert([{ 
          email, 
          password, 
          name, 
          subscription_status: 'pending', 
          created_at: new Date().toISOString(),
          history: { answeredQuestions: {} }
        }]);

      if (insertError) throw insertError;

      res.json({ success: true, email, status: 'pending' });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    }
  });

  app.post('/api/auth/login', checkSupabase, async (req, res) => {
    try {
      const { email: rawEmail, password: rawPassword } = req.body;
      const email = rawEmail?.trim().toLowerCase();
      const password = rawPassword?.trim();

      console.log(`[LOGIN] Tentativa de login para: ${email}`);

      // Privilégio de Desenvolvedor
      const devEmails = ['leonardo.pinheiros@hotmail.com', 'leonardo.pinheiros5366@gmail.com'];
      if (devEmails.includes(email) && password === 'leo5366.Leo') {
        console.log(`[LOGIN] Acesso de desenvolvedor detectado para: ${email}`);
        const { data: devUser, error: fetchDevError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (fetchDevError || !devUser) {
          console.log(`[LOGIN] Criando registro de desenvolvedor para: ${email}`);
          const { error: insertDevError } = await supabase
            .from('users')
            .insert([{
              email,
              password,
              name: 'Leonardo (Dev)',
              subscription_status: 'active',
              created_at: new Date().toISOString(),
              history: { answeredQuestions: {} }
            }]);
          
          if (insertDevError) {
            console.error('[LOGIN] Erro ao criar desenvolvedor:', insertDevError);
            throw insertDevError;
          }
        } else if (devUser.subscription_status !== 'active') {
          // Garante que o desenvolvedor sempre tenha acesso ativo
          await supabase
            .from('users')
            .update({ subscription_status: 'active' })
            .eq('email', email);
        }
        
        return res.json({ success: true, email, status: 'active', name: 'Leonardo (Dev)' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.error('[LOGIN] Erro ao buscar usuário:', error);
        if (error.code === 'PGRST116') {
          return res.status(401).json({ error: 'Operador não encontrado.' });
        }
        throw error;
      }

      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      res.json({ success: true, email: user.email, status: user.subscription_status, name: user.name });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: `Erro no servidor ao logar: ${error.message || 'Erro desconhecido'}` });
    }
  });

  app.post('/api/auth/forgot-password', checkSupabase, async (req, res) => {
    try {
      const { email: rawEmail } = req.body;
      const email = rawEmail?.trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });

      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'Operador não encontrado em nossa base.' });
      }

      console.log(`[AUTH] Link de recuperação solicitado para: ${email}`);
      
      // Simulação de envio de e-mail com detalhes para o log
      const resetToken = Math.random().toString(36).substring(2, 15);
      const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${email}`;
      
      console.log(`[EMAIL SIMULADO] Destinatário: ${email}`);
      console.log(`[EMAIL SIMULADO] Assunto: Recuperação de Senha - GeniusAI`);
      console.log(`[EMAIL SIMULADO] Mensagem: Clique no link para redefinir sua senha: ${resetLink}`);
      
      res.json({ 
        success: true, 
        message: 'Um link de recuperação foi enviado para o seu e-mail. Verifique sua caixa de entrada e spam.' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao processar solicitação.' });
    }
  });

  app.get('/api/user/status', checkSupabase, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });
      
      // Privilégio de Desenvolvedor
      if (email === 'leonardo.pinheiros@hotmail.com') {
        return res.json({ status: 'active' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('subscription_status')
        .eq('email', email)
        .single();
      
      if (!user) {
        return res.json({ status: 'pending' });
      }
      
      res.json({ status: user.subscription_status });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao verificar status.' });
    }
  });

  app.get('/api/user/history', checkSupabase, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });
      
      const { data: user, error } = await supabase
        .from('users')
        .select('history')
        .eq('email', email)
        .single();
      
      if (error || !user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      
      res.json({ history: user.history || { answeredQuestions: {} } });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
  });

  app.post('/api/user/history/save', checkSupabase, async (req, res) => {
    try {
      const { email, questionId, result } = req.body;
      if (!email || !questionId || !result) return res.status(400).json({ error: 'Dados incompletos.' });
      
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('history')
        .eq('email', email)
        .single();
      
      if (fetchError || !user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      
      const history = user.history || { answeredQuestions: {} };
      history.answeredQuestions[questionId] = {
        ...result,
        timestamp: Date.now()
      };
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ history })
        .eq('email', email);

      if (updateError) throw updateError;

      res.json({ success: true });
    } catch (error) {
      console.error('Save history error:', error);
      res.status(500).json({ error: 'Erro ao salvar histórico.' });
    }
  });

  // Simulados History
  app.post('/api/user/simulados/save', checkSupabase, async (req, res) => {
    try {
      const { email, score_percentage, correct_count, total_questions, subjects } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

      const { error } = await supabase
        .from('simulados_history')
        .insert([{
          user_email: email,
          score_percentage,
          correct_count,
          total_questions,
          subjects,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Save simulado error:', error);
      res.status(500).json({ error: 'Erro ao salvar simulado.' });
    }
  });

  app.get('/api/user/simulados/history', checkSupabase, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });

      const { data, error } = await supabase
        .from('simulados_history')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ history: data });
    } catch (error) {
      console.error('Fetch simulados error:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico de simulados.' });
    }
  });

  // Flashcards
  app.post('/api/user/flashcards/save', checkSupabase, async (req, res) => {
    try {
      const { email, materia, assunto, front, back, status } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

      const { error } = await supabase
        .from('user_flashcards')
        .insert([{
          user_email: email,
          materia,
          assunto,
          front,
          back,
          status: status || 'new',
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Save flashcard error:', error);
      res.status(500).json({ error: 'Erro ao salvar flashcard.' });
    }
  });

  app.get('/api/user/flashcards/list', checkSupabase, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });

      const { data, error } = await supabase
        .from('user_flashcards')
        .select('*')
        .eq('user_email', email);

      if (error) throw error;
      res.json({ flashcards: data });
    } catch (error) {
      console.error('Fetch flashcards error:', error);
      res.status(500).json({ error: 'Erro ao buscar flashcards.' });
    }
  });

  // Essays
  app.post('/api/user/essays/save', checkSupabase, async (req, res) => {
    try {
      const { email, theme, content, correction_json, final_score } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

      const { error } = await supabase
        .from('essays_history')
        .insert([{
          user_email: email,
          theme,
          content,
          correction_json,
          final_score,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Save essay error:', error);
      res.status(500).json({ error: 'Erro ao salvar redação.' });
    }
  });

  app.get('/api/user/essays/history', checkSupabase, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });

      const { data, error } = await supabase
        .from('essays_history')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ history: data });
    } catch (error) {
      console.error('Fetch essays error:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico de redações.' });
    }
  });

  app.post('/api/create-checkout-session', checkSupabase, async (req, res) => {
    try {
      const { plan, email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      // Auto-create user if missing (common in serverless)
      if (!user) {
        await supabase
          .from('users')
          .insert([{
            email,
            subscription_status: 'pending',
            created_at: new Date().toISOString(),
            name: 'Operador',
            history: { answeredQuestions: {} }
          }]);
      }

      const stripe = getStripe();
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      
      // Tenta encontrar os IDs dos preços usando várias nomenclaturas comuns
      const prices: Record<string, string> = {
        'MONTHLY': (process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_MONTHLY_PRICE_ID || '').trim(),
        'ANNUAL': (process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_ANNUAL_PRICE_ID || '').trim(),
      };

      const priceId = prices[plan];
      if (!priceId) {
        const availableKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('PRICE'));
        return res.status(400).json({ 
          error: `ID do preço para o plano ${plan} não configurado. Procurei por STRIPE_PRICE_ID_${plan}. Chaves de preço encontradas na Vercel: ${availableKeys.join(', ') || 'nenhuma'}` 
        });
      }

      // Se for Anual e o usuário quiser "Pagamento Único" (sem renovação), usamos 'payment'
      // Se quiser que renove todo ano, mantemos 'subscription'
      const mode = 'subscription'; 

      let session;
      try {
        // Usamos payment_method_types explicitamente para evitar erros de "unknown parameter"
        const sessionConfig: any = {
          customer_email: email,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: mode,
          success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/?status=cancel`,
          metadata: { email, plan },
          payment_method_types: ['card', 'boleto'],
          billing_address_collection: 'required',
        };

        if (mode === 'subscription') {
          sessionConfig.subscription_data = {
            metadata: { email, plan }
          };
        }

        session = await stripe.checkout.sessions.create(sessionConfig);
      } catch (stripeError: any) {
        // Se falhar porque o preço não é recorrente (assinatura), tenta como 'payment' (venda única)
        if (stripeError.message.includes('recurring') || stripeError.message.includes('subscription')) {
          session = await stripe.checkout.sessions.create({
            customer_email: email,
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/?status=cancel`,
            metadata: { email, plan },
            payment_method_types: ['card', 'boleto'],
            billing_address_collection: 'required',
          } as any);
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

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler caught:', err);
    res.status(500).json({ 
      error: 'Erro interno no servidor.',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export const app = await startServer();
export default app;
