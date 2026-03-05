import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Usamos process.cwd() para garantir que o caminho seja a raiz do projeto na Vercel
const USERS_FILE = path.join(process.cwd(), 'users.json');

// Helper to manage mock database
let memoryUsers: any = null;

const getUsers = () => {
  if (memoryUsers) return memoryUsers;
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return {};
    }
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    memoryUsers = content ? JSON.parse(content) : {};
    return memoryUsers;
  } catch (e) {
    console.error('Error reading users file, using memory:', e);
    return memoryUsers || {};
  }
};

const saveUsers = (users: any) => {
  memoryUsers = users;
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    console.warn('Could not save to disk (normal on Vercel), keeping in memory.');
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: 'ok', message: 'Server is running', env: process.env.NODE_ENV });
  });
  
  // Stripe Webhook (must be before express.json())
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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

    const users = getUsers();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.customer_details?.email;
        if (email && users[email]) {
          users[email].subscription_status = 'active';
          users[email].stripe_customer_id = session.customer as string;
          users[email].stripe_subscription_id = session.subscription as string;
          saveUsers(users);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        if (email && users[email]) {
          users[email].subscription_status = 'active';
          saveUsers(users);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const email = Object.keys(users).find(key => users[key].stripe_customer_id === subscription.customer);
        if (email) {
          users[email].subscription_status = 'canceled';
          saveUsers(users);
        }
        break;
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Auth Routes
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

      const users = getUsers();
      if (users[email]) return res.status(400).json({ error: 'Operador já cadastrado.' });

      users[email] = { email, password, name, subscription_status: 'pending', created_at: new Date().toISOString() };
      saveUsers(users);
      res.json({ success: true, email, status: 'pending' });
    } catch (error) {
      res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email: rawEmail, password: rawPassword } = req.body;
      const email = rawEmail?.trim().toLowerCase();
      const password = rawPassword?.trim();
      const users = getUsers();

      // Privilégio de Desenvolvedor
      if (email === 'leonardo.pinheiros@hotmail.com' && password === 'leo5366.Leo') {
        if (!users[email]) {
          users[email] = {
            email,
            password,
            name: 'Leonardo (Dev)',
            subscription_status: 'active',
            created_at: new Date().toISOString()
          };
          saveUsers(users);
        }
        return res.json({ success: true, email, status: 'active', name: 'Leonardo (Dev)' });
      }

      const user = users[email];
      if (!user || user.password !== password) return res.status(401).json({ error: 'Credenciais inválidas.' });

      res.json({ success: true, email: user.email, status: user.subscription_status, name: user.name });
    } catch (error) {
      res.status(500).json({ error: 'Erro no servidor ao logar.' });
    }
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const { email: rawEmail } = req.body;
      const email = rawEmail?.trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });

      const users = getUsers();
      if (!users[email]) {
        // Por segurança, não confirmamos se o email existe ou não, mas aqui como é demo vamos validar
        return res.status(404).json({ error: 'Operador não encontrado em nossa base.' });
      }

      console.log(`[AUTH] Link de recuperação solicitado para: ${email}`);
      // Aqui integraria com SendGrid/Nodemailer
      
      res.json({ success: true, message: 'Link enviado.' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao processar solicitação.' });
    }
  });

  app.get('/api/user/status', (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });
      
      // Privilégio de Desenvolvedor
      if (email === 'leonardo.pinheiros@hotmail.com') {
        return res.json({ status: 'active' });
      }

      const users = getUsers();
      const user = users[email];
      
      if (!user) {
        return res.json({ status: 'pending' });
      }
      
      res.json({ status: user.subscription_status });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao verificar status.' });
    }
  });

  app.get('/api/user/history', (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });
      
      const users = getUsers();
      const user = users[email];
      
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      
      res.json({ history: user.history || { answeredQuestions: {} } });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
  });

  app.post('/api/user/history/save', (req, res) => {
    try {
      const { email, questionId, result } = req.body;
      if (!email || !questionId || !result) return res.status(400).json({ error: 'Dados incompletos.' });
      
      const users = getUsers();
      const user = users[email];
      
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      
      if (!user.history) user.history = { answeredQuestions: {} };
      
      user.history.answeredQuestions[questionId] = {
        ...result,
        timestamp: Date.now()
      };
      
      saveUsers(users);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar histórico.' });
    }
  });

  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { plan, email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      
      const users = getUsers();
      
      // Auto-create user if missing (common in serverless)
      if (!users[email]) {
        users[email] = {
          email,
          subscription_status: 'pending',
          created_at: new Date().toISOString(),
          name: 'Operador'
        };
        saveUsers(users);
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
