import express from 'express';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'users.json');

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
    // On Vercel, this will fail. We log it but don't crash.
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
    res.json({ status: 'ok', message: 'Server is running' });
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

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.customer_details?.email;
        if (email && users[email]) {
          users[email].subscription_status = 'active';
          users[email].stripe_customer_id = session.customer as string;
          users[email].stripe_subscription_id = session.subscription as string;
          saveUsers(users);
          console.log(`User ${email} is now active.`);
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
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        if (email && users[email]) {
          users[email].subscription_status = 'unpaid';
          saveUsers(users);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // Find user by stripe_customer_id
        const email = Object.keys(users).find(key => users[key].stripe_customer_id === subscription.customer);
        if (email) {
          users[email].subscription_status = 'canceled';
          saveUsers(users);
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Middleware to protect API routes
  const protectRoute = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const email = req.headers['x-user-email'] as string;
    if (!email) return res.status(401).json({ error: 'Não autenticado.' });

    const users = getUsers();
    const user = users[email];

    if (!user || user.subscription_status !== 'active') {
      return res.status(403).json({ error: 'Assinatura inativa. Pagamento necessário.' });
    }

    next();
  };

  // Auth Routes
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      }

      const users = getUsers();
      if (users[email]) {
        return res.status(400).json({ error: 'Operador já cadastrado no sistema.' });
      }

      users[email] = {
        email,
        password,
        name,
        subscription_status: 'pending',
        created_at: new Date().toISOString()
      };

      saveUsers(users);
      res.json({ success: true, email, status: 'pending' });
    } catch (error: any) {
      console.error('Register Error:', error);
      res.status(500).json({ error: 'Erro interno ao processar alistamento.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const users = getUsers();

      const user = users[email];
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'ACESSO NEGADO. Credenciais inválidas.' });
      }

      res.json({ 
        success: true, 
        email: user.email, 
        status: user.subscription_status,
        name: user.name
      });
    } catch (error: any) {
      console.error('Login Error:', error);
      res.status(500).json({ error: 'Erro interno ao processar login.' });
    }
  });

  app.get('/api/user/status', (req, res) => {
    const email = req.query.email as string;
    const users = getUsers();
    const user = users[email];

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ status: user.subscription_status });
  });

  // API Routes
  app.post('/api/create-checkout-session', async (req, res) => {
    const { plan, email } = req.body;
    
    // Basic validation
    if (!email) return res.status(400).json({ error: 'Email é obrigatório.' });
    
    const users = getUsers();
    if (!users[email]) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const prices: Record<string, string> = {
      'MONTHLY': process.env.STRIPE_PRICE_ID_MONTHLY || '',
      'ANNUAL': process.env.STRIPE_PRICE_ID_ANNUAL || '',
    };

    try {
      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [{ price: prices[plan], quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?status=cancel`,
        metadata: { email }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Catch-all for undefined API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rota API não encontrada: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Only start listening if not in a serverless environment
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  console.log('Backend initialized successfully.');
  return app;
}

export const app = await startServer();
export default app;
