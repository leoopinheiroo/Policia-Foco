import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { apiJson } from '../services/apiClient';
import { Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  mode: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';
  onAuth: () => void;
  onGoLogin: () => void;
  onGoSignup: () => void;
  onGoForgot: () => void;
  onSuccess: (email: string, name?: string) => void;
  onBack: () => void;
}

const SAVED_EMAIL_KEY = 'PF_CRED_E';
const REMEMBER_ME_KEY = 'PF_REMEMBER';

export const Auth: React.FC<AuthProps> = ({ mode, onAuth, onGoLogin, onGoSignup, onGoForgot, onSuccess, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberEmail, setRememberEmail] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    localStorage.removeItem('PF_CRED_P');
    if (localStorage.getItem(REMEMBER_ME_KEY) === 'true') {
      const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  const syncProfile = async (userEmail: string, userName?: string) => {
    try {
      await apiJson('/api/user/ensure-profile', {
        method: 'POST',
        body: JSON.stringify({ name: userName || 'Operador' }),
      });
    } catch (e) {
      console.error('Falha ao sincronizar perfil:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'SIGNUP') {
        if (!name.trim()) throw new Error('POR FAVOR, INFORME SEU NOME COMPLETO.');
        if (password.length < 6) throw new Error('A SENHA DEVE TER NO MÍNIMO 6 CARACTERES.');
        if (password !== confirmPassword) throw new Error('AS SENHAS NÃO CONFEREM. VERIFIQUE E TENTE NOVAMENTE.');
      }

      if (mode === 'RESET_PASSWORD') {
        if (password.length < 6) throw new Error('A SENHA DEVE TER NO MÍNIMO 6 CARACTERES.');
        if (password !== confirmPassword) throw new Error('AS SENHAS NÃO CONFEREM.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSuccessMessage('SENHA ATUALIZADA COM SUCESSO! FAÇA LOGIN.');
        setTimeout(() => onGoLogin(), 1500);
        return;
      }

      if (mode === 'LOGIN') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          if (authError.message === 'Email not confirmed') {
            throw new Error('SEU E-MAIL AINDA NÃO FOI CONFIRMADO. VERIFIQUE SUA CAIXA DE ENTRADA.');
          }
          if (authError.message === 'Invalid login credentials') {
            throw new Error('E-MAIL OU SENHA INCORRETOS.');
          }
          throw authError;
        }
        await syncProfile(email);
        onAuth();
        onSuccess(email);
      } else if (mode === 'SIGNUP') {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (authError) {
          if (authError.message.toLowerCase().includes('already registered')) {
            throw new Error('ESTE E-MAIL JÁ ESTÁ CADASTRADO. FAÇA LOGIN OU RECUPERE SUA SENHA.');
          }
          throw authError;
        }
        await syncProfile(email, name);
        setSuccessMessage("CONTA CRIADA COM SUCESSO! REDIRECIONANDO...");
        setTimeout(() => {
          onAuth();
          onSuccess(email, name);
        }, 1200);
      } else if (mode === 'FORGOT_PASSWORD') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?view=reset-password`,
        });
        if (authError) throw authError;
        setSuccessMessage("EMAIL DE RECUPERAÇÃO ENVIADO! VERIFIQUE SUA CAIXA DE ENTRADA.");
      }

      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.setItem(REMEMBER_ME_KEY, 'false');
      }
    } catch (err: any) {
      setError((err.message || 'Erro').toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    mode === 'LOGIN' ? 'Autenticação de Operador'
    : mode === 'SIGNUP' ? 'Alistamento no Grupamento'
    : mode === 'RESET_PASSWORD' ? 'Nova Senha Operacional'
    : 'Recuperação de Acesso';

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
             <h1 className="text-2xl sm:text-4xl font-black text-yellow-500 tracking-tighter italic mb-2">APROVA ELITE IA</h1>
             <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.4em]">{title}</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 p-6 sm:p-10 rounded-3xl sm:rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] space-y-6 sm:space-y-7 relative overflow-hidden">
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
                <div>
                   <label htmlFor="full-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Nome</label>
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

             {mode !== 'RESET_PASSWORD' && (
             <div>
                <label htmlFor="email-address" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">E-mail</label>
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
             )}

             {mode !== 'FORGOT_PASSWORD' && (
             <div>
                <div className="flex justify-between mb-2 ml-1">
                   <label htmlFor="password-field" className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                     {mode === 'RESET_PASSWORD' ? 'Nova Senha' : mode === 'SIGNUP' ? 'Crie sua Senha' : 'Sua Senha'}
                   </label>
                   {mode === 'LOGIN' && (
                     <button onClick={onGoForgot} type="button" className="text-[9px] text-yellow-500/40 hover:text-yellow-500 font-black uppercase tracking-widest transition">Esqueceu a senha?</button>
                   )}
                </div>
                <div className="relative">
                  <input
                     id="password-field"
                     name="password"
                     type={showPassword ? "text" : "password"}
                     autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm placeholder:text-slate-700"
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
             </div>
             )}

             {mode === 'FORGOT_PASSWORD' && (
               <div className="text-[10px] text-slate-400 font-medium leading-relaxed px-1 italic">
                 Enviaremos um link de redefinição para o endereço acima.
               </div>
             )}

             {(mode === 'SIGNUP' || mode === 'RESET_PASSWORD') && (
               <div>
                  <label htmlFor="confirm-password-field" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Confirme a Senha</label>
                  <input
                     id="confirm-password-field"
                     name="confirmPassword"
                     type={showPassword ? "text" : "password"}
                     autoComplete="new-password"
                     required
                     value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                     className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm placeholder:text-slate-700"
                     placeholder="Repita a senha"
                  />
               </div>
             )}

             {mode === 'LOGIN' && (
               <div className="flex items-center gap-3 py-1 ml-1 group cursor-pointer" onClick={() => setRememberEmail(!rememberEmail)}>
                  <div className={`w-11 h-6 rounded-full transition-all relative flex items-center px-1 ${rememberEmail ? 'bg-yellow-500' : 'bg-slate-800'}`}>
                     <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${rememberEmail ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${rememberEmail ? 'text-yellow-500' : 'text-slate-500'}`}>
                     Lembrar e-mail
                  </span>
               </div>
             )}

             <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 sm:py-6 bg-yellow-500 text-slate-950 rounded-[1.5rem] font-black text-base sm:text-lg hover:bg-yellow-400 transition shadow-2xl shadow-yellow-500/10 flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 group"
             >
                {isLoading ? (
                   <div className="w-6 h-6 border-4 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                   <>
                    <span>
                      {mode === 'LOGIN' ? 'EFETUAR LOGIN'
                        : mode === 'SIGNUP' ? 'CONFIRMAR INSCRIÇÃO'
                        : mode === 'RESET_PASSWORD' ? 'SALVAR NOVA SENHA'
                        : 'SOLICITAR LINK'}
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                   </>
                )}
             </button>

             <div className="pt-4 text-center">
                {mode === 'LOGIN' ? (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Primeira missão? <button onClick={onGoSignup} type="button" className="text-yellow-500 font-black hover:underline ml-1">Criar Conta</button>
                   </p>
                ) : mode === 'SIGNUP' || mode === 'RESET_PASSWORD' || mode === 'FORGOT_PASSWORD' ? (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Já é do grupo? <button onClick={onGoLogin} type="button" className="text-yellow-500 font-black hover:underline ml-1">Entrar Agora</button>
                   </p>
                ) : null}
             </div>
          </form>
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
