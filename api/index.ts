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

  // Initialize Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia' as any,
  });

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
      const { email, password } = req.body;
      const users = getUsers();
      const user = users[email];
      if (!user || user.password !== password) return res.status(401).json({ error: 'Credenciais inválidas.' });

      res.json({ success: true, email: user.email, status: user.subscription_status, name: user.name });
    } catch (error) {
      res.status(500).json({ error: 'Erro no servidor ao logar.' });
    }
  });

  app.get('/api/user/status', (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'Email não fornecido.' });
      
      const users = getUsers();
      const user = users[email];
      
      if (!user) {
        // Para o demo na Vercel, se o usuário não existe no cache, retornamos pendente
        return res.json({ status: 'pending' });
      }
      
      res.json({ status: user.subscription_status });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao verificar status.' });
    }
  });

  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { plan, email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      
      const users = getUsers();
      
      // Se o usuário não existe (comum em serverless/Vercel sem DB real), criamos um registro temporário
      if (!users[email]) {
        console.log(`Usuário ${email} não encontrado no cache, criando registro temporário para checkout.`);
        users[email] = {
          email,
          subscription_status: 'pending',
          created_at: new Date().toISOString(),
          name: 'Operador'
        };
        saveUsers(users);
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Configuração incompleta: STRIPE_SECRET_KEY não encontrada no servidor.' });
      }

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const prices: Record<string, string> = {
        'MONTHLY': process.env.STRIPE_PRICE_ID_MONTHLY || '',
        'ANNUAL': process.env.STRIPE_PRICE_ID_ANNUAL || '',
      };

      const priceId = prices[plan];
      if (!priceId) {
        return res.status(400).json({ error: `ID do preço para o plano ${plan} não configurado (STRIPE_PRICE_ID_${plan}).` });
      }

      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?status=cancel`,
        metadata: { email }
      });
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
    // Em produção na Vercel, servimos os arquivos estáticos da pasta dist
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
