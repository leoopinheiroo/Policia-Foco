
import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ViewState } from './types';
import { SUBJECTS } from './constants';
import { QuestionRunner } from './components/QuestionRunner';
import { QuestionFilter } from './components/QuestionFilter';
import { EssayCorrection } from './components/EssayCorrection';
import { Dashboard } from './components/Dashboard';
import { Simulados } from './components/Simulados';
import { Flashcards } from './components/Flashcards';
import { VadeMecum } from './components/VadeMecum';
import { GeniusIA } from './components/GeniusIA';
import { MentoriaIA } from './components/MentoriaIA';
import { MissionControl } from './components/MissionControl';
import { Ranking } from './components/Ranking';
import { Dossier } from './components/Dossier';
import { StudyTimer } from './components/StudyTimer';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { Checkout } from './components/Checkout';
import { Toast, ToastType } from './components/Toast';

import { supabase } from './services/supabase';
import { apiJson } from './services/apiClient';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('PF_USER_NAME') || 'Operador');
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };
  const [isLoading, setIsLoading] = useState(false);

  const [currentView, setCurrentView] = useState<ViewState>('LANDING');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any>(null);

  useEffect(() => {
    localStorage.removeItem('PF_LOGGED');
    localStorage.removeItem('PF_CRED_P');

    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'reset-password') {
      setCurrentView('RESET_PASSWORD');
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          setIsLoggedIn(true);
          setUserEmail(session.user.email || '');
          const metaName = session.user.user_metadata?.full_name;
          if (metaName) setUserName(metaName);
        } else {
          setIsLoggedIn(false);
          setUserEmail('');
          setIsCheckingStatus(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, nextSession: any) => {
          // Evita apagar sessão no evento inicial se getSession já restaurou
          if (event === 'INITIAL_SESSION') {
            if (nextSession?.user) {
              setIsLoggedIn(true);
              setUserEmail(nextSession.user.email || '');
            }
            return;
          }

          if (nextSession?.user) {
            setIsLoggedIn(true);
            setUserEmail(nextSession.user.email || '');
            const metaName = nextSession.user.user_metadata?.full_name;
            if (metaName) setUserName(metaName);
          } else if (event === 'SIGNED_OUT') {
            setIsLoggedIn(false);
            setUserEmail('');
            setIsPaid(false);
            setUserHistory(null);
            setCurrentView('LANDING');
          }
        });
        unsub = () => subscription?.unsubscribe();
      } catch (e) {
        console.error('Supabase Auth Error:', e);
        if (!cancelled) setIsCheckingStatus(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const fetchUserHistory = async () => {
    try {
      const data = await apiJson<{ history: any }>('/api/user/history');
      setUserHistory(data.history);
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    }
  };

  const checkUserStatus = async (opts?: { forceHomeOnActive?: boolean }) => {
    try {
      const data = await apiJson<{ status: string; name?: string }>('/api/user/status');
      if (data.name) setUserName(data.name);
      if (data.status === 'active') {
        setIsPaid(true);
        if (opts?.forceHomeOnActive || ['LOGIN', 'SIGNUP', 'CHECKOUT', 'LANDING'].includes(currentView)) {
          setCurrentView('HOME');
        }
      } else {
        setIsPaid(false);
        // Logado sem assinatura: sempre checkout (inclusive após F5 na landing)
        if (!['LOGIN', 'SIGNUP', 'FORGOT_PASSWORD', 'RESET_PASSWORD'].includes(currentView)) {
          setCurrentView('CHECKOUT');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
      // Se a sessão existe mas o status falhou, ainda assim não jogar na landing
      setIsPaid(false);
      setCurrentView('CHECKOUT');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('status') === 'success';

    if (paymentSuccess) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (isLoggedIn && userEmail) {
      // Após retorno do Stripe, tenta algumas vezes (webhook pode atrasar)
      if (paymentSuccess) {
        let attempts = 0;
        const poll = async () => {
          attempts += 1;
          await checkUserStatus({ forceHomeOnActive: true });
          if (attempts < 6) {
            setTimeout(() => {
              apiJson<{ status: string }>('/api/user/status')
                .then((data) => {
                  if (data.status === 'active') {
                    setIsPaid(true);
                    setCurrentView('HOME');
                    setIsCheckingStatus(false);
                  } else if (attempts < 6) {
                    setTimeout(poll, 2000);
                  }
                })
                .catch(() => {
                  if (attempts < 6) setTimeout(poll, 2000);
                });
            }, 2000);
          }
        };
        poll();
      } else {
        checkUserStatus({ forceHomeOnActive: true });
      }
      fetchUserHistory();
    } else if (!isLoggedIn) {
      setIsCheckingStatus(false);
    }
  }, [isLoggedIn, userEmail]);

  useEffect(() => {
    if (!isCheckingStatus && isLoggedIn && !isPaid && !['CHECKOUT', 'LOGIN', 'SIGNUP', 'FORGOT_PASSWORD', 'RESET_PASSWORD'].includes(currentView)) {
      setCurrentView('CHECKOUT');
    }
  }, [isLoggedIn, isPaid, currentView, isCheckingStatus]);

  useEffect(() => {
    if (userName) localStorage.setItem('PF_USER_NAME', userName);
  }, [userName]);

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
    if (currentView === 'QUESTIONS' && selectedTopic === topic) return;
    setSelectedTopic(topic);
    setFilteredQuestions([]); // Clear filtered questions when going to a specific topic
    setCurrentView('QUESTIONS');
    window.scrollTo(0, 0);
  };

  const handleFilterApply = async (filters: any) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      setCurrentView('QUESTIONS');
      setSelectedTopic('Filtro Personalizado');
      setSelectedSubjectId(null);
      
      const { fetchFilteredQuestions } = await import('./services/geminiService');
      const questions = await fetchFilteredQuestions(filters);
      setFilteredQuestions(questions);
    } catch (error: any) {
      console.error("Erro ao aplicar filtro:", error);
      showToast(error?.message || "Ocorreu um erro ao buscar as questões. Tente novamente.", "error");
      setCurrentView('SUBJECTS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setIsPaid(false);
    setUserEmail('');
    setUserHistory(null);
    setCurrentView('LANDING');
  };

  const handleAuthSuccess = async (email: string, name?: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    if (name) setUserName(name);

    try {
      const data = await apiJson<{ status: string; name?: string }>('/api/user/status');
      if (data.name) setUserName(data.name);
      if (data.status === 'active') {
        setIsPaid(true);
        setCurrentView('HOME');
      } else {
        setIsPaid(false);
        setCurrentView('CHECKOUT');
      }
      await fetchUserHistory();
    } catch {
      setIsPaid(false);
      setCurrentView('CHECKOUT');
    }
  };

  const handleStart = (plan: 'MONTHLY' | 'ANNUAL') => {
    setSelectedPlan(plan);
    if (isLoggedIn) {
      setCurrentView('CHECKOUT');
    } else {
      setCurrentView('SIGNUP');
    }
  };

  const renderPlatformContent = () => {
    switch (currentView) {
      case 'HOME':
        return (
          <div className="space-y-10 sm:space-y-16 animate-fade-in">
            <header className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-3xl sm:rounded-[4rem] p-6 sm:p-12 md:p-20 text-white shadow-2xl relative overflow-hidden border border-slate-800">
               <div className="relative z-10 max-w-4xl">
                  <div className="inline-flex items-center gap-2 sm:gap-3 bg-yellow-500/10 text-yellow-500 px-4 sm:px-6 py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-0.3em mb-6 sm:mb-10 border border-yellow-500/20">
                     <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shrink-0" />
                     <span className="truncate">TREINAMENTO OPERACIONAL DE ELITE</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 sm:mb-10 tracking-tighter leading-tight">
                    DOMINE O <span className="text-yellow-500">EDITAL</span>.
                  </h1>
                  <p className="text-slate-400 text-base sm:text-xl leading-relaxed mb-8 sm:mb-14 max-w-2xl font-light">
                    Bem-vindo, Operador. Todas as 24 disciplinas obrigatórias estão prontas para o seu treinamento infinito.
                  </p>
                  <button 
                      onClick={() => setCurrentView('SUBJECTS')}
                      className="w-full sm:w-auto bg-yellow-500 text-slate-950 px-8 sm:px-14 py-4 sm:py-7 rounded-2xl sm:rounded-[2rem] font-black text-lg sm:text-2xl hover:bg-yellow-400 shadow-2xl transition-all"
                  >
                      ACESSAR DISCIPLINAS →
                  </button>
               </div>
               <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />
            </header>

            <section>
              <div className="flex items-end justify-between mb-6 sm:mb-12">
                <div>
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter mb-2">Seu Arsenal de Estudo</h2>
                    <p className="text-slate-400 font-medium text-sm sm:text-base">Selecione uma matéria para iniciar a geração infinita de questões.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {SUBJECTS.filter(s => s.category === 'BASICAS' || s.category === 'JURIDICAS').slice(0, 12).map(sub => (
                  <button 
                    key={sub.id}
                    onClick={() => handleSubjectClick(sub.id)}
                    className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-lg border border-slate-100 hover:border-yellow-500 transition-all text-left flex items-center gap-4 sm:gap-6 group min-w-0"
                  >
                    <span className="text-3xl sm:text-5xl group-hover:scale-110 transition-transform shrink-0">{sub.icon}</span>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-900 text-base sm:text-lg group-hover:text-yellow-600 mb-1 truncate">{sub.name}</h3>
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
            <div className="border-b pb-6 sm:pb-8">
               <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter">Catálogo Completo</h2>
               <p className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider sm:tracking-[0.3em] mt-2">Todas as disciplinas obrigatórias para concursos policiais</p>
            </div>

            <QuestionFilter onFilter={handleFilterApply} />
            
            <div className="space-y-16">
               <SubjectSection title="Disciplinas Básicas" items={SUBJECTS.filter(s => s.category === 'BASICAS')} onSubjectClick={handleSubjectClick} />
               <SubjectSection title="Humanas e Complementares" items={SUBJECTS.filter(s => s.category === 'HUMANAS')} onSubjectClick={handleSubjectClick} />
               <SubjectSection title="Tronco Jurídico" items={SUBJECTS.filter(s => s.category === 'JURIDICAS')} onSubjectClick={handleSubjectClick} />
               <SubjectSection title="Especializadas e Operacionais" items={SUBJECTS.filter(s => s.category === 'ESPECIFICAS')} onSubjectClick={handleSubjectClick} />
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-10 mb-8 sm:mb-16 bg-white p-5 sm:p-12 rounded-3xl sm:rounded-[3.5rem] border border-slate-200 shadow-2xl">
              <div className="w-16 h-16 sm:w-28 sm:h-28 bg-slate-950 rounded-2xl sm:rounded-[3rem] flex items-center justify-center text-4xl sm:text-7xl shadow-2xl shrink-0">
                {activeSubject.icon}
              </div>
              <div className="min-w-0">
                 <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.4em] mb-2 sm:mb-4">Módulos de Aprendizado</p>
                 <h2 className="text-2xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight sm:leading-none break-words">{activeSubject.name}</h2>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl sm:rounded-[3.5rem] shadow-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {activeSubject.topics.map((topic, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleTopicClick(topic)}
                  className="w-full text-left p-5 sm:p-12 hover:bg-slate-50 transition-all flex justify-between items-center gap-3 group"
                >
                  <div className="flex items-center gap-4 sm:gap-10 min-w-0">
                      <span className="text-slate-200 font-black text-2xl sm:text-6xl group-hover:text-yellow-500 transition-colors shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="font-black text-slate-800 text-base sm:text-3xl tracking-tighter break-words">{topic}</span>
                  </div>
                  <div className="hidden sm:block bg-slate-950 text-white text-xs px-10 py-4 rounded-2xl font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-2xl translate-x-10 group-hover:translate-x-0 shrink-0">
                    ESTUDAR AGORA →
                  </div>
                  <span className="sm:hidden text-slate-400 font-black text-lg shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'QUESTIONS':
        if (!selectedTopic) return null;
        return (
          <QuestionRunner 
            initialQuestions={filteredQuestions}
            subject={activeSubject?.name || 'Filtro'}
            topic={selectedTopic}
            userEmail={userEmail}
            userHistory={userHistory}
            onHistoryChange={fetchUserHistory}
            showToast={showToast}
            onBack={() => {
              setCurrentView(activeSubject ? 'TOPICS' : 'SUBJECTS');
              setFilteredQuestions([]);
            }}
          />
        );

      case 'GENIUS_IA':
        return (
          <GeniusIA 
            userHistory={userHistory} 
            onStartIntensive={async (subject, topic) => {
              if (isLoading) return;
              setIsLoading(true);
              try {
                const { fetchFilteredQuestions } = await import('./services/geminiService');
                const questions = await fetchFilteredQuestions({ 
                  materia: subject,
                  assunto: topic
                }, 20);
                setFilteredQuestions(questions);
                setSelectedTopic(topic ? `Intensivo: ${topic}` : `Intensivo: ${subject}`);
                setSelectedSubjectId(null);
                setCurrentView('QUESTIONS');
              } catch (error: any) {
                console.error("Erro ao gerar treino intensivo:", error);
                showToast(error?.message || "Ocorreu um erro ao gerar as questões. Tente novamente.", "error");
              } finally {
                setIsLoading(false);
              }
            }}
            onReviewQuestion={(question) => {
              setFilteredQuestions([question]);
              setSelectedTopic(`Revisão de Erro`);
              setSelectedSubjectId(null);
              setCurrentView('QUESTIONS');
            }}
          />
        );

      case 'SIMULADOS': return <Simulados userEmail={userEmail} />;
      case 'REDACAO': return <EssayCorrection userEmail={userEmail} />;
      case 'MENTORIA': return <MentoriaIA />;
      case 'MISSION_CONTROL': return (
        <MissionControl
          userHistory={userHistory}
          onProgressSaved={fetchUserHistory}
        />
      );
      case 'RANKING': return <Ranking userName={userName} />;
      case 'DOSSIER':
        return (
          <Dossier 
            userHistory={userHistory} 
            onReviewQuestion={(question) => {
              setFilteredQuestions([question]);
              setSelectedTopic(`Revisão de Dossiê`);
              setSelectedSubjectId(null);
              setCurrentView('QUESTIONS');
            }} 
          />
        );
      case 'DASHBOARD': return <Dashboard />;
      case 'FLASHCARDS': return <Flashcards userEmail={userEmail} />;
      case 'VADE_MECUM': return <VadeMecum />;
      default: return <LandingPage onStart={handleStart} onLogin={() => setCurrentView('LOGIN')} />;
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
          userType="RECRUTA"
          userName={userName}
        />
        <main className="flex-1 md:ml-64 flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-all">
          <div className="md:hidden bg-slate-950 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 shadow-2xl border-b border-white/5">
             <button onClick={() => setSidebarOpen(true)} className="p-2.5 border border-white/10 rounded-xl bg-white/5 shrink-0" aria-label="Abrir menu">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
             <span className="font-black text-base sm:text-xl text-yellow-500 tracking-tighter uppercase italic truncate px-2">Aprova Elite IA</span>
             <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-yellow-500 text-slate-950 flex items-center justify-center font-black text-xs sm:text-sm shadow-lg shadow-yellow-500/20 shrink-0">
               {userName.substring(0, 2).toUpperCase()}
             </div>
          </div>
          <div className="flex-1 px-4 py-5 sm:px-6 sm:py-8 md:p-16 max-w-[1800px] mx-auto w-full min-w-0">
            {renderPlatformContent()}
          </div>

          <StudyTimer />

          {isLoading && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-center p-6 text-white">
              <div className="w-20 h-20 border-4 border-white/10 border-t-yellow-500 rounded-full animate-spin mb-8"></div>
              <h2 className="text-3xl font-black tracking-tighter mb-2 italic">GERANDO TREINAMENTO IA</h2>
              <p className="text-slate-400 max-w-md font-medium uppercase text-[10px] tracking-widest">
                Nossa inteligência está selecionando as melhores questões para o seu perfil...
              </p>
            </div>
          )}
        </main>

        <Toast 
          message={toast.message} 
          type={toast.type} 
          isVisible={toast.isVisible} 
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
      </div>
    );
  }

  // Logado sem plano: nunca voltar para a landing no F5
  if (isLoggedIn && !isPaid) {
    if (currentView === 'LOGIN') return <Auth mode="LOGIN" onAuth={() => setIsLoggedIn(true)} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => setCurrentView('FORGOT_PASSWORD')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
    if (currentView === 'SIGNUP') return <Auth mode="SIGNUP" onAuth={() => setIsLoggedIn(true)} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => setCurrentView('FORGOT_PASSWORD')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
    if (currentView === 'FORGOT_PASSWORD') return <Auth mode="FORGOT_PASSWORD" onAuth={() => {}} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => {}} onSuccess={() => {}} onBack={() => setCurrentView('LOGIN')} />;
    if (currentView === 'RESET_PASSWORD') return <Auth mode="RESET_PASSWORD" onAuth={() => {}} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => {}} onSuccess={() => {}} onBack={() => setCurrentView('LOGIN')} />;
    return <Checkout initialPlan={selectedPlan} onPaymentComplete={() => { setIsPaid(true); setCurrentView('HOME'); }} onBack={() => { supabase.auth.signOut(); setIsLoggedIn(false); setCurrentView('LANDING'); }} />;
  }

  if (currentView === 'LANDING') return <LandingPage onStart={handleStart} onLogin={() => setCurrentView('LOGIN')} />;
  if (currentView === 'LOGIN') return <Auth mode="LOGIN" onAuth={() => setIsLoggedIn(true)} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => setCurrentView('FORGOT_PASSWORD')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
  if (currentView === 'SIGNUP') return <Auth mode="SIGNUP" onAuth={() => setIsLoggedIn(true)} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => setCurrentView('FORGOT_PASSWORD')} onSuccess={handleAuthSuccess} onBack={() => setCurrentView('LANDING')} />;
  if (currentView === 'FORGOT_PASSWORD') return <Auth mode="FORGOT_PASSWORD" onAuth={() => {}} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => {}} onSuccess={() => {}} onBack={() => setCurrentView('LOGIN')} />;
  if (currentView === 'RESET_PASSWORD') return <Auth mode="RESET_PASSWORD" onAuth={() => {}} onGoLogin={() => setCurrentView('LOGIN')} onGoSignup={() => setCurrentView('SIGNUP')} onGoForgot={() => {}} onSuccess={() => {}} onBack={() => setCurrentView('LOGIN')} />;
  if (currentView === 'CHECKOUT') return <Checkout initialPlan={selectedPlan} onPaymentComplete={() => { setIsPaid(true); setCurrentView('HOME'); }} onBack={() => setCurrentView('LANDING')} />;

  // Fallback para evitar tela branca se o estado ficar inconsistente
  return <LandingPage onStart={handleStart} onLogin={() => setCurrentView('LOGIN')} />;
};

// Componente de Erro para evitar tela branca total
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-12 text-white">
          <div className="text-6xl mb-8">⚠️</div>
          <h2 className="text-4xl font-black tracking-tighter mb-4">ALGO DEU ERRADO</h2>
          <p className="text-slate-400 max-w-md font-medium mb-10">
            {this.state.error?.message || 'Ocorreu um erro inesperado na plataforma.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-slate-950 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest"
          >
            Recarregar Plataforma
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

const SubjectSection = ({ title, items, onSubjectClick }: any) => (
  <div className="space-y-4 sm:space-y-8">
     <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.4em] px-1 sm:px-2">{title}</h3>
     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6 md:gap-8">
        {items.map((sub: any) => (
          <button 
            key={sub.id}
            onClick={() => onSubjectClick(sub.id)}
            className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-lg border border-slate-100 hover:border-yellow-500 transition-all flex flex-col items-center text-center gap-3 sm:gap-5 group min-w-0"
          >
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-50 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-3xl sm:text-5xl group-hover:bg-yellow-50 transition-all shrink-0">
              {sub.icon}
            </div>
            <h3 className="font-black text-slate-900 text-[9px] sm:text-[10px] uppercase tracking-tight leading-tight break-words w-full">{sub.name}</h3>
          </button>
        ))}
     </div>
  </div>
);

export default AppWithErrorBoundary;
