
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { INITIAL_FLASHCARDS, SUBJECTS } from '../constants';
import { Flashcard } from '../types';
import { generateFlashcardsBatch } from '../services/geminiService';

const STORAGE_KEY = 'PF_FLASHCARDS_MASTER_v1';

export const Flashcards: React.FC = () => {
  const [cards, setCards] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_FLASHCARDS;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>("TODAS");
  const [filterTopic, setFilterTopic] = useState<string>("TODOS");
  const [isSyncing, setIsSyncing] = useState(false);

  // Persistência local
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

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
  }, [cards, isSyncing]);

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
    <div className="max-w-7xl mx-auto min-h-[85vh] pb-20 animate-fade-in">
      {/* HUD de Status e Progresso */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Treinamento de Memória</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-md">
              <div 
                className="h-full bg-yellow-500 transition-all duration-1000" 
                style={{ width: `${subjectProgress}%` }}
              ></div>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {subjectProgress === 100 ? '✅ Banco Completo' : `Meta: ${Math.round(subjectProgress)}%`}
            </span>
          </div>
        </div>
        
        <div className="flex gap-4 shrink-0">
          <div className="bg-slate-900 px-6 py-3 rounded-2xl text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Questão Atual</p>
            <p className="text-xl font-black text-white">{currentIndex + 1} / {filteredCards.length}</p>
          </div>
          <div className="bg-yellow-500 px-6 py-3 rounded-2xl text-center shadow-lg shadow-yellow-500/20">
            <p className="text-[9px] font-bold text-slate-900/50 uppercase mb-1">Materia</p>
            <p className="text-xl font-black text-slate-900 truncate max-w-[120px]">{filterSubject}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Navegação Lateral */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-200 overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Disciplinas</h3>
            <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              <button 
                onClick={() => handleMateriaChange("TODAS")}
                className={`text-left px-5 py-3 rounded-xl text-xs font-bold transition-all ${filterSubject === "TODAS" ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Mix Policial
              </button>
              {SUBJECTS.map(s => (
                <button 
                  key={s.id}
                  onClick={() => handleMateriaChange(s.name)}
                  className={`text-left px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${filterSubject === s.name ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <span className="truncate">{s.icon} {s.name}</span>
                  {cards.filter(c => c.materia === s.name).length < 50 && (
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visualizador de Cards */}
        <div className="lg:col-span-9 flex flex-col items-center">
          {isSyncing && (
            <div className="w-full mb-6 bg-yellow-50 border border-yellow-200 px-6 py-3 rounded-2xl flex items-center justify-between animate-pulse">
              <span className="text-[10px] font-black text-yellow-700 uppercase">Sincronizando 50 cards para {filterSubject}...</span>
              <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!currentCard ? (
            <div className="w-full aspect-[16/10] bg-white rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-6"></div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Carregando Banco de Questões...</p>
            </div>
          ) : (
            <div className="w-full max-w-4xl relative">
              {/* Container da Animação 3D - Corrigido para evitar sobreposição */}
              <div className="relative aspect-[16/9] w-full perspective-2000">
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                >
                  {/* FACE FRONTAL (PERGUNTA) */}
                  <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-[4rem] shadow-2xl border border-slate-200 flex flex-col p-12 overflow-hidden z-10">
                    <div className="flex justify-between items-center mb-8">
                       <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl">Pergunta</span>
                       <span className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.2em]">{currentCard.assunto}</span>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center">
                      <h3 className="text-2xl md:text-4xl font-bold text-slate-900 text-center leading-tight tracking-tight px-4">
                        {currentCard.front}
                      </h3>
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4 opacity-30 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Clique para virar o card</p>
                      <div className="w-16 h-1 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>

                  {/* FACE TRASEIRA (RESPOSTA) */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-slate-950 rounded-[4rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] border border-white/5 flex flex-col p-12 overflow-hidden z-0">
                    <div className="flex justify-between items-center mb-8">
                       <span className="px-4 py-1.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-yellow-500/20">Resposta Técnica</span>
                       <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fundamentação IA</span>
                       </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center px-6">
                      <p className="text-xl md:text-3xl font-light text-white text-center leading-relaxed italic">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Materia: {currentCard.materia}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação - Aparecem apenas após o flip */}
              <div className={`mt-12 flex justify-center gap-6 transition-all duration-500 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="flex-1 bg-white hover:bg-red-50 text-red-600 px-10 py-6 rounded-[2.5rem] border-2 border-red-100 font-black uppercase text-xs tracking-widest transition-all hover:-translate-y-1 shadow-xl flex items-center justify-center gap-3"
                >
                  <span className="text-lg">❌</span> ERREI
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-10 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-widest transition-all hover:-translate-y-1 shadow-2xl flex items-center justify-center gap-3"
                >
                  ACERTEI <span className="text-yellow-500 text-lg">✅</span>
                </button>
              </div>

              {!isFlipped && (
                <div className="mt-12 text-center animate-bounce opacity-40">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Toque no card para revelar a resposta</span>
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
        
        /* Previne o flicker no Chrome */
        .backface-hidden {
          position: absolute;
          top: 0;
          left: 0;
        }
      `}</style>
    </div>
  );
};
