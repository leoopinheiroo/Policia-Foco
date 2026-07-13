import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StructuredCommentary } from './StructuredCommentary';
import { Question, SimuladoResult } from '../types';
import { SUBJECTS } from '../constants';
import { generateQuestionsForSubject } from '../services/geminiService';
import { apiFetch } from '../services/apiClient';

type SimuladoState = 'CONFIG' | 'LOADING' | 'RUNNING' | 'RESULT';

interface SimuladosProps {
  userEmail: string;
}

const PREFETCH_BATCH = 2;
/** Timeout por request — 1–2 questões; se estourar, cancela e tenta de novo. */
const BATCH_TIMEOUT_MS = 22_000;

export const Simulados: React.FC<SimuladosProps> = ({ userEmail }) => {
  const [state, setState] = useState<SimuladoState>('CONFIG');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examLength, setExamLength] = useState<60 | 120>(60);
  const [loadingProgress, setLoadingProgress] = useState({ ready: 0, total: 60, label: '' });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [result, setResult] = useState<SimuladoResult | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isWaitingNext, setIsWaitingNext] = useState(false);
  const [targetLength, setTargetLength] = useState(60);

  const questionsRef = useRef<Question[]>([]);
  const planRef = useRef<string[]>([]);
  const prefetchingRef = useRef(false);
  const activeSessionRef = useRef(0);
  const currentIndexRef = useRef(0);
  const loopGenRef = useRef(0);
  const stateRef = useRef<SimuladoState>('CONFIG');

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    currentIndexRef.current = currentQIndex;
  }, [currentQIndex]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  /** Plano round-robin: lista de matérias com tamanho = examLength. */
  const buildSubjectPlan = (subjectIds: string[], total: number): string[] => {
    const subjects = SUBJECTS.filter(s => subjectIds.includes(s.id));
    if (!subjects.length) return [];
    const plan: string[] = [];
    for (let i = 0; i < total; i++) {
      plan.push(subjects[i % subjects.length].name);
    }
    // Embaralha levemente mantendo distribuição
    for (let i = plan.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [plan[i], plan[j]] = [plan[j], plan[i]];
    }
    return plan;
  };

  const appendUnique = (list: Question[], incoming: Question[]): Question[] => {
    const next = [...list];
    for (const q of incoming) {
      const dup = next.some(c => (c.id && c.id === q.id) || (c.texto && q.texto && c.texto === q.texto));
      if (!dup) next.push(q);
    }
    return next;
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  /** Busca lote com timeout — se estourar ou vier duplicata, tenta de novo. */
  const fetchBatchWithRetry = async (
    subjectName: string,
    needed: number,
    sessionId: number
  ): Promise<Question[]> => {
    let attempt = 0;
    while (activeSessionRef.current === sessionId) {
      attempt += 1;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        setLoadingProgress({
          ready: questionsRef.current.length,
          total: planRef.current.length,
          label: `${subjectName} · tentativa ${attempt}`,
        });

        const batch = await generateQuestionsForSubject(
          subjectName,
          Math.min(PREFETCH_BATCH, needed),
          { signal: controller.signal }
        );
        window.clearTimeout(timer);

        if (Array.isArray(batch) && batch.length > 0) {
          // Só aceita se acrescentar algo novo ao buffer atual
          const fresh = appendUnique([], batch).filter(q => {
            const dup = questionsRef.current.some(
              c => (c.id && c.id === q.id) || (c.texto && q.texto && c.texto === q.texto)
            );
            return !dup;
          });
          if (fresh.length > 0) return fresh.slice(0, needed);
          console.warn(`[Simulado] Lote só com duplicatas (${subjectName}) #${attempt} — regenerando`);
        } else {
          console.warn(`[Simulado] Lote vazio (${subjectName}) #${attempt} — retry`);
        }
      } catch (e: any) {
        window.clearTimeout(timer);
        const elapsed = Date.now() - startedAt;
        const timedOut = controller.signal.aborted || elapsed >= BATCH_TIMEOUT_MS;
        console.warn(
          `[Simulado] ${timedOut ? 'Timeout' : 'Erro'} em ${subjectName} #${attempt}:`,
          e?.message || e
        );
      }

      await sleep(700);
    }
    return [];
  };

  /**
   * Loop único até completar o plano.
   * Cursor = questions.length (sem planIndex que dessincroniza).
   * Watchdog reinicia se o loop morrer.
   */
  const continuePrefetch = useCallback(async (sessionId: number) => {
    if (prefetchingRef.current) return;
    if (activeSessionRef.current !== sessionId) return;
    if (questionsRef.current.length >= planRef.current.length) return;

    prefetchingRef.current = true;
    const myLoop = ++loopGenRef.current;
    setIsPrefetching(true);

    try {
      while (
        activeSessionRef.current === sessionId &&
        myLoop === loopGenRef.current &&
        questionsRef.current.length < planRef.current.length
      ) {
        const before = questionsRef.current.length;
        const remaining = planRef.current.length - before;
        const take = Math.min(PREFETCH_BATCH, remaining);
        // Próximas matérias do plano na ordem das vagas ainda vazias
        const subjectsSlice = planRef.current.slice(before, before + take);

        const bySubject = new Map<string, number>();
        for (const name of subjectsSlice) {
          bySubject.set(name, (bySubject.get(name) || 0) + 1);
        }

        let added = 0;
        for (const [name, count] of bySubject) {
          if (activeSessionRef.current !== sessionId || myLoop !== loopGenRef.current) break;
          const batch = await fetchBatchWithRetry(name, count, sessionId);
          if (!batch.length) continue;

          const merged = appendUnique(questionsRef.current, batch).slice(0, planRef.current.length);
          const grew = merged.length - questionsRef.current.length;
          if (grew > 0) {
            questionsRef.current = merged;
            setQuestions([...merged]);
            added += grew;
            setLoadingProgress({
              ready: merged.length,
              total: planRef.current.length,
              label: `Gerando ${merged.length}/${planRef.current.length}`,
            });
          }
        }

        if (activeSessionRef.current !== sessionId || myLoop !== loopGenRef.current) break;

        if (added === 0) {
          // Sem progresso: troca a matéria e tenta de novo
          const fallback =
            planRef.current[(questionsRef.current.length + 1) % planRef.current.length] ||
            planRef.current[0];
          console.warn('[Simulado] Sem progresso — fallback', fallback);
          const batch = await fetchBatchWithRetry(fallback, 1, sessionId);
          if (batch.length) {
            const merged = appendUnique(questionsRef.current, batch).slice(0, planRef.current.length);
            questionsRef.current = merged;
            setQuestions([...merged]);
            setLoadingProgress({
              ready: merged.length,
              total: planRef.current.length,
              label: `Gerando ${merged.length}/${planRef.current.length}`,
            });
          } else {
            await sleep(1500);
          }
        }
      }
    } catch (e) {
      console.error('[Simulado] Prefetch interrompido:', e);
    } finally {
      if (myLoop === loopGenRef.current) {
        prefetchingRef.current = false;
        setIsPrefetching(false);
      }
    }
  }, []);

  // Watchdog: se a sessão está ativa e incompleta sem loop rodando, reinicia
  useEffect(() => {
    const id = window.setInterval(() => {
      const sessionId = activeSessionRef.current;
      if (!sessionId) return;
      if (stateRef.current !== 'RUNNING' && stateRef.current !== 'LOADING') return;
      if (questionsRef.current.length >= planRef.current.length) return;
      if (prefetchingRef.current) return;
      console.warn('[Simulado] Watchdog reiniciando geração', {
        ready: questionsRef.current.length,
        total: planRef.current.length,
      });
      void continuePrefetch(sessionId);
    }, 6000);
    return () => window.clearInterval(id);
  }, [continuePrefetch]);

  const startSimulado = async () => {
    if (selectedSubjects.length === 0) {
      alert('Selecione pelo menos uma matéria para o treinamento.');
      return;
    }

    const sessionId = Date.now();
    activeSessionRef.current = sessionId;
    prefetchingRef.current = false;
    loopGenRef.current += 1;

    const plan = buildSubjectPlan(selectedSubjects, examLength);
    planRef.current = plan;
    questionsRef.current = [];
    setQuestions([]);
    setAnswers({});
    setCurrentQIndex(0);
    setTargetLength(examLength);
    setIsWaitingNext(false);
    setState('LOADING');
    setLoadingProgress({ ready: 0, total: examLength, label: 'Primeiras questões' });

    try {
      const firstSubjects = plan.slice(0, PREFETCH_BATCH);
      const bySubject = new Map<string, number>();
      for (const name of firstSubjects) {
        bySubject.set(name, (bySubject.get(name) || 0) + 1);
      }

      let initial: Question[] = [];
      let bootAttempt = 0;
      while (initial.length < Math.min(2, examLength) && bootAttempt < 10 && activeSessionRef.current === sessionId) {
        bootAttempt += 1;
        for (const [name, count] of bySubject) {
          if (initial.length >= 2) break;
          setLoadingProgress({
            ready: initial.length,
            total: examLength,
            label: `${name} (início #${bootAttempt})`,
          });
          const batch = await fetchBatchWithRetry(name, count, sessionId);
          initial = appendUnique(initial, batch);
        }
        if (initial.length === 0) {
          await sleep(1500);
        }
      }

      if (activeSessionRef.current !== sessionId) return;
      if (initial.length === 0) {
        throw new Error('Não foi possível gerar as primeiras questões. Tente novamente.');
      }

      questionsRef.current = initial;
      setQuestions(initial);
      setState('RUNNING');
      window.scrollTo(0, 0);
      void continuePrefetch(sessionId);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao conectar com o banco de questões. Tente novamente.');
      setState('CONFIG');
    }
  };

  const handleAnswer = (optionIdx: number) => {
    const q = questionsRef.current[currentQIndex];
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: optionIdx }));
  };

  const goNext = async () => {
    if (currentQIndex < questionsRef.current.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      window.scrollTo(0, 0);
      void continuePrefetch(activeSessionRef.current);
      return;
    }

    // Faltam questões: espera sem desistir, reativando o prefetch
    if (questionsRef.current.length < targetLength) {
      setIsWaitingNext(true);
      const started = questionsRef.current.length;
      const sessionId = activeSessionRef.current;

      for (let i = 0; i < 180; i++) {
        void continuePrefetch(sessionId);
        await new Promise(r => setTimeout(r, 1000));
        if (questionsRef.current.length > started) {
          setCurrentQIndex(started);
          setIsWaitingNext(false);
          window.scrollTo(0, 0);
          void continuePrefetch(sessionId);
          return;
        }
        setLoadingProgress({
          ready: questionsRef.current.length,
          total: targetLength,
          label: `Aguardando próxima… (${i + 1}s)`,
        });
      }

      // Ainda sem sucesso após ~3 min: continua tentando em background, sem alert bloqueante
      setIsWaitingNext(false);
      void continuePrefetch(sessionId);
      return;
    }

    await finishSimulado();
  };

  const finishSimulado = async () => {
    const finalQuestions = questionsRef.current;
    let correct = 0;
    finalQuestions.forEach(q => {
      if (answers[q.id] === q.correta) correct++;
    });

    const percentage = Math.round((correct / Math.max(1, finalQuestions.length)) * 100);
    const subjectsNames = SUBJECTS.filter(s => selectedSubjects.includes(s.id)).map(s => s.name);

    const newResult: SimuladoResult = {
      totalQuestions: finalQuestions.length,
      correctCount: correct,
      answers,
      questions: finalQuestions,
      date: new Date().toLocaleDateString(),
    };

    setResult(newResult);
    setState('RESULT');
    window.scrollTo(0, 0);
    activeSessionRef.current = 0;

    try {
      await apiFetch('/api/user/simulados/save', {
        method: 'POST',
        body: JSON.stringify({
          score_percentage: percentage,
          correct_count: correct,
          total_questions: finalQuestions.length,
          subjects: subjectsNames,
        }),
      });
    } catch (e) {
      console.error('Erro ao salvar resultado do simulado:', e);
    }
  };

  if (state === 'CONFIG') {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in min-w-0">
        <div className="bg-slate-900 rounded-3xl sm:rounded-[3rem] p-6 sm:p-12 text-white mb-6 sm:mb-10 shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter mb-3 sm:mb-4">Simulado de Elite</h2>
          <p className="text-slate-400 font-medium text-sm sm:text-lg">
            Personalize seu treinamento. Começa em segundos e vai gerando todas as questões em segundo plano até o fim — mesmo sem você avançar.
          </p>
        </div>

        <div className="bg-white rounded-3xl sm:rounded-[3rem] shadow-xl border border-slate-200 p-5 sm:p-10 mb-6 sm:mb-8">
          <h3 className="font-black text-slate-900 mb-6 sm:mb-8 uppercase text-[10px] sm:text-xs tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full shrink-0"></span> 1. Disciplinas ({selectedSubjects.length})
          </h3>
          <div className="space-y-8 sm:space-y-10">
            {[
              { id: 'BASICAS', label: 'Disciplinas Básicas' },
              { id: 'HUMANAS', label: 'Humanas e Complementares' },
              { id: 'JURIDICAS', label: 'Tronco Jurídico' },
              { id: 'ESPECIFICAS', label: 'Específicas e Técnicas' },
            ].map(cat => (
              <div key={cat.id} className="space-y-3 sm:space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{cat.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {SUBJECTS.filter(s => s.category === cat.id).map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => toggleSubject(sub.id)}
                      className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all min-w-0
                        ${selectedSubjects.includes(sub.id)
                          ? 'border-yellow-500 bg-yellow-50 text-slate-900 font-bold'
                          : 'border-slate-100 text-slate-400 hover:border-slate-200'
                        }
                      `}
                    >
                      <span className="text-2xl sm:text-3xl shrink-0">{sub.icon}</span>
                      <span className="text-xs sm:text-sm uppercase font-black tracking-tight break-words">{sub.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 sm:mt-8 flex flex-wrap gap-4 sm:gap-6">
            <button onClick={() => setSelectedSubjects(SUBJECTS.map(s => s.id))} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest border-b border-transparent hover:border-slate-900 transition-all">Selecionar Todas</button>
            <button onClick={() => setSelectedSubjects([])} className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest border-b border-transparent hover:border-red-600 transition-all">Limpar</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl sm:rounded-[3rem] shadow-xl border border-slate-200 p-5 sm:p-10 mb-8 sm:mb-12">
          <h3 className="font-black text-slate-900 mb-6 sm:mb-8 uppercase text-[10px] sm:text-xs tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full shrink-0"></span> 2. Volume de Fogo
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
            <button
              onClick={() => setExamLength(60)}
              className={`flex-1 py-4 sm:py-6 rounded-2xl sm:rounded-3xl border-2 font-black text-sm sm:text-base transition-all
                ${examLength === 60 ? 'border-slate-900 bg-slate-900 text-white shadow-2xl' : 'border-slate-100 text-slate-300 hover:border-slate-200'}
              `}
            >
              60 QUESTÕES
            </button>
            <button
              onClick={() => setExamLength(120)}
              className={`flex-1 py-4 sm:py-6 rounded-2xl sm:rounded-3xl border-2 font-black text-sm sm:text-base transition-all
                ${examLength === 120 ? 'border-slate-900 bg-slate-900 text-white shadow-2xl' : 'border-slate-100 text-slate-300 hover:border-slate-200'}
              `}
            >
              120 QUESTÕES
            </button>
          </div>
          {selectedSubjects.length > 0 && (
            <p className="mt-4 sm:mt-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
              Média: {Math.floor(examLength / selectedSubjects.length)} questões por matéria · gera 2 a 2 até completar
            </p>
          )}
        </div>

        <button
          onClick={startSimulado}
          className="w-full py-5 sm:py-8 bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-lg sm:text-2xl font-black rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          INICIAR SIMULADO →
        </button>
      </div>
    );
  }

  if (state === 'LOADING') {
    return (
      <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center animate-pulse">
        <div className="w-24 h-24 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-10"></div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 text-center">PREPARANDO AS PRIMEIRAS QUESTÕES...</h2>
        <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.3em] text-center">
          Em segundos você já começa — o resto carrega em segundo plano
        </p>
        <p className="text-yellow-600 font-black uppercase text-xs tracking-[0.3em] mt-4">
          {loadingProgress.label}
        </p>
      </div>
    );
  }

  if (state === 'RUNNING') {
    const q = questions[currentQIndex];
    const loaded = questions.length;
    const atLastLoaded = currentQIndex >= loaded - 1;
    const stillGenerating = loaded < targetLength;
    const canFinish = atLastLoaded && !stillGenerating;

    if (!q) {
      return (
        <div className="max-w-4xl mx-auto min-h-[40vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-6"></div>
          <p className="font-black text-slate-500 uppercase text-xs tracking-widest">Carregando item...</p>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto pb-32 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 sticky top-0 bg-slate-50/90 backdrop-blur-md py-6 z-30 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest">
              ITEM {currentQIndex + 1} / {targetLength}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Carregadas: {loaded}
              {isPrefetching ? ' · gerando +2 (máx 15s)...' : ''}
            </span>
            <div className="h-1.5 w-40 sm:w-48 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${((currentQIndex + 1) / targetLength) * 100}%` }}
              ></div>
            </div>
          </div>
          <button onClick={finishSimulado} className="bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
            Encerrar Simulado
          </button>
        </div>

        <div className="bg-white rounded-3xl sm:rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[400px] sm:min-h-[500px] flex flex-col">
          <div className="bg-slate-50 px-4 sm:px-10 py-4 sm:py-6 border-b border-slate-200 flex justify-between items-center gap-3">
            <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] truncate min-w-0">{q.materia} &bull; {q.assunto}</span>
            <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500 shrink-0">{q.banca} {q.ano}</span>
          </div>
          <div className="p-5 sm:p-8 md:p-16 flex-1 max-w-4xl mx-auto w-full min-w-0">
            <p className="text-base sm:text-xl md:text-2xl text-slate-900 font-bold leading-relaxed mb-6 sm:mb-10 tracking-tight break-words">{q.texto}</p>
            <div className="space-y-3 sm:space-y-4">
              {q.alternativas.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full text-left p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[1.5rem] border-2 transition-all flex items-start gap-3 sm:gap-5 min-w-0
                    ${answers[q.id] === idx
                      ? 'border-slate-900 bg-slate-900 text-white shadow-2xl'
                      : 'border-slate-100 hover:border-yellow-500/30 hover:bg-slate-50 text-slate-600'
                    }
                  `}
                >
                  <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${answers[q.id] === idx ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                    {q.tipo === 'CERTO_ERRADO' ? (alt.toLowerCase().includes('certo') ? 'C' : 'E') : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-sm sm:text-base md:text-lg font-medium pt-1 leading-relaxed break-words min-w-0">{alt}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-10 bg-white border-t border-slate-100 flex justify-between items-center gap-2 sm:gap-3">
            <button
              onClick={() => { setCurrentQIndex(prev => Math.max(0, prev - 1)); window.scrollTo(0, 0); }}
              disabled={currentQIndex === 0}
              className="px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-black text-slate-400 border border-slate-200 disabled:opacity-10 text-[10px] sm:text-xs uppercase tracking-widest"
            >
              ← Anterior
            </button>
            {canFinish ? (
              <button
                onClick={finishSimulado}
                className="bg-green-600 text-white px-5 sm:px-12 py-3 sm:py-5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-green-700 shadow-xl"
              >
                Finalizar ✓
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={isWaitingNext}
                className="bg-slate-900 text-white px-5 sm:px-12 py-3 sm:py-5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl disabled:opacity-60"
              >
                {isWaitingNext ? 'GERANDO PRÓXIMA…' : atLastLoaded && stillGenerating ? 'PRÓXIMA (GERANDO) →' : 'Próximo Item →'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-2 justify-center">
          {Array.from({ length: targetLength }).map((_, idx) => {
            const loadedQ = questions[idx];
            const answered = loadedQ && answers[loadedQ.id] !== undefined;
            return (
              <button
                key={idx}
                disabled={!loadedQ}
                onClick={() => { if (loadedQ) { setCurrentQIndex(idx); window.scrollTo(0, 0); } }}
                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all border
                  ${!loadedQ
                    ? 'bg-slate-50 border-dashed border-slate-200 text-slate-200 cursor-default'
                    : idx === currentQIndex
                      ? 'border-yellow-500 bg-yellow-500 text-slate-950 scale-110 shadow-lg'
                      : answered
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-300'
                  }
                `}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (state === 'RESULT' && result) {
    const percentage = Math.round((result.correctCount / result.totalQuestions) * 100);
    return (
      <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
        <div className="bg-white rounded-3xl sm:rounded-[4rem] shadow-2xl border border-slate-200 p-6 sm:p-16 text-center mb-8 sm:mb-12">
          <h2 className="text-sm sm:text-2xl font-black text-slate-400 uppercase tracking-wider sm:tracking-[0.3em] mb-4">Relatório de Performance</h2>
          <div className={`text-6xl sm:text-9xl font-black mb-4 sm:mb-6 tracking-tighter ${percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
            {percentage}%
          </div>
          <p className="text-slate-900 text-base sm:text-2xl font-bold mb-6 sm:mb-10 px-2">
            Aproveitamento: {result.correctCount} / {result.totalQuestions} acertos.
          </p>
          <div className="w-full bg-slate-100 h-3 sm:h-4 rounded-full overflow-hidden mb-8 sm:mb-12">
            <div className={`h-full transition-all duration-1000 ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }}></div>
          </div>
          <button onClick={() => setState('CONFIG')} className="w-full sm:w-auto bg-slate-900 text-white px-8 sm:px-14 py-4 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl">
            Novo Simulado Personalizado
          </button>
        </div>

        <div className="space-y-6">
          <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.2em] mb-8">Revisão Técnica de Itens</h3>
          {result.questions.map((q, idx) => {
            const userAnswer = result.answers[q.id];
            const isCorrect = userAnswer === q.correta;
            return (
              <div key={idx} className={`bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transition-all ${!isCorrect ? 'border-red-100' : 'border-green-100'}`}>
                <div className={`px-8 py-3 font-black text-[9px] uppercase tracking-widest flex justify-between ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span>ITEM {idx + 1} &bull; {q.materia}</span>
                  <span>{isCorrect ? 'GABARITO CONFIRMADO ✓' : 'ERRO IDENTIFICADO ✕'}</span>
                </div>
                <div className="p-10">
                  <p className="text-lg font-bold text-slate-800 mb-6">{q.texto}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className={`p-4 rounded-2xl border ${isCorrect ? 'bg-green-50/30 border-green-200 text-green-900' : 'bg-red-50/30 border-red-200 text-red-900'}`}>
                      <span className="block text-[8px] font-black uppercase mb-1 opacity-50">Sua Marcação:</span>
                      <span className="font-bold">{userAnswer !== undefined ? q.alternativas[userAnswer] : 'ITEM EM BRANCO'}</span>
                    </div>
                    <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200 text-slate-900">
                      <span className="block text-[8px] font-black uppercase mb-1 opacity-50">Gabarito Oficial:</span>
                      <span className="font-bold">{q.alternativas[q.correta]}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                    <h4 className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] mb-6">Análise Técnica do Especialista IA:</h4>
                    <StructuredCommentary text={q.comentario} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
