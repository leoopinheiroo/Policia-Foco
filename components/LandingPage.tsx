
import React from 'react';

interface LandingProps {
  onStart: (plan: 'MONTHLY' | 'ANNUAL') => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onStart, onLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-yellow-500 selection:text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/90 border-b border-white/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
             <div className="w-11 h-11 bg-yellow-500 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.2)] group-hover:scale-110 transition-transform duration-500">
                <span className="text-slate-950 font-black text-xl tracking-tighter">GA</span>
             </div>
             <span className="text-2xl font-black text-white tracking-tighter italic group-hover:text-yellow-500 transition-colors duration-300">
               GENIUS<span className="text-yellow-500 group-hover:text-white">AI</span>
             </span>
          </div>
          
          <div className="flex items-center gap-8 md:gap-12">
             <button 
               onClick={onLogin} 
               className="hidden sm:block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-white transition-all relative group whitespace-nowrap"
             >
               Entrar na Conta
               <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-yellow-500 transition-all duration-300 group-hover:w-full"></span>
             </button>
             
             <button 
               onClick={() => onStart('ANNUAL')} 
               className="bg-yellow-500 text-slate-950 px-6 md:px-10 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-white hover:text-slate-950 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_-10px_rgba(234,179,8,0.4)] whitespace-nowrap"
             >
               Quero ser Aprovado
             </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-8 md:px-16 py-24 md:py-40 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
        <div className="flex-1 text-center lg:text-left">
           <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-black tracking-widest text-yellow-500 mb-8 uppercase">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Treinamento de Elite 100% Digital
           </div>
           <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-tight mb-8">
              A ÚLTIMA VEZ QUE VOCÊ ESTUDA COMO UM <span className="text-yellow-500 underline decoration-yellow-500/20">AMADOR</span>.
           </h1>
           <p className="text-slate-400 text-xl md:text-2xl leading-relaxed max-w-2xl mb-12">
              Esqueça métodos obsoletos. Nossa IA de Elite mapeia sua mente, identifica suas falhas e gera o caminho exato para a sua aprovação. Do zero à farda, o seu futuro é decidido aqui.
           </p>
           <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
              <button onClick={() => onStart('ANNUAL')} className="w-full sm:w-auto bg-yellow-500 text-slate-950 px-12 py-7 rounded-2xl font-black text-xl hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-yellow-500/20">
                 QUERO MINHA VAGA AGORA
              </button>
           </div>
           
           <div className="mt-12 flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-4">
                 {[1,2,3,4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-full border-4 border-slate-950 bg-slate-800 flex items-center justify-center text-xs font-bold shadow-xl">👮</div>
                 ))}
              </div>
              <div className="text-sm font-bold text-slate-400">
                 <span className="text-white">12.420+</span> Alunos ativos
              </div>
           </div>
        </div>
        <div className="flex-1 relative hidden lg:block">
           <div className="absolute inset-0 bg-yellow-500/10 blur-[100px] rounded-full" />
           <div className="relative bg-slate-900 border border-white/10 rounded-[4rem] p-12 shadow-2xl rotate-3">
              <div className="space-y-6">
                 <div className="h-4 w-32 bg-white/10 rounded-full" />
                 <div className="h-10 w-full bg-yellow-500/20 rounded-2xl" />
                 <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-white/5 rounded-3xl" />
                    <div className="h-32 bg-white/5 rounded-3xl" />
                 </div>
                 <div className="h-20 w-full bg-white/5 rounded-3xl flex items-center px-8">
                    <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-slate-950 font-black">94%</div>
                    <div className="ml-4 h-3 w-32 bg-white/10 rounded-full" />
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Pricing */}
      <section className="px-8 md:px-16 py-32 bg-slate-900 text-white">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
               <h2 className="text-5xl font-black tracking-tighter mb-4">Escolha seu Plano de Ataque</h2>
               <p className="text-slate-400 text-xl">Acesso imediato a todas as ferramentas de estudo de elite.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
               <PlanCard 
                  name="Recruta" 
                  price="29,90" 
                  period="Mensal" 
                  features={["Questões Ilimitadas", "IA de Sugestões", "Vade Mecum Digital", "Suporte via Chat"]} 
                  onSelect={() => onStart('MONTHLY')}
               />
               <PlanCard 
                  name="Elite" 
                  price="297,00" 
                  period="Anual" 
                  highlight 
                  features={["Tudo do Recruta", "Correção de Redação IA (Ilimitada)", "Simulados de Elite Semanais", "Dashboard de Performance", "Acesso Vitalício às Atualizações", "2 Meses de Bônus Inclusos"]}
                  onSelect={() => onStart('ANNUAL')}
               />
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center text-slate-600 text-sm">
         <p>&copy; 2025 GeniusAI - Treinamento de Alto Rendimento. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

const PlanCard = ({ name, price, period, features, highlight, onSelect }: any) => (
  <div className={`p-10 rounded-[3rem] border-2 flex flex-col justify-between transition-all hover:scale-[1.02] relative overflow-hidden
     ${highlight ? 'border-yellow-500 bg-slate-950 shadow-[0_0_50px_-12px_rgba(234,179,8,0.3)]' : 'border-white/10 bg-slate-950'}
  `}>
     {highlight && (
        <div className="absolute top-0 right-0 bg-yellow-500 text-slate-950 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
           Melhor Custo-Benefício
        </div>
     )}
     <div>
        <h3 className="text-2xl font-black mb-2">{name}</h3>
        <div className="flex items-end gap-1 mb-8">
           <span className="text-sm font-bold mb-2">R$</span>
           <span className="text-6xl font-black tracking-tighter">{price}</span>
           <span className="text-slate-500 font-bold mb-2">/{period}</span>
        </div>
        <ul className="space-y-4 mb-10">
           {features.map((f: string, i: number) => (
              <li key={i} className="flex items-center gap-3 font-medium text-slate-300">
                 <span className="text-yellow-500">✓</span> {f}
              </li>
           ))}
        </ul>
     </div>
     <button 
        onClick={onSelect}
        className={`w-full py-5 rounded-2xl font-black transition-all
        ${highlight ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}
     `}>
        SELECIONAR PLANO
     </button>
  </div>
);
