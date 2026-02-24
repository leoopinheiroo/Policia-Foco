
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Question } from '../types';
import { fetchSinglePoliceQuestion } from '../services/geminiService';

interface QuestionRunnerProps {
  initialQuestions: Question[];
  subject: string;
  topic: string;
  onBack: () => void;
}

// Componente para renderizar a explicação estruturada com estilo de "apostila de elite"
const StructuredCommentary: React.FC<{ text: string }> = ({ text }) => {
  const sections = [
    { key: '[RESUMO DA CORRETA]', icon: '✅', title: 'Análise do Gabarito', color: 'bg-green-500/10 border-green-500/20 text-green-900', labelColor: 'bg-green-600' },
    { key: '[POR QUE AS OUTRAS ESTÃO ERRADAS?]', icon: '✕', title: 'Análise das Incorretas', color: 'bg-red-500/5 border-red-500/10 text-slate-800', labelColor: 'bg-red-600' },
    { key: '[MNEMÔNICO / DICA DE OURO]', icon: '💡', title: 'Dica do Operador', color: 'bg-yellow-500/10 border-yellow-500/30 text-slate-900', labelColor: 'bg-yellow-600' },
    { key: '[CUIDADO COM A PEGADINHA!]', icon: '⚠️', title: 'Radar de Pegadinha', color: 'bg-orange-500/10 border-orange-500/30 text-orange-900', labelColor: 'bg-orange-600' }
  ];

  const renderSection = (section: typeof sections[0]) => {
    const parts = text.split(section.key);
    if (parts.length < 2) return null;
    
    // Pega o conteúdo até o próximo marcador de seção
    let content = parts[1];
    sections.forEach(s => {
      if (s.key !== section.key) {
        content = content.split(s.key)[0];
      }
    });

    return (
      <div key={section.key} className={`p-8 rounded-[2.5rem] border-2 mb-8 ${section.color} animate-fade-in`}>
        <div className="flex items-center gap-3 mb-6">
          <span className={`px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest ${section.labelColor} flex items-center gap-2 shadow-lg`}>
            <span>{section.icon}</span> {section.title}
          </span>
        </div>
        <div className="text-xl md:text-2xl leading-relaxed font-medium">
          {content.split('\n').map((para, i) => para.trim() && (
            <p key={i} className="mb-4 last:mb-0">
              {/* Transformar citações de leis em "Marca Texto" */}
              {para.split(/(Art\.\s\d+|Lei\snº\s\d+\.\d+)/g).map((chunk, ci) => (
                chunk.match(/(Art\.\s\d+|Lei\snº\s\d+\.\d+)/) ? 
                <span key={ci} className="bg-yellow-300/40 px-2 py-0.5 rounded font-black border-b-2 border-yellow-500/50">{chunk}</span> : 
                chunk
              ))}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sections.map(s => renderSection(s))}
    </div>
  );
};

export const QuestionRunner: React.FC<QuestionRunnerProps> = ({ 
  subject, 
  topic, 
  onBack 
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPrefetching, setIsPrefetching] = useState(false);

  const prefetchingRef = useRef(false);

  const prefetchNext = useCallback(async () => {
    if (prefetchingRef.current) return;
    prefetchingRef.current = true;
    setIsPrefetching(true);
    
    try {
      const newQ = await fetchSinglePoliceQuestion(subject, topic);
      if (newQ) {
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
  }, [subject, topic]);

  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedOption(null);
      const q1 = await fetchSinglePoliceQuestion(subject, topic);
      if (q1) {
        setQuestions([q1]);
        setIsInitialLoading(false); 
        await prefetchNext();
        await prefetchNext();
      }
    };
    init();
  }, [subject, topic, prefetchNext]);

  useEffect(() => {
    if (!isInitialLoading && (questions.length - currentIndex) < 3) {
      prefetchNext();
    }
  }, [currentIndex, questions.length, isInitialLoading, prefetchNext]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentQuestion = questions[currentIndex];

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] animate-pulse">
        <div className="w-24 h-24 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-10 shadow-2xl shadow-yellow-500/10"></div>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Mobilizando IA</h3>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] animate-bounce">Sincronizando Edital: {topic}</p>
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
               <span className="text-[10px] font-bold text-slate-400">Geração IA Pedagógica</span>
            </div>
        </div>

        <div className="p-10 md:p-24">
          {currentQuestion.textoBase && (
            <div className="mb-14 bg-slate-50 p-12 rounded-[3rem] border border-slate-200 relative group">
               <div className="absolute top-0 left-12 -translate-y-1/2 bg-white px-8 py-2 border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contexto da Questão</div>
               <p className="text-slate-700 leading-relaxed italic text-2xl whitespace-pre-wrap font-serif opacity-90">
                 {currentQuestion.textoBase}
               </p>
            </div>
          )}

          <h2 className="text-3xl md:text-5xl font-bold text-slate-950 leading-[1.15] mb-20 tracking-tight">
            {currentQuestion.texto}
          </h2>

          <div className={`grid gap-6 ${isCertoErrado ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {currentQuestion.alternativas.map((alt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correta;
              const hasAnswered = selectedOption !== null;

              let btnClass = "w-full text-left p-10 rounded-[2.5rem] border-2 transition-all duration-300 flex gap-8 items-start group relative ";
              if (!hasAnswered) btnClass += "border-slate-100 hover:border-yellow-500 hover:bg-slate-50 hover:-translate-y-1 cursor-pointer";
              else {
                if (isCorrect) btnClass += "border-green-500 bg-green-50/50";
                else if (isSelected) btnClass += "border-red-500 bg-red-50/50";
                else btnClass += "border-slate-50 opacity-30 scale-95";
              }

              return (
                <button key={idx} onClick={() => setSelectedOption(idx)} disabled={hasAnswered} className={btnClass}>
                  <span className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center font-black shrink-0 transition-all text-2xl
                    ${hasAnswered && isCorrect ? 'bg-green-600 text-white' : 
                      hasAnswered && isSelected ? 'bg-red-600 text-white' : 
                      'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}
                  `}>
                    {isCertoErrado ? (idx === 0 ? 'C' : 'E') : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-2xl text-slate-800 pt-3 font-semibold leading-snug tracking-tight">{alt}</span>
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
                    <p className="text-slate-950 font-black text-4xl tracking-tight">
                      GABARITO: <span className={selectedOption === currentQuestion.correta ? 'text-green-600' : 'text-red-600'}>
                        {isCertoErrado ? (currentQuestion.correta === 0 ? 'CERTO' : 'ERRADO') : `ALTERNATIVA ${String.fromCharCode(65 + currentQuestion.correta)}`}
                      </span>
                    </p>
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
