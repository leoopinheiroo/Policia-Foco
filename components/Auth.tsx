
import React, { useState, useEffect } from 'react';

interface AuthProps {
  mode: 'LOGIN' | 'SIGNUP';
  onAuth: () => void;
  onGoLogin: () => void;
  onGoSignup: () => void;
  onSuccess: (email: string) => void;
  onBack: () => void;
}

const SAVED_EMAIL_KEY = 'PF_CRED_E';
const SAVED_PASSWORD_KEY = 'PF_CRED_P';
const REMEMBER_ME_KEY = 'PF_REMEMBER';

export const Auth: React.FC<AuthProps> = ({ mode, onAuth, onGoLogin, onGoSignup, onSuccess, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const endpoint = mode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const name = formData.get('name');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(`ERRO NO SERVIDOR (${response.status}). VERIFIQUE SE O BACKEND ESTÁ RODANDO.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na autenticação.');
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

      onAuth();
      onSuccess(email);
      
      // If it's a new signup, we should redirect to checkout immediately
      // This will be handled in App.tsx based on the status
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
             <h1 className="text-4xl font-black text-yellow-500 tracking-tighter italic mb-2">POLÍCIAFOCO</h1>
             <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.4em]">
                {mode === 'LOGIN' ? 'Autenticação de Operador' : 'Alistamento no Grupamento'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 p-10 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] space-y-7 relative overflow-hidden">
             {error && (
               <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl text-[10px] font-black text-red-500 uppercase tracking-widest animate-shake text-center">
                 {error}
               </div>
             )}

             {mode === 'SIGNUP' && (
                <div>
                   <label htmlFor="full-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Nome Completo</label>
                   <input 
                      id="full-name"
                      name="name"
                      type="text" 
                      autoComplete="name"
                      required
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm font-medium"
                      placeholder="Ex: Leonardo Pinheiro"
                   />
                </div>
             )}
             
             <div>
                <label htmlFor="email-address" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Email de Acesso</label>
                <input 
                   id="email-address"
                   name="email"
                   type="email" 
                   autoComplete="email"
                   required
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm font-medium"
                   placeholder="seu@email.com"
                />
             </div>

             <div>
                <div className="flex justify-between mb-2 ml-1">
                   <label htmlFor="password-field" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Senha</label>
                   {mode === 'LOGIN' && (
                     <button type="button" className="text-[9px] text-yellow-500/40 hover:text-yellow-500 font-black uppercase tracking-widest transition">Recuperar</button>
                   )}
                </div>
                <input 
                   id="password-field"
                   name="password"
                   type="password" 
                   autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                   required
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-yellow-500 outline-none transition text-sm tracking-[0.3em]"
                   placeholder="••••••••"
                />
             </div>

             <div className="flex items-center gap-3 py-1 ml-1 group cursor-pointer" onClick={() => setSaveCredentials(!saveCredentials)}>
                <div className={`w-11 h-6 rounded-full transition-all relative flex items-center px-1 ${saveCredentials ? 'bg-yellow-500' : 'bg-slate-800'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${saveCredentials ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${saveCredentials ? 'text-yellow-500' : 'text-slate-500'}`}>
                   Salvar Credenciais
                </span>
             </div>

             <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-6 bg-yellow-500 text-slate-950 rounded-[1.5rem] font-black text-lg hover:bg-yellow-400 transition shadow-2xl shadow-yellow-500/10 flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 group"
             >
                {isLoading ? (
                   <div className="w-6 h-6 border-4 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                   <>
                    <span>{mode === 'LOGIN' ? 'EFETUAR LOGIN' : 'CONFIRMAR INSCRIÇÃO'}</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                   </>
                )}
             </button>

             <div className="pt-4 text-center">
                {mode === 'LOGIN' ? (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Primeira missão? <button onClick={onGoSignup} type="button" className="text-yellow-500 font-black hover:underline ml-1">Criar Conta</button>
                   </p>
                ) : (
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    Já é do grupo? <button onClick={onGoLogin} type="button" className="text-yellow-500 font-black hover:underline ml-1">Entrar Agora</button>
                   </p>
                )}
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
