
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, Star, MessageSquare, Zap, BookOpen, BarChart3, Target, ShieldCheck, Clock, BrainCircuit, Users, Award, ChevronRight } from 'lucide-react';

interface LandingProps {
  onStart: (plan: 'MONTHLY' | 'ANNUAL') => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onStart, onLogin }) => {
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 800) setShowStickyCTA(true);
      else setShowStickyCTA(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-green-500 selection:text-slate-900 scroll-smooth">
      {/* URGENCY TOP BAR */}
      <div className="bg-orange-600 text-white py-2 px-6 text-center text-[10px] font-black uppercase tracking-[0.2em] relative z-[60]">
         🔥 Oferta de Lançamento: Desconto de 50% encerra em <Countdown />
      </div>

      {/* STICKY CTA MOBILE */}
      <AnimatePresence>
        {showStickyCTA && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:hidden"
          >
            <button 
              onClick={() => onStart('ANNUAL')}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-lg shadow-[0_-10px_40px_-5px_rgba(22,163,74,0.3)] flex items-center justify-center gap-3 active:scale-95"
            >
              🚀 QUERO SER APROVADO AGORA
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. HERO SECTION */}
      <nav className="fixed top-0 z-[70] w-full backdrop-blur-md bg-slate-950/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-black italic tracking-tighter uppercase">
              Aprova<span className="text-orange-500">Elite IA</span>
            </span>
          </div>
          <div className="flex items-center gap-4 relative z-50">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLogin();
              }}
              className="relative z-50 px-8 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-[0_10px_30px_-5px_rgba(234,88,12,0.4)] cursor-pointer active:scale-95"
            >
              Acessar Plataforma
            </button>
          </div>
        </div>
      </nav>

      <header className="relative pt-32 pb-20 px-6 overflow-hidden z-10">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-green-600/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-black tracking-widest text-orange-500 mb-8 uppercase"
          >
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Vagas Limitadas para o Ciclo de Elite
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8"
          >
            Passe em concursos policiais mais rápido com um método que mostra <span className="text-orange-500">exatamente o que estudar</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg md:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Um aplicativo com inteligência artificial que corrige suas redações em segundos, identifica seus erros e te guia até a aprovação.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-8"
          >
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              <BulletItem text="Questões no estilo da banca" />
              <BulletItem text="Correção automática de redação com IA" />
              <BulletItem text="Plano de estudo personalizado" />
            </div>

            <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 px-6 py-3 rounded-2xl">
               <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-xs overflow-hidden">
                       <img src={`https://picsum.photos/seed/user${i}/40/40`} alt="user" referrerPolicy="no-referrer" />
                    </div>
                  ))}
               </div>
               <div className="text-left">
                  <p className="text-[10px] font-black text-green-500 uppercase tracking-widest leading-none mb-1">Elite em Ação</p>
                  <p className="text-xs text-slate-400 font-bold tracking-tight">+1.240 alunos estudando agora</p>
               </div>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onStart('ANNUAL');
              }}
              className="group relative z-20 w-full max-w-md bg-green-600 hover:bg-green-500 text-white px-8 py-6 rounded-2xl font-black text-2xl shadow-[0_20px_50px_-15px_rgba(22,163,74,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4 cursor-pointer"
            >
              👉 COMEÇAR AGORA
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        </div>
      </header>

      {/* 2. PAIN SECTION / BREAK BELIEF */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-slate-950 p-12 md:p-20 rounded-[3rem] border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-orange-600"></div>
            <h2 className="text-3xl md:text-5xl font-black mb-8 leading-tight">
              Se você estuda todos os dias, mas sente que não evolui… o problema não é falta de esforço.
            </h2>
            <p className="text-orange-500 text-2xl md:text-4xl font-black mb-10 italic">É falta de direção.</p>
            <p className="text-slate-400 text-xl md:text-2xl leading-relaxed">
              Enquanto você repete os mesmos erros, outras pessoas estão sendo aprovadas com estratégia.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURES */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6">Tudo que você precisa para sair do zero até a aprovação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<BookOpen className="w-8 h-8 text-orange-500" />}
              title="Questões direcionadas"
              description="Treine com milhares de questões focadas no que realmente cai na prova."
            />
            <FeatureCard 
              icon={<Zap className="w-8 h-8 text-orange-500" />}
              title="Correção de redação com IA"
              description="Receba análise completa e saiba exatamente onde melhorar em segundos."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-8 h-8 text-orange-500" />}
              title="Evolução inteligente"
              description="O sistema identifica seus pontos fracos e direciona seu estudo automaticamente."
            />
            <FeatureCard 
              icon={<Target className="w-8 h-8 text-orange-500" />}
              title="Simulados estilo Vunesp, Cespe, FGV e +"
              description="Treine no nível real da prova com as principais bancas e esteja pronto para o combate."
            />
          </div>
        </div>
      </section>

      {/* 3.1 COMPARISON SECTION */}
      <section className="py-24 px-6 bg-slate-900/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-16 uppercase tracking-tighter">
            Por que o Aprova Elite é <span className="text-orange-500 underline decoration-orange-500/20">superior</span> a qualquer método?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="bg-slate-950 p-8 md:p-12 opacity-60">
              <h3 className="text-xl font-black mb-8 text-slate-400 uppercase tracking-widest flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" /> Método Tradicional
              </h3>
              <ul className="space-y-6">
                <li className="flex gap-4 items-start text-slate-500 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                   Estudo passivo sem saber se está evoluindo
                </li>
                <li className="flex gap-4 items-start text-slate-500 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                   Redações corrigidas em 7 dias (ou nunca)
                </li>
                <li className="flex gap-4 items-start text-slate-500 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                   Material genérico que não foca na banca
                </li>
                <li className="flex gap-4 items-start text-slate-500 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                   Dúvidas que demoram dias para serem respondidas
                </li>
              </ul>
            </div>
            <div className="bg-slate-950 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-orange-600 text-white px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">Recomendado</div>
              <h3 className="text-xl font-black mb-8 text-green-500 uppercase tracking-widest flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" /> Aprova Elite IA
              </h3>
              <ul className="space-y-6">
                <li className="flex gap-4 items-start text-white font-bold">
                   <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" />
                   IA que mapeia seus pontos fracos em tempo real
                </li>
                <li className="flex gap-4 items-start text-white font-bold">
                   <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" />
                   Correção de redação instantânea com nota e feedback
                </li>
                <li className="flex gap-4 items-start text-white font-bold">
                   <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" />
                   Treinamento direcionado exclusivamente para a sua banca
                </li>
                <li className="flex gap-4 items-start text-white font-bold">
                   <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" />
                   Professor IA disponível 24h para tirar qualquer dúvida
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3.2 EXTRA TOOLS SECTION */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[4rem] p-12 md:p-20 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/5 blur-[100px] -z-10" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter leading-tight">
                  Arsenal completo para quem não aceita <span className="text-orange-500">perder</span>
                </h2>
                <div className="space-y-12">
                   <div className="flex gap-6">
                      <div className="w-16 h-16 shrink-0 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20">
                         <BrainCircuit className="w-8 h-8 text-orange-500" />
                      </div>
                      <div>
                         <h4 className="text-xl font-black mb-2 uppercase tracking-wide">Professor IA 24h</h4>
                         <p className="text-slate-400 leading-relaxed">Tire dúvidas técnicas de Direito, Português ou qualquer matéria em segundos. É como ter um mentor ao seu lado o tempo todo.</p>
                      </div>
                   </div>
                   <div className="flex gap-6">
                      <div className="w-16 h-16 shrink-0 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20">
                         <ShieldCheck className="w-8 h-8 text-orange-500" />
                      </div>
                      <div>
                         <h4 className="text-xl font-black mb-2 uppercase tracking-wide">Vade Mecum Integrado</h4>
                         <p className="text-slate-400 leading-relaxed">Toda a legislação necessária para a sua prova, atualizada e otimizada para consulta rápida durante as questões.</p>
                      </div>
                   </div>
                </div>
              </div>
              <div className="relative group">
                 <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl rotate-2 group-hover:rotate-0 transition-transform duration-500">
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full" />
                          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                          <div className="w-3 h-3 bg-green-500 rounded-full" />
                       </div>
                       <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
                          <p className="text-xs text-slate-500 mb-2">Professor IA:</p>
                          <p className="text-sm font-medium italic">"Operador, o crime de peculato exige que o funcionário público tenha a posse do bem em razão do cargo..."</p>
                       </div>
                       <div className="h-2 w-full bg-white/5 rounded-full" />
                       <div className="h-2 w-3/4 bg-white/5 rounded-full" />
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. WHO IT'S FOR */}
      <section className="py-32 px-6 bg-slate-900/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="bg-slate-950 p-12 rounded-[2.5rem] border border-green-500/10 shadow-2xl">
            <h3 className="text-3xl font-black mb-10 flex items-center gap-4 text-green-500">
              <CheckCircle2 className="w-8 h-8" /> Para quem é:
            </h3>
            <ul className="space-y-6">
              <CheckItem text="Quer passar em concursos policiais" />
              <CheckItem text="Está cansado de estudar sem resultado" />
              <CheckItem text="Quer acelerar a aprovação" />
              <CheckItem text="Busca feedback imediato nas redações" />
            </ul>
          </div>

          <div className="bg-slate-950 p-12 rounded-[2.5rem] border border-red-500/10 opacity-70">
            <h3 className="text-3xl font-black mb-10 flex items-center gap-4 text-red-500">
              <XCircle className="w-8 h-8" /> Para quem NÃO é:
            </h3>
            <ul className="space-y-6 text-slate-400">
              <li className="flex gap-3">❌ Procura fórmula mágica</li>
              <li className="flex gap-3">❌ Não quer se dedicar</li>
              <li className="flex gap-3">❌ Quer resultado sem esforço</li>
              <li className="flex gap-3">❌ Já desistiu do sonho da farda</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. PROVA SOCIAL */}
      <section className="py-32 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="flex justify-center gap-1 mb-4">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 fill-orange-500 text-orange-500" />)}
            </div>
            <h2 className="text-4xl md:text-6xl font-black">Quem usou, aprovou</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Testimonial 
              name="Lucas M."
              text="Eu estudava e não saía do lugar. Depois do app, finalmente entendi onde eu errava e parei de perder tempo."
              role="Candidato PM-SP"
            />
            <Testimonial 
              name="Amanda R."
              text="A correção da redação mudou completamente meu nível. Ganhei 15 pontos na última prova graças ao feedback da IA."
              role="Candidata PC-SP"
            />
            <Testimonial 
              name="Tiago S."
              text="Parece que agora eu tenho um caminho claro pra passar. O plano de estudos me ajudou a focar no que importa."
              role="Aprovado GCM"
            />
            <Testimonial 
              name="Fernanda L."
              text="Fazer simulados técnicos toda semana me deu a confiança que faltava pro dia da prova."
              role="Candidata PM-MG"
            />
            <Testimonial 
              name="Ricardo J."
              text="A plataforma é intuitiva e a IA realmente entende seu perfil. Melhor investimento da minha vida."
              role="Candidato PRF"
            />
            <Testimonial 
              name="Beatriz P."
              text="Nunca imaginei que o Vade Mecum pudesse ser tão fácil de consultar. Tudo na palma da mão."
              role="Candidata PC-RJ"
            />
          </div>
        </div>
      </section>

      {/* 6. COMO FUNCIONA */}
      <section className="py-32 px-6 bg-orange-600/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black text-center mb-20">Como funciona o método</h2>
          
          <div className="space-y-6">
            <Step number="1" text="Você resolve questões focadas no seu edital escolhido." />
            <Step number="2" text="O app analisa seus erros e padrões instantaneamente." />
            <Step number="3" text="Nossa IA corrige sua redação com feedback pedagógico." />
            <Step number="4" text="Te mostramos exatamente o que estudar nos próximos dias." />
            <Step number="5" text="Você evolui muito mais rápido e domina o edital." />
          </div>
        </div>
      </section>

      {/* 7. OFERTA */}
      <section id="pricing" className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6">Escolha seu plano de treinamento</h2>
            <p className="text-slate-400 text-xl">Acesso total a todas as ferramentas de IA e questões.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
            {/* PLANO MENSAL */}
            <div className="bg-slate-900 border border-white/10 rounded-[4rem] p-12 flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Recruta (Mensal)</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium">Ideal para testar o método</p>
                
                <div className="flex items-baseline gap-2 mb-10">
                   <span className="text-5xl font-black text-white">29,90</span>
                   <span className="text-slate-500 font-bold">/mês</span>
                </div>

                <div className="space-y-4 mb-10">
                  <CheckItem text="Questões ilimitadas" />
                  <CheckItem text="Correção de redação IA (5/mês)" />
                  <CheckItem text="Professor IA 24h" />
                  <CheckItem text="Dashboard de performance" />
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onStart('MONTHLY');
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-white px-8 py-6 rounded-2xl font-black text-xl border border-white/10 transition-all active:scale-95 cursor-pointer relative z-10"
              >
                COMEÇAR MENSAL
              </button>
            </div>

            {/* PLANO ANUAL */}
            <div className="bg-slate-900 border-2 border-orange-600 rounded-[4rem] p-12 flex flex-col justify-between relative shadow-[0_0_80px_-20px_rgba(234,88,12,0.3)] hover:scale-[1.02] transition-all">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                MAIS ESCOLHIDO & ECONÔMICO
              </div>
              
              <div>
                <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter italic text-orange-500">Elite (Anual)</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium italic">Acesso total e ininterrupto</p>
                
                <div className="flex items-baseline gap-2 mb-2">
                   <span className="text-xl font-bold text-slate-500 mt-4">12x</span>
                   <span className="text-7xl font-black tracking-tighter text-white">24,75</span>
                </div>
                <p className="text-slate-500 text-xs font-bold mb-10 uppercase tracking-widest">Ou R$ 297,00 à vista (Economize 50%)</p>

                <div className="space-y-4 mb-10">
                  <CheckItem text="Questões ilimitadas com correção" />
                  <CheckItem text="Correção de redação ILIMITADA" />
                  <CheckItem text="Simulados estilo prova (Vunesp, FGV...)" />
                  <CheckItem text="Professor IA Prioritário 24h" />
                  <CheckItem text="Flashcards inteligentes adaptativos" />
                  <CheckItem text="Vade Mecum Implementado" />
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onStart('ANNUAL');
                }}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-8 py-7 rounded-2xl font-black text-2xl shadow-2xl transition-all active:scale-95 cursor-pointer relative z-10"
              >
                APROVEITAR ESTA CONDIÇÃO
              </button>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-10 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-green-500" /> Compra 100% Segura
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                <Clock className="w-4 h-4 text-green-500" /> Acesso Imediato
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                <Award className="w-4 h-4 text-green-500" /> Certificado de Excelência
             </div>
          </div>
        </div>
      </section>

      {/* 7.1 GUARANTEE SECTION */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-[3rem] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 text-center md:text-left relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] -z-10 group-hover:bg-orange-600/10 transition-colors" />
          <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-transparent rounded-full flex items-center justify-center relative">
             <div className="absolute inset-0 bg-orange-600/20 rounded-full animate-ping opacity-20" />
             <div className="w-full h-full border-4 border-orange-600 border-dashed rounded-full absolute animate-[spin_10s_linear_infinite]" />
             <ShieldCheck className="w-20 h-20 md:w-28 md:h-28 text-orange-600 relative z-10" />
          </div>
          <div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">7 Dias de Garantia <span className="text-orange-500 underline decoration-orange-500/20">Incondicional</span></h2>
            <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
              O risco é todo nosso. Use a plataforma por 7 dias. Se você não achar que é o melhor investimento para sua aprovação, peça seu dinheiro de volta com um clique. Devolvemos 100%, sem burocracia e sem perguntas.
            </p>
          </div>
        </div>
      </section>

      {/* 8. CTA FINAL */}
      <section className="py-32 px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-orange-600/5 blur-[150px] rounded-full -z-10"></div>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-12 leading-tight">
            Você pode continuar estudando no escuro…<br/>
            ou começar agora com estratégia.
          </h2>
          <button 
            onClick={() => onStart('ANNUAL')}
            className="group relative inline-flex items-center gap-4 bg-orange-600 hover:bg-orange-500 text-white px-16 py-8 rounded-2xl font-black text-3xl shadow-[0_20px_60px_-15px_rgba(234,88,12,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            QUERO SER APROVADO
            <ArrowRight className="w-8 h-8 group-hover:translate-x-3 transition-transform" />
          </button>
          <p className="mt-12 text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] bg-white/5 inline-block px-6 py-2 rounded-full border border-white/5">
             Garantia de 7 dias ou seu dinheiro de volta. Sem perguntas.
          </p>
        </div>
      </section>

      {/* FAQ SECTION - Adicional Necessário */}
      <section className="py-32 px-6 bg-slate-900/20">
         <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-center mb-16 uppercase tracking-widest text-slate-500">Perguntas Frequentes</h2>
            <div className="space-y-4">
               <FAQItem question="Preciso instalar o app no celular?" answer="Não! O Aprova Elite é uma PWA, você acessa pelo navegador de qualquer dispositivo (PC ou Celular) e ele funciona como um app nativo." />
               <FAQItem question="Como funciona a correção de redação?" answer="Basta digitar sua redação ou enviar o tema. Nossa IA analisa gramática, estrutura e conteúdo com base nos critérios da banca (Vunesp, FGV, etc) e te dá a nota e feedback na hora." />
               <FAQItem question="O acesso é vitalício?" answer="O plano anual concede 12 meses de acesso a todas as atualizações e novas questões. Você pode renovar com desconto após esse período." />
               <FAQItem question="E se eu não gostar?" answer="Você tem 7 dias de garantia incondicional. Se não se adaptar ao método, devolvemos 100% do seu investimento." />
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center text-slate-600 text-sm">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-black italic">Aprova Elite IA</span>
            </div>
            <p>&copy; 2026 Aprova Elite IA - Treinamento de Alto Rendimento. Todos os direitos reservados.</p>
            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-700">
               <a href="#" className="hover:text-white">Termos</a>
               <a href="#" className="hover:text-white">Privacidade</a>
               <a href="#" className="hover:text-white">Suporte</a>
            </div>
         </div>
      </footer>
    </div>
  );
};

const BulletItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3 text-slate-300 font-bold text-sm bg-white/5 px-5 py-2.5 rounded-xl border border-white/5">
    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
    {text}
  </div>
);

const FeatureCard = ({ icon, title, description }: any) => (
  <div className="bg-slate-900/50 p-10 rounded-[2.5rem] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-2 group shadow-2xl">
    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center mb-8 border border-white/5 group-hover:bg-orange-500/10 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-black mb-4 group-hover:text-orange-500 transition-colors">{title}</h3>
    <p className="text-slate-400 leading-relaxed text-sm">{description}</p>
  </div>
);

const CheckItem = ({ text }: { text: string }) => (
  <li className="flex items-start gap-4 text-white font-bold group">
    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
    <span className="text-lg tracking-tight">{text}</span>
  </li>
);

const Testimonial = ({ name, text, role }: any) => (
  <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/5 hover:border-orange-500/20 transition-all flex flex-col justify-between group">
    <div>
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-1">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-orange-500 text-orange-500" />)}
        </div>
        <div className="flex items-center gap-1 bg-green-600/10 px-2 py-0.5 rounded-full border border-green-500/20">
           <ShieldCheck className="w-3 h-3 text-green-500" />
           <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Verificado</span>
        </div>
      </div>
      <p className="text-slate-300 italic text-lg leading-relaxed mb-8 group-hover:text-white transition-colors">"{text}"</p>
    </div>
    <div className="flex items-center gap-4 border-t border-white/5 pt-6 mt-4">
      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl font-bold shadow-xl border border-white/5">👮‍♂️</div>
      <div>
        <p className="font-black text-white text-sm">{name}</p>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{role}</p>
      </div>
    </div>
  </div>
);

const Step = ({ number, text }: any) => (
  <div className="flex items-center gap-6 md:gap-10 p-4 md:p-8 rounded-3xl bg-slate-950 border border-white/5 hover:bg-slate-900 transition-all group">
    <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl bg-orange-600 flex items-center justify-center text-3xl md:text-4xl font-black italic shadow-2xl group-hover:scale-110 transition-transform">
      {number}
    </div>
    <p className="text-xl md:text-3xl font-black tracking-tight leading-tight">{text}</p>
  </div>
);

const FAQItem = ({ question, answer }: any) => {
   const [isOpen, setIsOpen] = React.useState(false);
   return (
      <div className="border-b border-white/5 overflow-hidden">
         <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-full py-6 flex items-center justify-between text-left group"
         >
            <span className="text-lg md:text-xl font-bold group-hover:text-orange-500 transition-colors pr-8">{question}</span>
            <ArrowRight className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-90 text-orange-500' : 'text-slate-700'}`} />
         </button>
         <motion.div 
            initial={false}
            animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
            className="overflow-hidden"
         >
            <p className="pb-8 text-slate-400 text-lg leading-relaxed">{answer}</p>
         </motion.div>
      </div>
   );
};

const Countdown = () => {
  const [time, setTime] = useState({ hours: 0, minutes: 47, seconds: 12 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-mono text-white ml-1">
      {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
    </span>
  );
};
