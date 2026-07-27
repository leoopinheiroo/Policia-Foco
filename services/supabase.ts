import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

const isPlaceholderValue = (url: string, key: string) => {
  const u = (url || '').toLowerCase();
  const k = (key || '').toLowerCase();
  return (
    !u ||
    !k ||
    u.includes('your-project-id') ||
    u.includes('your-supabase-url') ||
    u.includes('placeholder') ||
    u.includes('example.com') ||
    k.includes('your-anon-key') ||
    k.includes('placeholder') ||
    !k.includes('.') // Deve ser uma chave JWT
  );
};

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const sanitize = (val: any) => {
    if (typeof val !== 'string') return '';
    let cleaned = val.trim().replace(/^['"]|['"]$/g, '');
    cleaned = cleaned.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    if (cleaned === 'undefined' || cleaned === 'null') return '';
    return cleaned;
  };

  // 1. Tenta carregar do cache persistente do cliente primeiro (evita problemas de build estático do Vite)
  let supabaseUrl = sanitize(localStorage.getItem('PF_SUPABASE_URL'));
  let supabaseAnonKey = sanitize(localStorage.getItem('PF_SUPABASE_ANON_KEY'));

  // 2. Fallback para variáveis de compilação
  if (!supabaseUrl || !supabaseAnonKey) {
    const env = (import.meta as any).env || {};
    supabaseUrl = sanitize(env.VITE_SUPABASE_URL);
    supabaseAnonKey = sanitize(env.VITE_SUPABASE_ANON_KEY);
  }

  console.log('[Supabase Debug] Verificando chaves no frontend...');
  console.log('[Supabase Debug] URL encontrada:', supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'NÃO ENCONTRADA');
  console.log('[Supabase Debug] Key encontrada:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'NÃO ENCONTRADA');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('https://') || isPlaceholderValue(supabaseUrl, supabaseAnonKey)) {
    console.log('[Supabase] Configuração real ausente/inválida ou incompleta no momento. Usando Sandbox Local.');
    return null;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  } catch (e) {
    console.error('[Supabase] Erro ao instanciar cliente real. Usando Sandbox Local.', e);
    return null;
  }
};

// Carregamento dinâmico e silencioso em background para auto-configurar o frontend a partir do backend
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then(res => {
      if (!res.ok) throw new Error('Not OK');
      return res.json();
    })
    .then(data => {
      if (data && data.supabaseUrl && data.supabaseAnonKey) {
        const prevUrl = localStorage.getItem('PF_SUPABASE_URL') || '';
        const prevKey = localStorage.getItem('PF_SUPABASE_ANON_KEY') || '';
        const nextUrl = data.supabaseUrl.trim();
        const nextKey = data.supabaseAnonKey.trim();

        if (nextKey.includes('.') && (nextUrl !== prevUrl || nextKey !== prevKey)) {
          console.log('[Supabase Config] Auto-configuração do Supabase carregada do servidor. Atualizando...');
          localStorage.setItem('PF_SUPABASE_URL', nextUrl);
          localStorage.setItem('PF_SUPABASE_ANON_KEY', nextKey);
          
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      }
    })
    .catch(err => {
      console.warn('[Supabase Config] Não foi possível sincronizar configuração do servidor:', err);
    });
}

// --- MOCK / SANDBOX SYSTEM FOR FRONTEND ---
const authCallbacks: any[] = [];

const triggerAuthChange = (event: string, session: any) => {
  authCallbacks.forEach(cb => {
    try {
      cb(event, session);
    } catch (e) {
      console.error('[Mock Auth] Callback error:', e);
    }
  });
};

const mockAuth = {
  onAuthStateChange: (callback: any) => {
    authCallbacks.push(callback);
    const session = mockAuth.getSavedSession();
    // Execute callback with current session on next tick
    setTimeout(() => {
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    }, 0);
    return { 
      data: { 
        subscription: { 
          unsubscribe: () => {
            const idx = authCallbacks.indexOf(callback);
            if (idx !== -1) authCallbacks.splice(idx, 1);
          } 
        } 
      } 
    };
  },
  onAuthStateChanged: (callback: any) => {
    return mockAuth.onAuthStateChange(callback);
  },
  getSavedSession: () => {
    try {
      const sess = localStorage.getItem('sb_mock_session');
      return sess ? JSON.parse(sess) : null;
    } catch (e) {
      return null;
    }
  },
  signInWithPassword: async ({ email, password }: any) => {
    try {
      const cleanedEmail = email.trim().toLowerCase();
      const devEmails = ['leonardo.pinheiros@hotmail.com', 'leonardo.pinheiros5366@gmail.com'];
      
      const usersStr = localStorage.getItem('sb_mock_users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      let user = users.find((u: any) => u.email === cleanedEmail);

      if (!user) {
        // Auto-register developer or default sandbox accounts for premium demo experience
        const newUser = {
          id: 'mock-uid-' + Math.random().toString(36).substring(2, 11),
          email: cleanedEmail,
          password: password,
          name: devEmails.includes(cleanedEmail) ? 'Leonardo (Dev)' : 'Operador Demonstrativo',
          created_at: new Date().toISOString(),
          history: { answeredQuestions: {} }
        };
        users.push(newUser);
        localStorage.setItem('sb_mock_users', JSON.stringify(users));
        user = newUser;
      } else if (user.password !== password && !devEmails.includes(cleanedEmail)) {
        return { 
          data: { session: null, user: null }, 
          error: { message: 'Senha incorreta para esta conta de demonstração.' } 
        };
      }

      const session = {
        access_token: 'mock-jwt-token',
        user: { 
          id: user.id, 
          email: user.email, 
          user_metadata: { full_name: user.name } 
        }
      };
      localStorage.setItem('sb_mock_session', JSON.stringify(session));
      localStorage.setItem('PF_USER_EMAIL', user.email);
      triggerAuthChange('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: e };
    }
  },
  signUp: async ({ email, password, options }: any) => {
    try {
      const cleanedEmail = email.trim().toLowerCase();
      const devEmails = ['leonardo.pinheiros@hotmail.com', 'leonardo.pinheiros5366@gmail.com'];
      const usersStr = localStorage.getItem('sb_mock_users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      
      if (users.some((u: any) => u.email === cleanedEmail)) {
        if (devEmails.includes(cleanedEmail)) {
          let existing = users.find((u: any) => u.email === cleanedEmail);
          existing.password = password;
          if (options?.data?.full_name) existing.name = options.data.full_name;
          localStorage.setItem('sb_mock_users', JSON.stringify(users));
          
          const session = {
            access_token: 'mock-jwt-token',
            user: { 
              id: existing.id, 
              email: existing.email, 
              user_metadata: { full_name: existing.name } 
            }
          };
          localStorage.setItem('sb_mock_session', JSON.stringify(session));
          localStorage.setItem('PF_USER_EMAIL', existing.email);
          triggerAuthChange('SIGNED_IN', session);
          return { data: { session, user: session.user }, error: null };
        }

        return { 
          data: { session: null, user: null }, 
          error: { message: 'ESTE E-MAIL JÁ ESTÁ CADASTRADO. FAÇA LOGIN OU RECUPERE SUA SENHA.' } 
        };
      }

      const newUser = {
        id: 'mock-uid-' + Math.random().toString(36).substring(2, 11),
        email: cleanedEmail,
        password: password,
        name: options?.data?.full_name || 'Operador Demonstrativo',
        created_at: new Date().toISOString(),
        history: { answeredQuestions: {} }
      };

      users.push(newUser);
      localStorage.setItem('sb_mock_users', JSON.stringify(users));

      const session = {
        access_token: 'mock-jwt-token',
        user: { 
          id: newUser.id, 
          email: newUser.email, 
          user_metadata: { full_name: newUser.name } 
        }
      };
      localStorage.setItem('sb_mock_session', JSON.stringify(session));
      localStorage.setItem('PF_USER_EMAIL', newUser.email);
      triggerAuthChange('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: e };
    }
  },
  resetPasswordForEmail: async (email: string) => {
    return { error: null };
  },
  signOut: async () => {
    localStorage.removeItem('sb_mock_session');
    triggerAuthChange('SIGNED_OUT', null);
    return { error: null };
  },
  getSession: async () => {
    const session = mockAuth.getSavedSession();
    return { data: { session }, error: null };
  },
  getUser: async () => {
    const session = mockAuth.getSavedSession();
    return { data: { user: session ? session.user : null }, error: null };
  }
};

const mockFrom = (table: string) => {
  return {
    select: (fields: string = '*') => {
      const resultObj = {
        eq: (col: string, val: any) => {
          return {
            single: async () => {
              try {
                if (table === 'users') {
                  const usersStr = localStorage.getItem('sb_mock_users');
                  const users = usersStr ? JSON.parse(usersStr) : [];
                  const user = users.find((u: any) => u[col] === val);
                  if (user) {
                    return { data: user, error: null };
                  }
                }
                return { data: null, error: { message: 'Registro não encontrado.' } };
              } catch (e: any) {
                return { data: null, error: e };
              }
            },
            order: (col2: string, opts?: any) => {
              return {
                limit: async (lim: number) => {
                  return { data: [], error: null };
                }
              };
            }
          };
        },
        order: (col: string, opts?: any) => {
          return {
            limit: async (lim: number) => {
              return { data: [], error: null };
            }
          };
        },
        then: (resolve: any) => {
          if (table === 'users') {
            const usersStr = localStorage.getItem('sb_mock_users');
            const users = usersStr ? JSON.parse(usersStr) : [];
            resolve({ data: users, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        }
      };
      return resultObj;
    },
    insert: (records: any[]) => {
      try {
        if (table === 'users') {
          const usersStr = localStorage.getItem('sb_mock_users');
          const users = usersStr ? JSON.parse(usersStr) : [];
          records.forEach((rec: any) => {
            const existingIdx = users.findIndex((u: any) => u.email === rec.email);
            if (existingIdx !== -1) {
              users[existingIdx] = { ...users[existingIdx], ...rec };
            } else {
              users.push({ id: 'mock-uid-' + Math.random().toString(36).substring(2, 11), ...rec });
            }
          });
          localStorage.setItem('sb_mock_users', JSON.stringify(users));
        }
        const res = { data: records, error: null };
        return {
          ...res,
          then: (resolve: any) => resolve(res)
        };
      } catch (e: any) {
        const res = { data: null, error: e };
        return {
          ...res,
          then: (resolve: any) => resolve(res)
        };
      }
    },
    update: (fields: any) => {
      return {
        eq: (col: string, val: any) => {
          try {
            if (table === 'users') {
              const usersStr = localStorage.getItem('sb_mock_users');
              const users = usersStr ? JSON.parse(usersStr) : [];
              const userIdx = users.findIndex((u: any) => u[col] === val);
              if (userIdx !== -1) {
                users[userIdx] = { ...users[userIdx], ...fields };
                localStorage.setItem('sb_mock_users', JSON.stringify(users));
                const res = { data: users[userIdx], error: null };
                return {
                  ...res,
                  then: (resolve: any) => resolve(res)
                };
              }
            }
            const res = { data: null, error: { message: 'Registro não encontrado para atualização.' } };
            return {
              ...res,
              then: (resolve: any) => resolve(res)
            };
          } catch (e: any) {
            const res = { data: null, error: e };
            return {
              ...res,
              then: (resolve: any) => resolve(res)
            };
          }
        }
      };
    },
    delete: () => {
      return {
        eq: (col: string, val: any) => {
          const res = { data: null, error: null };
          return {
            ...res,
            then: (resolve: any) => resolve(res)
          };
        }
      };
    }
  };
};

// Proxy para manter a compatibilidade com o código existente que importa 'supabase' diretamente
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    try {
      if (prop === '_isMock') {
        return !getSupabase();
      }
      const instance = getSupabase();
      if (!instance) {
        if (prop === 'auth') {
          return mockAuth;
        }
        if (prop === 'from') {
          return mockFrom;
        }
        return null;
      }
      
      const value = instance[prop];
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    } catch (e) {
      console.warn('Supabase Proxy Error:', e);
      return null;
    }
  }
});
