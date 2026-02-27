
import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ViewState } from './types';
import { SUBJECTS, MOCK_QUESTIONS } from './constants';
import { QuestionRunner } from './components/QuestionRunner';
import { EssayCorrection } from './components/EssayCorrection';
import { Dashboard } from './components/Dashboard';
import { Simulados } from './components/Simulados';
import { Flashcards } from './components/Flashcards';
import { VadeMecum } from './components/VadeMecum';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { Checkout } from './components/Checkout';

const App: React.FC = () => {
  // Estado de autenticação persistente
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('PF_LOGGED') === 'true');
  const [isPaid, setIsPaid] = useState(false); // Default to false, check from backend
  const [isGuest, setIsGuest] = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('PF_USER_EMAIL') || '');
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  const [currentView, setCurrentView] = useState<ViewState>('LANDING');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const checkUserStatus = async (email: string) => {
    if (!email) {
      setIsCheckingStatus(false);
      return;
    }
    try {
      const response = await fetch(`/api/user/status?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.status === 'active') {
        setIsPaid(true);
        // Só redireciona para a HOME se o usuário estiver em telas de transição
        if (currentView === 'LOGIN' || currentView === 'SIGNUP' || currentView === 'CHECKOUT') {
          setCurrentView('HOME');
        }
      } else {
        setIsPaid(false);
        // NÃO redirecionamos automaticamente para o CHECKOUT aqui para permitir ver a Landing Page
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    // Handle Stripe Success Redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success' && params.get('session_id')) {
      const email = localStorage.getItem('PF_USER_EMAIL');
      if (email) checkUserStatus(email);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (isLoggedIn && !isGuest && userEmail) {
      checkUserStatus(userEmail);
    } else {
      setIsCheckingStatus(false);
    }
  }, [isLoggedIn, isGuest, userEmail]);

  useEffect(() => {
    if (!isGuest) {
      localStorage.setItem('PF_LOGGED', isLoggedIn.toString());
      localStorage.setItem('PF_USER_EMAIL', userEmail);
    }
  }, [isLoggedIn, isGuest, userEmail]);

  const activeSubject = useMemo(() => 
    SUBJECTS.find(s => s.id === selectedSubjectId), 
  [selectedSubjectId]);

  const handleSubjectClick = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedTopic(null);
    setCurrentView('TOPICS');
    window.scrollTo(0, 0);
  };

  const handleTopicClick = (topic: string) => {
    setSelectedTopic(topic);
    setCurrentView('QUESTIONS');
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsPaid(false);
    setIsGuest(false);
    localStorage.removeItem('PF_LOGGED');
    localStorage.removeItem('PF_PAID');
    setCurrentView('LANDING');
  };

  const handleGuestAccess = () => {
    setIsGuest(true);
    setIsLoggedIn(true);
    setIsPaid(true); 
    setCurrentView('HOME');
  };

  const handleAuthSuccess = (email: string) => {
    setIsLoggedIn(true);
    setIsGuest(false);
    setUserEmail(email);
    localStorage.setItem('PF_LOGGED', 'true');
    localStorage.setItem('PF_USER_EMAIL', email);
    
    // Ao logar ou cadastrar, verificamos o status e aí sim decidimos se vai para Checkout ou Home
    fetch(`/api/user/status?email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'active') {
          setIsPaid(true);
          setCurrentView('HOME');
        } else {
          setIsPaid(false);
          setCurrentView('CHECKOUT');
        }
      });
  };

  const handleStart = (plan: 'MONTHLY' | 'ANNUAL') => {
    setSelectedPlan(plan);
    setCurrentView('SIGNUP');
  };

  const renderPlatformContent = () => {
    switch (currentView) {
      case 'HOME':
        return (
          <div className="space-y-16 animate-fade-in">
            <header className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-[4rem] p-12 md:p-20 text-white shadow-2xl relative overflow-hidden border border-slate-800">
               <div className="relative z-10 max-w-4xl">
                  {isGuest && (
                    <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-6 border border-blue-500/30">
                       MODO VISITANTE ATIVADO
                    </div>
                  )}
                  <div className="inline-flex items-center gap-3 bg-yellow-500/10 text-yellow-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-10 border border-yellow-500/20">
                     <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                     TREINAMENTO OPERACIONAL DE ELITE
                  </div>
                  <h1 className="text-6xl md:text-7xl font-black mb-10 tracking-tighter leading-tight">
                    DOMINE O <span className="text-yellow-500">EDITAL</span>.
                  </h1>
                  <p className="text-slate-400 text-xl leading-relaxed mb-14 max-w-2xl font-light">
                    {isGuest ? 'Você está em modo de demonstração. Explore todas as 24 disciplinas obrigatórias e sinta o poder da nossa IA.' : 'Bem-vindo, Leonardo. Todas as 24 disciplinas obrigatórias estão prontas para o seu treinamento infinito.'}
                  </p>
                  <button 
                      onClick={() => setCurrentView('SUBJECTS')}
                      className="bg-yellow-500 text-slate-950 px-14 py-7 rounded-[2rem] font-black text-2xl hover:bg-yellow-400 shadow-2xl transition-all"
                  >
                      ACESSAR DISCIPLINAS →
                  </button>
               </div>
               <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />
            </header>

            <section>
              <div className="flex items-end justify-between mb-12">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Seu Arsenal de Estudo</h2>
                    <p className="text-slate-400 font-medium">Selecione uma matéria para iniciar a geração infinita de questões.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {SUBJECTS.slice(0, 12).map(sub => (
                  <button 
                    key={sub.id}
                    onClick={() => handleSubjectClick(sub.id)}
                    className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100 hover:border-yellow-500 transition-all text-left flex items-center gap-6 group"
                  >
                    <span className="text-5xl group-hover:scale-110 transition-transform">{sub.icon}</span>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg group-hover:text-yellow-600 mb-1">{sub.name}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sub.topics.length} Tópicos</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-12 text-center">
                 <button 
                    onClick={() => setCurrentView('SUBJECTS')}
                    className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.4em] border-b-2 border-slate-200 pb-2 transition-all"
                 >
                    Ver Todas as 24 Matérias
                 </button>
              </div>
            </section>
          </div>
        );

      case 'SUBJECTS':
        return (
          <div className="animate-fade-in space-y-12">
            <div className="border-b pb-8">
               <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Catálogo Completo</h2>
               <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Todas as disciplinas obrigatórias para concursos policiais</p>
            </div>
            
            <div className="space-y-16">
               <SubjectSection title="Básicas e Transversais" items={SUBJECTS.slice(0, 6)} onSubjectClick={handleSubjectClick} />
               <SubjectSection title="Tronco Jurídico" items={SUBJECTS.slice(6, 16)} onSubjectClick={handleSubjectClick} />
               <SubjectSection title="Especializadas e Operacionais" items={SUBJECTS.slice(16)} onSubjectClick={handleSubjectClick} />
            </div>
          </div>
        );

      case 'TOPICS':
        if (!activeSubject) return null;
        return (
          <div className="animate-fade-in max-w-5xl mx-auto">
            <button onClick={() => setCurrentView('SUBJECTS')} className="text-slate-400 hover:text-slate-900 mb-10 text-xs font-black uppercase tracking-widest transition flex items-center gap-2">
              ← Voltar ao Catálogo
            </button>
            <div className="flex items-center gap-10 mb-16 bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl">
              <div className="w-28 h-28 bg-slate-950 rounded-[3rem] flex items-center justify-center text-7xl shadow-2xl">
                {activeSubject.icon}
              </div>
              <div>
                 <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.4em] mb-4">Módulos de Aprendizado</p>
                 <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">{activeSubject.name}</h2>
              </div>
            </div>
            
            <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {activeSubject.topics.map((topic, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleTopicClick(topic)}
                  className="w-full text-left p-12 hover:bg-slate-50 transition-all flex justify-between items-center group"
                >
                  <div className="flex items-center gap-10">
                      <span className="text-slate-200 font-black text-6xl group-hover:text-yellow-500 transition-colors">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="font-black text-slate-800 text-3xl tracking-tighter">{topic}</span>
                  </div>
                  <div className="bg-slate-950 text-white text-xs px-10 py-4 rounded-2xl font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-2xl translate-x-10 group-hover:translate-x-0">
                    ESTUDAR AGORA →
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'QUESTIONS':
        if (!activeSubject || !selectedTopic) return null;
        return (
          <QuestionRunner 
            initialQuestions={MOCK_QUESTIONS}
            subject={activeSubject.name}
            topic={selectedTopic}
            onBack={() => setCurrentView('TOPICS')}
          />
        );

      case 'SIMULADOS': return <Simulados />;
      case 'REDACAO': return <EssayCorrection />;
      case 'DASHBOARD': return <Dashboard />;
      case 'FLASHCARDS': return <Flashcards />;
      case 'VADE_MECUM': return <VadeMecum />;
      default: return <LandingPage onStart={handleStart} onLogin={() => setCurrentView('LOGIN')} onGuestAccess={handleGuestAccess} />;
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-white">
         <div className="w-24 h-24 border-8 border-white/5 border-t-yellow-500 rounded-full animate-spin mb-10"></div>
         <h2 className="text-4xl font-black tracking-tighter mb-4 italic">VERIFICANDO CREDENCIAIS</h2>
         <p className="text-slate-400 max-w-md font-medium uppercase text-[10px] tracking-widest">Aguarde a validação do seu status operacional...</p>
      </div>
    );
  }

  if (isLoggedIn && isPaid) {
    return (
      <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
        <Sidebar 
          currentView={currentView} 
          onChangeView={(view) => {
            setCurrentView(view);
            setSidebarOpen(false);
          }}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          onLogout={handleLogout}
          userType={isGuest ? 'VISITANTE' : 'COMANDANTE'}
        />
        <main className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">
          <div className="md:hidden bg-slate-950 text-white p-6 flex items-center justify-between sticky top-0 z-40 shadow-2xl border-b border-white/5">
             <button onClick={() => setSidebarOpen(true)} className="p-3 border border-white/10 rounded-2xl bg-white/5">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
             <span className="font-black text-xl text-yellow-500 tracking-tighter">PolíciaFoco</span>
             <div className="w-10 h-10 rounded-xl bg-yellow-500 text-slate-950 flex items-center justify-center font-black text-sm">
               {isGuest ? 'VT' : 'LP'}
             </div>
          </div>
          <div className="flex-1 p-6 md:p-16 max-w-[1800px] mx-auto w-full">
            {renderPlatformContent()}
          </div>
        </main>
      </div>
    );
  }

  if (currentView === 'LANDING') return <LandingPage onStart={handleStart} onLogin={() => setCurrentView('LOGIN')} onGuestAccess={handleGuestAccess} />;
  if (currentView === 'LOGIN') return <Auth mode="LOGIN" onAuth={() => setIsLoggedIn(true)} onGoSignup={() => setCurrentView('SIGNUP')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
  if (currentView === 'SIGNUP') return <Auth mode="SIGNUP" onAuth={() => setIsLoggedIn(true)} onGoLogin={() => setCurrentView('LOGIN')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
  if (currentView === 'CHECKOUT') return <Checkout initialPlan={selectedPlan} onPaymentComplete={() => { setIsPaid(true); setCurrentView('HOME'); }} onBack={() => setCurrentView('LANDING')} />;

  return null;
};

const SubjectSection = ({ title, items, onSubjectClick }: any) => (
  <div className="space-y-8">
     <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] px-2">{title}</h3>
     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {items.map((sub: any) => (
          <button 
            key={sub.id}
            onClick={() => onSubjectClick(sub.id)}
            className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-100 hover:border-yellow-500 transition-all flex flex-col items-center text-center gap-5 group"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-5xl group-hover:bg-yellow-50 transition-all">
              {sub.icon}
            </div>
            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-tight leading-tight">{sub.name}</h3>
          </button>
        ))}
     </div>
  </div>
);

export default App;
