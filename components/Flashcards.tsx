
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { INITIAL_FLASHCARDS, SUBJECTS } from '../constants';
import { Flashcard } from '../types';
import { generateFlashcardsBatch } from '../services/geminiService';
import { apiFetch, apiJson } from '../services/apiClient';

const STORAGE_KEY = 'PF_FLASHCARDS_MASTER_v1';

interface FlashcardsProps {
  userEmail: string;
}

export const Flashcards: React.FC<FlashcardsProps> = ({ userEmail }) => {
  const [cards, setCards] = useState<Flashcard[]>(INITIAL_FLASHCARDS);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>("TODAS");
  const [filterTopic, setFilterTopic] = useState<string>("TODOS");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const data = await apiJson<{ flashcards: any[] }>('/api/user/flashcards/list');
        if (data.flashcards && data.flashcards.length > 0) {
          setCards(prev => {
            const existingFronts = new Set(prev.map(p => p.front));
            const uniqueNew = data.flashcards.filter((n: any) => !existingFronts.has(n.front));
            return [...prev, ...uniqueNew];
          });
        }
      } catch (e) {
        console.error("Erro ao buscar flashcards:", e);
      }
    };
    fetchCards();
  }, [userEmail]);

  const activeSubjectData = useMemo(() => 
    SUBJECTS.find(s => s.name === filterSubject), 
  [filterSubject]);

  const filteredCards = useMemo(() => {
    let result = filterSubject === "TODAS" ? cards : cards.filter(c => c.materia === filterSubject);
    if (filterTopic !== "TODOS") {
      result = result.filter(c => c.assunto === filterTopic || c.front.toLowerCase().includes(filterTopic.toLowerCase()));
    }
    return result;
  }, [cards, filterSubject, filterTopic]);

  const currentCard = filteredCards[currentIndex];

  // Cálculo de progresso para a meta de 50 cards
  const subjectProgress = useMemo(() => {
    if (filterSubject === "TODAS") return 100;
    const count = cards.filter(c => c.materia === filterSubject).length;
    return Math.min(100, (count / 50) * 100);
  }, [cards, filterSubject]);

  const syncSubject = useCallback(async (targetMateria: string) => {
    if (isSyncing || targetMateria === "TODAS") return;
    
    const count = cards.filter(c => c.materia === targetMateria).length;
    if (count >= 50) return;

    setIsSyncing(true);
    try {
      // Gera lotes até atingir a meta
      const needed = 50 - count;
      const batches = Math.ceil(needed / 10);

      for (let i = 0; i < batches; i++) {
        const newCards = await generateFlashcardsBatch(targetMateria, 10);
        if (newCards.length > 0) {
          // Save each new card to Supabase
          for (const card of newCards) {
            try {
              await apiFetch('/api/user/flashcards/save', {
                method: 'POST',
                body: JSON.stringify({ ...card })
              });
            } catch (e) {
              console.error("Erro ao salvar flashcard no Supabase:", e);
            }
          }

          setCards(prev => {
            const existingFronts = new Set(prev.filter(p => p.materia === targetMateria).map(p => p.front));
            const uniqueNew = newCards.filter(n => !existingFronts.has(n.front));
            return [...prev, ...uniqueNew];
          });
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [cards, isSyncing, userEmail]);

  useEffect(() => {
    if (filterSubject !== "TODAS") {
      syncSubject(filterSubject);
    }
  }, [filterSubject, syncSubject]);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < filteredCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCurrentIndex(0);
      }
    }, 150);
  };

  const handleMateriaChange = (m: string) => {
    setFilterSubject(m);
    setFilterTopic("TODOS");
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  return (
    <div className="max-w-7xl mx-auto min-h-[85vh] pb-16 sm:pb-20 animate-fade-in px-0">
      {/* HUD de Status e Progresso */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 sm:mb-12 gap-4 sm:gap-8 bg-white p-4 sm:p-8 rounded-3xl sm:rounded-[3rem] shadow-xl border border-slate-200">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter mb-2">Treinamento de Memória</h2>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-md">
              <div 
                className="h-full bg-yellow-500 transition-all duration-1000" 
                style={{ width: `${subjectProgress}%` }}
              ></div>
            </div>
            <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
              {subjectProgress === 100 ? '✅ Completo' : `Meta: ${Math.round(subjectProgress)}%`}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2 sm:gap-4 shrink-0 w-full sm:w-auto">
          <div className="bg-slate-900 px-4 sm:px-6 py-3 rounded-2xl text-center flex-1 sm:flex-none">
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Atual</p>
            <p className="text-lg sm:text-xl font-black text-white">{currentIndex + 1} / {filteredCards.length}</p>
          </div>
          <div className="bg-yellow-500 px-4 sm:px-6 py-3 rounded-2xl text-center shadow-lg shadow-yellow-500/20 flex-1 sm:flex-none min-w-0">
            <p className="text-[9px] font-bold text-slate-900/50 uppercase mb-1">Matéria</p>
            <p className="text-sm sm:text-xl font-black text-slate-900 truncate">{filterSubject}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
        {/* Navegação Lateral — horizontal no mobile */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] shadow-lg border border-slate-200 overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 sm:mb-6 px-2">Disciplinas</h3>
            <div className="flex lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-y-auto lg:max-h-[500px] custom-scrollbar pb-2 lg:pb-0 lg:pr-2 -mx-1 px-1">
              <button 
                onClick={() => handleMateriaChange("TODAS")}
                className={`text-left px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${filterSubject === "TODAS" ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Mix Policial
              </button>
              {SUBJECTS.map(s => (
                <button 
                  key={s.id}
                  onClick={() => handleMateriaChange(s.name)}
                  className={`text-left px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 group whitespace-nowrap shrink-0 ${filterSubject === s.name ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <span className="truncate max-w-[10rem] lg:max-w-none">{s.icon} {s.name}</span>
                  {cards.filter(c => c.materia === s.name).length < 50 && (
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse shrink-0"></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visualizador de Cards */}
        <div className="lg:col-span-9 flex flex-col items-center min-w-0">
          {isSyncing && (
            <div className="w-full mb-4 sm:mb-6 bg-yellow-50 border border-yellow-200 px-4 sm:px-6 py-3 rounded-2xl flex items-center justify-between gap-3 animate-pulse">
              <span className="text-[9px] sm:text-[10px] font-black text-yellow-700 uppercase leading-snug">Sincronizando cards para {filterSubject}...</span>
              <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin shrink-0"></div>
            </div>
          )}

          {!currentCard ? (
            <div className="w-full min-h-[280px] sm:aspect-[16/10] bg-white rounded-3xl sm:rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 sm:p-20 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-6"></div>
              <p className="text-slate-400 font-black uppercase text-[10px] sm:text-xs tracking-widest">Carregando Banco...</p>
            </div>
          ) : (
            <div className="w-full max-w-4xl relative min-w-0">
              <div className="relative w-full min-h-[320px] sm:min-h-0 sm:aspect-[16/9] perspective-2000">
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`relative w-full h-full min-h-[320px] sm:min-h-0 transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                >
                  {/* FACE FRONTAL */}
                  <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl sm:rounded-[4rem] shadow-2xl border border-slate-200 flex flex-col p-5 sm:p-12 overflow-hidden z-10">
                    <div className="flex justify-between items-center gap-2 mb-4 sm:mb-8">
                       <span className="px-3 sm:px-4 py-1.5 bg-slate-100 text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0">Pergunta</span>
                       <span className="text-[9px] sm:text-[10px] font-black text-yellow-600 uppercase tracking-wide truncate text-right">{currentCard.assunto}</span>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center overflow-y-auto">
                      <h3 className="text-lg sm:text-2xl md:text-4xl font-bold text-slate-900 text-center leading-snug sm:leading-tight tracking-tight px-1 sm:px-4">
                        {currentCard.front}
                      </h3>
                    </div>

                    <div className="mt-4 sm:mt-8 flex flex-col items-center gap-2 sm:gap-4 opacity-40">
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Toque para virar</p>
                      <div className="w-12 sm:w-16 h-1 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>

                  {/* FACE TRASEIRA */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-slate-950 rounded-3xl sm:rounded-[4rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] border border-white/5 flex flex-col p-5 sm:p-12 overflow-hidden z-0">
                    <div className="flex justify-between items-center gap-2 mb-4 sm:mb-8">
                       <span className="px-3 sm:px-4 py-1.5 bg-yellow-500/10 text-yellow-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl border border-yellow-500/20 shrink-0">Resposta</span>
                       <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shrink-0"></span>
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">IA</span>
                       </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center px-1 sm:px-6 overflow-y-auto">
                      <p className="text-base sm:text-xl md:text-3xl font-light text-white text-center leading-relaxed italic">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5 flex justify-center">
                       <span className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest text-center truncate max-w-full px-2">Materia: {currentCard.materia}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mt-6 sm:mt-12 flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 transition-all duration-500 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="w-full sm:flex-1 bg-white hover:bg-red-50 text-red-600 px-6 sm:px-10 py-4 sm:py-6 rounded-2xl sm:rounded-[2.5rem] border-2 border-red-100 font-black uppercase text-[10px] sm:text-xs tracking-widest transition-all hover:-translate-y-1 shadow-xl flex items-center justify-center gap-3"
                >
                  <span className="text-lg">❌</span> ERREI
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="w-full sm:flex-1 bg-slate-900 hover:bg-slate-800 text-white px-6 sm:px-10 py-4 sm:py-6 rounded-2xl sm:rounded-[2.5rem] font-black uppercase text-[10px] sm:text-xs tracking-widest transition-all hover:-translate-y-1 shadow-2xl flex items-center justify-center gap-3"
                >
                  ACERTEI <span className="text-yellow-500 text-lg">✅</span>
                </button>
              </div>

              {!isFlipped && (
                <div className="mt-6 sm:mt-12 text-center animate-bounce opacity-40 px-2">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Toque no card para revelar a resposta</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { 
          backface-visibility: hidden; 
          -webkit-backface-visibility: hidden; 
        }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        .backface-hidden {
          position: absolute;
          top: 0;
          left: 0;
        }
      `}</style>
    </div>
  );
};
