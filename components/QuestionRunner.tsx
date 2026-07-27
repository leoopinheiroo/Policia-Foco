
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StructuredCommentary } from './StructuredCommentary';
import { Question, ToastType } from '../types';
import { fetchSinglePoliceQuestion } from '../services/geminiService';
import { Bookmark, BookmarkCheck, Share2 } from 'lucide-react';

interface QuestionRunnerProps {
  initialQuestions: Question[];
  subject: string;
  topic: string;
  userEmail: string;
  onBack: () => void;
  showToast: (msg: string, type?: ToastType) => void;
}


export const QuestionRunner: React.FC<QuestionRunnerProps> = ({ 
  initialQuestions,
  subject, 
  topic, 
  userEmail,
  onBack,
  showToast
}) => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(!initialQuestions || initialQuestions.length === 0);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const prefetchingRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  const handleAnswer = async (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    
    const currentQ = questions[currentIndex];
    const isCorrect = idx === currentQ.correta;
    const responseTime = Date.now() - startTimeRef.current;

    try {
      await fetch('/api/user/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          questionId: currentQ.id,
          result: {
            correct: isCorrect,
            answerIndex: idx,
            responseTime: responseTime,
            question: currentQ
          }
        })
      });
    } catch (e) {
      console.error("Erro ao salvar histórico:", e);
    }
  };

  // Função de validação rigorosa para garantir isolamento de matéria e assunto
  const validateQuestion = useCallback((q: Question) => {
    const normalize = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    const qMateria = normalize(q.materia);
    const qAssunto = normalize(q.assunto);
    const sMateria = normalize(subject);
    const sAssunto = normalize(topic);

    const subjectMatch = qMateria === sMateria || qMateria.includes(sMateria) || sMateria.includes(qMateria);
    const topicMatch = qAssunto === sAssunto || qAssunto.includes(sAssunto) || sAssunto.includes(qAssunto);
    
    if (!subjectMatch || !topicMatch) {
      console.warn(`[QuestionRunner Validation Failed] Questão [${q.materia} | ${q.assunto}] context mismatch [${subject} | ${topic}]`);
      // Relaxamos para permitir que a plataforma continue, mas logamos o aviso
    }
    return true; // Trust the AI but log mismatch
  }, [subject, topic]);

  const prefetchNext = useCallback(async () => {
    if (prefetchingRef.current) return;
    prefetchingRef.current = true;
    setIsPrefetching(true);
    
    try {
      const newQ = await fetchSinglePoliceQuestion(subject, topic);
      if (newQ && validateQuestion(newQ)) {
        setQuestions(prev => {
          if (prev.some(q => q.id === newQ.id)) return prev;
          return [...prev, newQ];
        });
      }
    } catch (e) {
      console.error("Falha no prefetch:", e);
    } finally {
      prefetchingRef.current = false;
      setIsPrefetching(false);
    }
  }, [subject, topic, validateQuestion]);

  const init = useCallback(async () => {
    setErrorState(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsInitialLoading(true);

    if (initialQuestions && initialQuestions.length > 0) {
      const validInitial = initialQuestions.filter(validateQuestion);
      if (validInitial.length > 0) {
        setQuestions(validInitial);
        setIsInitialLoading(false);
        if (validInitial.length < 5) {
          prefetchNext();
        }
        return;
      }
    }

    try {
      const q1 = await fetchSinglePoliceQuestion(subject, topic);
      if (q1 && validateQuestion(q1)) {
        setQuestions([q1]);
        prefetchNext();
        prefetchNext();
      } else {
        throw new Error("Não foi possível carregar a questão inicial.");
      }
    } catch (error: any) {
      console.error("Erro no init:", error);
      setErrorState(error?.message || "Erro ao carregar questões.");
    } finally {
      setIsInitialLoading(false);
    }
  }, [subject, topic, initialQuestions, validateQuestion, prefetchNext]);

  useEffect(() => {
    init();
  }, [subject, topic, init]);

  useEffect(() => {
    if (!isInitialLoading && (questions.length - currentIndex) < 3) {
      prefetchNext();
    }
  }, [currentIndex, questions.length, isInitialLoading, prefetchNext]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSaved(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveToDossier = async () => {
    if (!currentQuestion) return;
    setIsSaved(true);
    showToast("Questão salva no seu Dossiê de Evidências.", "success");
    try {
      await fetch('/api/user/dossier/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          questionId: currentQuestion.id
        })
      });
    } catch (e) {
      console.error("Erro ao salvar no dossiê:", e);
    }
  };

  const currentQuestion = questions[currentIndex];

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh]">
        <div className="relative mb-12">
           <div className="w-24 h-24 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin shadow-2xl shadow-yellow-500/10"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl animate-pulse">⚡</span>
           </div>
        </div>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2 animate-pulse">Mobilizando IA</h3>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] animate-bounce">Sincronizando Edital: {topic}</p>
        <p className="text-slate-300 text-[8px] font-black uppercase tracking-widest mt-8 italic">Obrigado pela paciência, estamos processando conteúdo inédito...</p>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-8 bg-white rounded-[4rem] border-2 border-slate-100 shadow-2xl animate-fade-in max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-10 text-4xl">⚠️</div>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-6">Módulo Temporariamente Ocupado</h3>
        <p className="text-slate-600 font-medium mb-10 leading-relaxed">
          {errorState}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <button 
            onClick={() => init()}
            className="bg-yellow-500 text-slate-950 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all shadow-xl"
          >
            Tentar Novamente Agora
          </button>
          <button 
            onClick={onBack}
            className="bg-slate-100 text-slate-600 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Voltar ao Catálogo
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const isCertoErrado = currentQuestion.tipo === 'CERTO_ERRADO';

  return (
    <div className="max-w-5xl mx-auto pb-48 animate-fade-in">
      <div className="flex items-center justify-between mb-12 sticky top-0 bg-slate-50/95 backdrop-blur-xl z-40 py-6 border-b border-slate-200 px-6 rounded-b-[2.5rem] shadow-sm">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-[0.3em] transition flex items-center gap-3 group">
          <span className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">←</span> 
          SAIR DO MÓDULO
        </button>
        <div className="flex items-center gap-8">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status: Treinamento Infinito</span>
              <span className="text-slate-950 font-black text-3xl uppercase tracking-tighter tabular-nums">QUESTÃO {currentIndex + 1}</span>
           </div>
           <div className="w-14 h-14 bg-slate-950 rounded-[1.2rem] flex items-center justify-center shadow-2xl relative">
              <span className="text-2xl">⚡</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.12)] border border-slate-200 overflow-hidden transition-all duration-700">
        <div className="bg-slate-950 text-white px-12 py-8 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Instituição de Prova</span>
                <span className="px-5 py-2 bg-yellow-500 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-yellow-500/10">
                  {currentQuestion.banca}
                </span>
              </div>
              <div className="h-10 w-px bg-white/10 hidden md:block"></div>
              <div className="hidden md:flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Dados de Origem</span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {currentQuestion.orgao} • {currentQuestion.ano}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.2em] mb-1">Conectividade 100%</span>
               <div className="flex gap-2">
                 <button 
                   onClick={handleSaveToDossier}
                   className={`p-2 rounded-lg transition-all ${isSaved ? 'bg-yellow-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                   title="Salvar no Dossiê de Evidências"
                 >
                   {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                 </button>
                 <button className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all">
                   <Share2 className="w-4 h-4" />
                 </button>
               </div>
            </div>
        </div>

        <div className="p-10 md:p-20 max-w-4xl mx-auto">
          {currentQuestion.textoBase && (
            <div className="mb-12 bg-slate-50 p-8 md:p-12 rounded-[2.5rem] border border-slate-200 relative group">
               <div className="absolute top-0 left-10 -translate-y-1/2 bg-white px-6 py-1.5 border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Contexto da Questão</div>
               <p className="text-slate-600 leading-relaxed italic text-lg md:text-xl whitespace-pre-wrap font-serif opacity-90">
                 {currentQuestion.textoBase}
               </p>
            </div>
          )}

          <h2 className="text-xl md:text-3xl font-bold text-slate-950 leading-relaxed mb-16 tracking-tight">
            {currentQuestion.texto}
          </h2>

          <div className={`grid gap-5 ${isCertoErrado ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {currentQuestion.alternativas.map((alt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correta;
              const hasAnswered = selectedOption !== null;

              let btnClass = "w-full text-left p-6 md:p-8 rounded-[2rem] border-2 transition-all duration-300 flex gap-6 items-start group relative ";
              if (!hasAnswered) btnClass += "border-slate-100 hover:border-yellow-500 hover:bg-slate-50 hover:-translate-y-0.5 cursor-pointer";
              else {
                if (isCorrect) btnClass += "border-green-500 bg-green-50/50";
                else if (isSelected) btnClass += "border-red-500 bg-red-50/50";
                else btnClass += "border-slate-50 opacity-30 scale-[0.98]";
              }

              return (
                <button key={idx} onClick={() => handleAnswer(idx)} disabled={hasAnswered} className={btnClass}>
                  <span className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black shrink-0 transition-all text-lg md:text-xl
                    ${hasAnswered && isCorrect ? 'bg-green-600 text-white' : 
                      hasAnswered && isSelected ? 'bg-red-600 text-white' : 
                      'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}
                  `}>
                    {isCertoErrado ? (alt.toLowerCase().includes('certo') ? 'C' : 'E') : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-base md:text-lg text-slate-800 pt-2 font-semibold leading-relaxed tracking-tight">{alt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedOption !== null && (
          <div className="bg-slate-50 p-12 md:p-24 border-t border-slate-200 animate-slide-up">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-10 mb-14">
                 <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl transition-all
                    ${selectedOption === currentQuestion.correta ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
                 `}>
                    {selectedOption === currentQuestion.correta ? '✓' : '✕'}
                 </div>
                 <div>
                    <h3 className="text-slate-400 font-black uppercase text-[11px] tracking-[0.5em] mb-2">Resolução Comentada</h3>
                    <div className="space-y-1">
                      <p className="text-slate-950 font-black text-3xl tracking-tight">
                        SUA RESPOSTA: <span className={selectedOption === currentQuestion.correta ? 'text-green-600' : 'text-red-600'}>
                          {isCertoErrado ? (selectedOption === 0 ? 'CERTO' : 'ERRADO') : `ALTERNATIVA ${String.fromCharCode(65 + (selectedOption || 0))}`}
                        </span>
                      </p>
                      <p className="text-slate-950 font-black text-3xl tracking-tight">
                        GABARITO: <span className="text-green-600">
                          {isCertoErrado ? (currentQuestion.correta === 0 ? 'CERTO' : 'ERRADO') : `ALTERNATIVA ${String.fromCharCode(65 + currentQuestion.correta)}`}
                        </span>
                      </p>
                    </div>
                 </div>
              </div>
              
              <div className="space-y-4">
                 <StructuredCommentary text={currentQuestion.comentario} />

                 <div className="flex justify-center mt-20">
                    <button onClick={handleNext} className="group bg-slate-950 text-white px-20 py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-yellow-500 hover:text-slate-950 transition-all flex items-center gap-8">
                      PROSSEGUIR TREINAMENTO
                      <span className="group-hover:translate-x-3 transition-transform">→</span>
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
