import React, { useState } from 'react';
import { correctEssayWithAi } from '../services/geminiService';
import { EssayFeedback } from '../types';

const COMMON_THEMES = [
  "O papel da segurança pública na preservação da democracia",
  "A redução da maioridade penal no Brasil: desafios e perspectivas",
  "O impacto da tecnologia no combate ao crime organizado",
  "Políticas públicas de combate às drogas: repressão vs prevenção",
  "Violência doméstica e familiar contra a mulher no Brasil",
  "O sistema prisional brasileiro e a ressocialização do preso",
  "A atividade policial e o respeito aos direitos humanos",
  "Crimes cibernéticos e a dificuldade de investigação",
  "Porte de armas no Brasil: direito de defesa ou risco social?",
  "A integração entre as polícias no combate à criminalidade interestadual"
];

export const EssayCorrection: React.FC = () => {
  const [theme, setTheme] = useState("");
  const [essay, setEssay] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [feedback, setFeedback] = useState<EssayFeedback | null>(null);

  const handleCorrection = async () => {
    if (!essay.trim() || !theme.trim()) {
        alert("Por favor, selecione um tema e escreva sua redação.");
        return;
    }
    setIsCorrecting(true);
    const result = await correctEssayWithAi(essay, theme);
    setFeedback(result);
    setIsCorrecting(false);
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
      {/* Input Area */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>✍️</span> Laboratório de Redação
          </h2>
          <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Escolha um Tema</label>
              <select 
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
                value={COMMON_THEMES.includes(theme) ? theme : ""}
              >
                  <option value="" disabled>Selecione um tema da lista...</option>
                  {COMMON_THEMES.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
          </div>
          <div>
            <input 
                type="text" 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ou digite seu próprio tema aqui..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition"
            />
          </div>
        </div>
        <textarea
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          placeholder="Comece a escrever sua redação aqui. Foque na estrutura dissertativa-argumentativa (Introdução, Desenvolvimento, Conclusão)..."
          className="flex-1 w-full p-6 text-slate-700 leading-relaxed outline-none resize-none focus:bg-slate-50 transition font-serif text-lg"
        />
        <div className="p-5 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{essay.length} caracteres</span>
          <button
            onClick={handleCorrection}
            disabled={isCorrecting || essay.length < 100}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isCorrecting ? 'Analisando...' : 'Corrigir Redação'}
          </button>
        </div>
      </div>

      {/* Feedback Area */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 h-full overflow-hidden flex flex-col relative">
        {!feedback ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <span className="text-5xl opacity-50">📝</span>
            </div>
            <p className="font-bold text-xl text-slate-700 mb-2">Aguardando Redação</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Escreva seu texto ao lado e solicite a correção. Nossa IA utilizará os critérios oficiais da <strong>Cebraspe/FGV</strong> para avaliar seu desempenho.
            </p>
            <div className="mt-8 flex gap-4 opacity-70">
                <span className="px-3 py-1 bg-white border rounded text-xs">Gramática</span>
                <span className="px-3 py-1 bg-white border rounded text-xs">Coesão</span>
                <span className="px-3 py-1 bg-white border rounded text-xs">Argumentação</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {/* Header Score */}
             <div className="bg-slate-900 text-white p-8 pb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-yellow-400 mb-1">Feedback Oficial</h2>
                        <p className="text-slate-400 text-sm uppercase tracking-widest">Baseado na banca examinadora</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className={`
                            text-5xl font-black mb-1
                            ${feedback.score >= 80 ? 'text-green-400' : feedback.score >= 60 ? 'text-yellow-400' : 'text-red-400'}
                        `}>
                            {feedback.score}
                        </div>
                        <span className="text-xs bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest font-bold">Nota Final</span>
                    </div>
                </div>
             </div>

             {/* Content */}
             <div className="p-8 -mt-6">
                
                {/* Visão Geral Card */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 mb-8 relative z-20">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span>🔍</span> Visão Geral do Examinador
                    </h3>
                    <p className="text-slate-700 leading-relaxed text-lg">{feedback.comments}</p>
                </div>

                {/* Grid Fortes vs Fracos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-green-50/50 p-6 rounded-xl border border-green-100">
                        <h3 className="text-green-700 font-bold mb-4 flex items-center gap-2">
                            <span className="bg-green-100 p-1 rounded">👍</span> Pontos Fortes
                        </h3>
                        <ul className="space-y-3">
                            {feedback.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-red-50/50 p-6 rounded-xl border border-red-100">
                        <h3 className="text-red-700 font-bold mb-4 flex items-center gap-2">
                            <span className="bg-red-100 p-1 rounded">⚠️</span> Pontos de Atenção
                        </h3>
                        <ul className="space-y-3">
                            {feedback.weaknesses.map((w, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-red-500 font-bold mt-0.5">!</span>
                                    {w}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Grammar Issues */}
                {feedback.grammarIssues.length > 0 && (
                    <div className="mb-8">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <span className="text-orange-500">🛡️</span> Correções Gramaticais
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {feedback.grammarIssues.map((issue, i) => (
                                <span key={i} className="px-3 py-1.5 bg-orange-50 text-orange-800 text-sm font-medium border border-orange-100 rounded-lg">
                                    {issue}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Didactic Examples (Before/After) */}
                {feedback.improvementExamples && feedback.improvementExamples.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                           <span>💡</span> Exemplos Práticos de Melhoria
                        </h3>
                        <div className="space-y-6">
                            {feedback.improvementExamples.map((ex, i) => (
                                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                                    {/* Original (Wrong) */}
                                    <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100 bg-red-50/30 relative">
                                        <div className="absolute top-0 left-0 bg-red-100 text-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-br-lg">
                                            Trecho Original
                                        </div>
                                        <div className="mt-4 text-slate-600 italic font-serif text-lg leading-relaxed relative px-2">
                                            <span className="absolute -left-1 -top-1 text-4xl text-red-200 font-sans">"</span>
                                            {ex.original}
                                            <span className="absolute -bottom-4 text-4xl text-red-200 font-sans">"</span>
                                        </div>
                                    </div>

                                    {/* Corrected (Right) & Explanation */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="p-5 bg-green-50/30 flex-1 relative">
                                            <div className="absolute top-0 right-0 bg-green-100 text-green-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-lg">
                                                Reescrita Recomendada
                                            </div>
                                            <div className="mt-4 text-slate-800 font-medium text-lg leading-relaxed border-l-4 border-green-400 pl-4">
                                                {ex.corrected}
                                            </div>
                                        </div>
                                        
                                        {/* Technical Explanation */}
                                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 items-start">
                                            <span className="text-xl mt-0.5">👨‍🏫</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">
                                                    Análise Técnica
                                                </div>
                                                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                                    {ex.explanation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}
        
        {isCorrecting && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-50 transition-opacity">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-yellow-400 rounded-full animate-spin mb-8"></div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisando seu texto...</h3>
              <div className="text-slate-500 text-sm space-y-1 text-center">
                  <p>Verificando coesão e coerência...</p>
                  <p>Checando regras gramaticais...</p>
                  <p>Avaliando estrutura argumentativa...</p>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};
