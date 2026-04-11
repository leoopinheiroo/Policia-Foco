
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  mode: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD';
  onAuth: () => void;
  onGoLogin: () => void;
  onGoSignup: () => void;
  onGoForgot: () => void;
  onSuccess: (email: string, name?: string) => void;
  onBack: () => void;
}

const SAVED_EMAIL_KEY = 'PF_CRED_E';
const SAVED_PASSWORD_KEY = 'PF_CRED_P';
const REMEMBER_ME_KEY = 'PF_REMEMBER';

export const Auth: React.FC<AuthProps> = ({ mode, onAuth, onGoLogin, onGoSignup, onGoForgot, onSuccess, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Carrega credenciais salvas de forma persistente ao montar o componente
  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
    
    if (savedEmail) setEmail(savedEmail);
    if (savedPassword) setPassword(savedPassword);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'LOGIN') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        // Após o login com Supabase Auth, buscamos o perfil na tabela users
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('email', email)
          .single();

        onAuth();
        onSuccess(email, profile?.name || 'Operador');
      } else if (mode === 'SIGNUP') {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (authError) throw authError;

        // Criamos o registro na tabela users via API para garantir que o backend processe
        // (Ou poderíamos fazer via Supabase client se o RLS permitir)
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Erro ao criar perfil.');
        }

        setSuccessMessage("CONTA CRIADA! VERIFIQUE SEU E-MAIL PARA CONFIRMAÇÃO (SE ATIVADO NO SUPABASE).");
        onAuth();
        onSuccess(email, name);
      } else if (mode === 'FORGOT_PASSWORD') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (authError) throw authError;
        setSuccessMessage("EMAIL DE RECUPERAÇÃO ENVIADO COM SUCESSO! VERIFIQUE SUA CAIXA DE ENTRADA.");
      }

      // Persistência de Credenciais se o usuário marcou a opção
      if (saveCredentials) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.removeItem(SAVED_PASSWORD_KEY);
        localStorage.setItem(REMEMBER_ME_KEY, 'false');
      }
    } catch (err: any) {
      setError(err.message.toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-yellow-500 selection:text-slate-900">
       <div className="w-full max-w-md animate-fade-in">
          <button 
            onClick={onBack}
            className="mb-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-yellow-500 transition-colors flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> VOLTAR AO INÍCIO
          </button>

          <div className="text-center mb-10">
             <h1 className="text-4xl font-black text-yellow-500 tracking-tighter italic mb-2">APROVA ELITE IA</h1>
             <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.4em]">
                {mode === 'LOGIN' ? 'Autenticação de Operador' : mode === 'SIGNUP' ? 'Alistamento no Grupamento' : 'Recuperação de Acesso'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 p-10 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] space-y-7 relative overflow-hidden">
             {error && (
               <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl text-[10px] font-black text-red-500 uppercase tracking-widest animate-shake text-center">
                 {error}
               </div>
             )}

             {successMessage && (
               <div className="bg-green-500/10 border border-green-500/30 p-5 rounded-2xl text-[10px] font-black text-green-500 uppercase tracking-widest text-center">
                 {successMessage}
               </div>
             )}

             {mode === 'SIGNUP' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                   <label htmlFor="full-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Como quer ser chamado? (Opcional)</label>
                   <input 
                      id="full-name"
                      name="name"
                      type="text" 
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm font-medium placeholder:text-slate-700"
                      placeholder="Ex: Leonardo"
                   />
                </div>
             )}
             
             <div>
                <label htmlFor="email-address" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Seu melhor E-mail</label>
                <input 
                   id="email-address"
                   name="email"
                   type="email" 
                   autoComplete="email"
                   required
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm font-medium placeholder:text-slate-700"
                   placeholder="exemplo@email.com"
                />
             </div>

             <div>
                <div className="flex justify-between mb-2 ml-1">
                   <label htmlFor="password-field" className="text-[10px] font-black uppercase tracking-widest text-slate-500">{mode === 'FORGOT_PASSWORD' ? 'Confirmação de Identidade' : 'Crie sua Senha'}</label>
                   {mode === 'LOGIN' && (
                     <button onClick={onGoForgot} type="button" className="text-[9px] text-yellow-500/40 hover:text-yellow-500 font-black uppercase tracking-widest transition">Esqueceu a senha?</button>
                   )}
                </div>
                {mode !== 'FORGOT_PASSWORD' ? (
                  <div className="relative">
                    <input 
                       id="password-field"
                       name="password"
                       type={showPassword ? "text" : "password"} 
                       autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                       required
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className={`w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm placeholder:text-slate-700 placeholder:tracking-normal ${!showPassword ? 'tracking-[0.3em]' : 'tracking-normal'}`}
                       placeholder="Mínimo 6 caracteres"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-yellow-500 transition-colors p-2"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 font-medium leading-relaxed px-1 italic">
                    Enviaremos um link de redefinição para o endereço acima.
                  </div>
                )}
             </div>

             {mode !== 'FORGOT_PASSWORD' && (
               <div className="flex items-center gap-3 py-1 ml-1 group cursor-pointer" onClick={() => setSaveCredentials(!saveCredentials)}>
                  <div className={`w-11 h-6 rounded-full transition-all relative flex items-center px-1 ${saveCredentials ? 'bg-yellow-500' : 'bg-slate-800'}`}>
                     <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${saveCredentials ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${saveCredentials ? 'text-yellow-500' : 'text-slate-500'}`}>
                     Salvar Credenciais
                  </span>
               </div>
             )}

             <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-6 bg-yellow-500 text-slate-950 rounded-[1.5rem] font-black text-lg hover:bg-yellow-400 transition shadow-2xl shadow-yellow-500/10 flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 group"
             >
                {isLoading ? (
                   <div className="w-6 h-6 border-4 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                   <>
                    <span>{mode === 'LOGIN' ? 'EFETUAR LOGIN' : mode === 'SIGNUP' ? 'CONFIRMAR INSCRIÇÃO' : 'SOLICITAR LINK'}</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                   </>
                )}
             </button>

             <div className="pt-4 text-center">
                {mode === 'LOGIN' ? (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Primeira missão? <button onClick={onGoSignup} type="button" className="text-yellow-500 font-black hover:underline ml-1">Criar Conta</button>
                   </p>
                ) : mode === 'SIGNUP' ? (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Já é do grupo? <button onClick={onGoLogin} type="button" className="text-yellow-500 font-black hover:underline ml-1">Entrar Agora</button>
                   </p>
                ) : (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Lembrou a senha? <button onClick={onGoLogin} type="button" className="text-yellow-500 font-black hover:underline ml-1">Voltar ao Login</button>
                   </p>
                )}
             </div>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Ferramentas de Suporte</p>
            <button 
              onClick={async () => {
                try {
                  const [healthRes, debugRes] = await Promise.all([
                    fetch('/api/health'),
                    fetch('/api/debug-config')
                  ]);
                  const health = await healthRes.json();
                  const debug = await debugRes.json();
                  alert(`--- DIAGNÓSTICO DO SISTEMA ---\n\nStatus API: ${health.status}\nSupabase Conectado: ${health.supabase ? 'SIM' : 'NÃO'}\nStatus do Banco: ${health.database_connectivity}\nErro do Banco: ${health.database_error || 'Nenhum'}\n\n--- CHAVES (SETTINGS) ---\nURL: ${debug.url_status}\nService Key: ${debug.service_key_status}\n\nSe "Status do Banco" for "error", verifique se as chaves no menu Settings do AI Studio estão corretas.`);
                } catch (e) {
                  alert('Erro crítico: Não foi possível conectar ao servidor backend.');
                }
              }}
              className="w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 transition-all uppercase tracking-widest"
            >
              🔍 Executar Diagnóstico de Conexão
            </button>
          </div>
       </div>
       <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
          .animate-fade-in { animation: fadeIn 0.5s ease-out; }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
       `}</style>
    </div>
  );
};
