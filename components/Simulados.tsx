
import React, { useState } from 'react';
import { Question, SimuladoResult } from '../types';
import { SUBJECTS } from '../constants';
import { generateQuestionsForSubject } from '../services/geminiService';

type SimuladoState = 'CONFIG' | 'LOADING' | 'RUNNING' | 'RESULT';

export const Simulados: React.FC = () => {
  const [state, setState] = useState<SimuladoState>('CONFIG');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examLength, setExamLength] = useState<60 | 120>(60);
  const [loadingProgress, setLoadingProgress] = useState<{current: string, count: number}>({ current: '', count: 0 });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [result, setResult] = useState<SimuladoResult | null>(null);

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const startSimulado = async () => {
    if (selectedSubjects.length === 0) {
      alert("Selecione pelo menos uma matéria para o treinamento.");
      return;
    }

    setState('LOADING');
    
    const subjectsToFetch = SUBJECTS.filter(s => selectedSubjects.includes(s.id));
    const numSubjects = subjectsToFetch.length;
    
    // Cálculo da distribuição igualitária
    const baseCount = Math.floor(examLength / numSubjects);
    const remainder = examLength % numSubjects;

    let pool: Question[] = [];

    try {
      // Fetch sequencial ou em pequenos paralelos para evitar rate limit excessivo
      for (let i = 0; i < numSubjects; i++) {
        const sub = subjectsToFetch[i];
        const countForThisSubject = baseCount + (i < remainder ? 1 : 0);
        
        if (countForThisSubject > 0) {
          setLoadingProgress({ current: sub.name, count: countForThisSubject });
          const subQuestions = await generateQuestionsForSubject(sub.name, countForThisSubject);
          pool = [...pool, ...subQuestions];
        }
      }

      // Embaralhar o pool final para não ficarem todas as matérias juntas
      pool.sort(() => Math.random() - 0.5);

      if (pool.length === 0) throw new Error("Falha na geração");

      setQuestions(pool);
      setAnswers({});
      setCurrentQIndex(0);
      setState('RUNNING');
      window.scrollTo(0, 0);
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com o banco de questões. Verifique sua conexão e tente novamente.");
      setState('CONFIG');
    }
  };

  const handleAnswer = (optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [questions[currentQIndex].id]: optionIdx }));
  };

  const finishSimulado = () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correta) correct++;
    });

    setResult({
      totalQuestions: questions.length,
      correctCount: correct,
      answers: answers,
      questions: questions,
      date: new Date().toLocaleDateString()
    });
    setState('RESULT');
    window.scrollTo(0, 0);
  };

  if (state === 'CONFIG') {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white mb-10 shadow-2xl">
          <h2 className="text-4xl font-black tracking-tighter mb-4">Simulado de Elite</h2>
          <p className="text-slate-400 font-medium text-lg">Personalize seu treinamento de combate. A IA irá gerar questões com distribuição igualitária entre as matérias selecionadas.</p>
        </div>

        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 p-10 mb-8">
          <h3 className="font-black text-slate-900 mb-8 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> 1. Disciplinas do Edital ({selectedSubjects.length} selecionadas)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUBJECTS.map(sub => (
              <button
                key={sub.id}
                onClick={() => toggleSubject(sub.id)}
                className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all
                  ${selectedSubjects.includes(sub.id) 
                    ? 'border-yellow-500 bg-yellow-50 text-slate-900 font-bold' 
                    : 'border-slate-100 text-slate-400 hover:border-slate-200'
                  }
                `}
              >
                <span className="text-3xl">{sub.icon}</span>
                <span className="text-sm uppercase font-black tracking-tight">{sub.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex gap-6">
             <button onClick={() => setSelectedSubjects(SUBJECTS.map(s => s.id))} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest border-b border-transparent hover:border-slate-900 transition-all">Selecionar Todas</button>
             <button onClick={() => setSelectedSubjects([])} className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest border-b border-transparent hover:border-red-600 transition-all">Limpar</button>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 p-10 mb-12">
            <h3 className="font-black text-slate-900 mb-8 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> 2. Volume de Fogo (Distribuição Equalitária)
            </h3>
            <div className="flex gap-6">
                <button 
                  onClick={() => setExamLength(60)}
                  className={`flex-1 py-6 rounded-3xl border-2 font-black transition-all
                    ${examLength === 60 ? 'border-slate-900 bg-slate-900 text-white shadow-2xl' : 'border-slate-100 text-slate-300 hover:border-slate-200'}
                  `}
                >
                    60 QUESTÕES
                </button>
                <button 
                  onClick={() => setExamLength(120)}
                  className={`flex-1 py-6 rounded-3xl border-2 font-black transition-all
                    ${examLength === 120 ? 'border-slate-900 bg-slate-900 text-white shadow-2xl' : 'border-slate-100 text-slate-300 hover:border-slate-200'}
                  `}
                >
                    120 QUESTÕES
                </button>
            </div>
            {selectedSubjects.length > 0 && (
              <p className="mt-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Média: {Math.floor(examLength/selectedSubjects.length)} questões por matéria selecionada.
              </p>
            )}
        </div>

        <button 
          onClick={startSimulado}
          className="w-full py-8 bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-2xl font-black rounded-[2.5rem] shadow-2xl shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          GERAR SIMULADO AGORA →
        </button>
      </div>
    );
  }

  if (state === 'LOADING') {
    return (
      <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center animate-pulse">
        <div className="w-24 h-24 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin mb-10"></div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 text-center">MOBILIZANDO BANCO DE QUESTÕES...</h2>
        <div className="space-y-3 text-center">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.3em]">Sincronizando com editais PF/PRF</p>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.3em]">IA validando gabaritos técnicos</p>
            <p className="text-yellow-600 font-black uppercase text-xs tracking-[0.3em]">
              Carregando {loadingProgress.count} itens de {loadingProgress.current}
            </p>
            <div className="w-64 h-1.5 bg-slate-200 rounded-full mx-auto overflow-hidden mt-4">
              <div 
                className="h-full bg-yellow-500 transition-all duration-500" 
                style={{ width: `${(questions.length / examLength) * 100}%` }}
              ></div>
            </div>
        </div>
      </div>
    );
  }

  if (state === 'RUNNING') {
    const q = questions[currentQIndex];
    return (
      <div className="max-w-5xl mx-auto pb-32 animate-fade-in">
        <div className="flex justify-between items-center mb-10 sticky top-0 bg-slate-50/90 backdrop-blur-md py-6 z-30 border-b border-slate-200">
           <div className="flex items-center gap-4">
              <span className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest">
                ITEM {currentQIndex + 1} / {questions.length}
              </span>
              <div className="h-1.5 w-48 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all" 
                  style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
           </div>
           <button onClick={finishSimulado} className="bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
             Encerrar Simulado
           </button>
        </div>

        <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
           <div className="bg-slate-50 px-10 py-6 border-b border-slate-200 flex justify-between items-center">
             <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">{q.materia} &bull; {q.assunto}</span>
             <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500">{q.banca} {q.ano}</span>
           </div>
           <div className="p-12 md:p-20 flex-1">
             <p className="text-2xl md:text-3xl text-slate-900 font-bold leading-snug mb-12 tracking-tight">{q.texto}</p>
             <div className="space-y-4">
               {q.alternativas.map((alt, idx) => (
                 <button
                   key={idx}
                   onClick={() => handleAnswer(idx)}
                   className={`w-full text-left p-6 rounded-[1.5rem] border-2 transition-all flex items-start gap-5
                     ${answers[q.id] === idx 
                        ? 'border-slate-900 bg-slate-900 text-white shadow-2xl' 
                        : 'border-slate-100 hover:border-yellow-500/30 hover:bg-slate-50 text-slate-600'
                     }
                   `}
                 >
                   <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${answers[q.id] === idx ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                    {String.fromCharCode(65+idx)}
                   </span>
                   <span className="text-lg font-medium pt-1 leading-tight">{alt}</span>
                 </button>
               ))}
             </div>
           </div>

           <div className="p-10 bg-white border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={() => {setCurrentQIndex(prev => Math.max(0, prev - 1)); window.scrollTo(0,0);}}
                  disabled={currentQIndex === 0}
                  className="px-8 py-4 rounded-2xl font-black text-slate-400 border border-slate-200 disabled:opacity-10 text-xs uppercase tracking-widest"
                >
                  ← Anterior
                </button>
                {currentQIndex < questions.length - 1 ? (
                   <button 
                     onClick={() => {setCurrentQIndex(prev => prev + 1); window.scrollTo(0,0);}}
                     className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl"
                   >
                     Próximo Item →
                   </button>
                ) : (
                  <button 
                     onClick={finishSimulado}
                     className="bg-green-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 shadow-xl"
                   >
                     Finalizar ✓
                   </button>
                )}
           </div>
        </div>

        {/* Mapa de Questões Compacto */}
        <div className="mt-12 flex flex-wrap gap-2 justify-center">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {setCurrentQIndex(idx); window.scrollTo(0,0);}}
                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all border
                  ${idx === currentQIndex 
                    ? 'border-yellow-500 bg-yellow-500 text-slate-950 scale-110 shadow-lg' 
                    : answers[questions[idx].id] !== undefined 
                        ? 'bg-slate-900 border-slate-900 text-white' 
                        : 'bg-white border-slate-200 text-slate-300'
                  }
                `}
              >
                {idx + 1}
              </button>
            ))}
        </div>
      </div>
    );
  }

  if (state === 'RESULT' && result) {
    const percentage = Math.round((result.correctCount / result.totalQuestions) * 100);
    return (
      <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
        <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-200 p-16 text-center mb-12">
            <h2 className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Relatório de Performance</h2>
            <div className={`text-9xl font-black mb-6 tracking-tighter ${percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {percentage}%
            </div>
            <p className="text-slate-900 text-2xl font-bold mb-10">
                Aproveitamento: {result.correctCount} / {result.totalQuestions} acertos.
            </p>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-12">
               <div className={`h-full transition-all duration-1000 ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${percentage}%`}}></div>
            </div>
            <button onClick={() => setState('CONFIG')} className="bg-slate-900 text-white px-14 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl">
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
                            <div className="bg-slate-900 p-8 rounded-3xl border-l-4 border-yellow-500">
                                <h4 className="text-yellow-500 font-black text-[9px] uppercase tracking-[0.2em] mb-3">Comentário do Especialista IA:</h4>
                                <p className="text-slate-200 text-sm leading-relaxed italic">{q.comentario}</p>
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
