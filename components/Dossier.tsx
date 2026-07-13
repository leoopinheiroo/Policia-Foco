
import React from 'react';
import { motion } from 'motion/react';
import { Folder, FileText, Search, Trash2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Question } from '../types';

interface DossierProps {
  userHistory: any;
  onReviewQuestion: (q: Question) => void;
}

export const Dossier: React.FC<DossierProps> = ({ userHistory, onReviewQuestion }) => {
  const savedIds = userHistory?.savedQuestions || [];
  const savedQuestions = Object.values(userHistory?.answeredQuestions || {})
    .filter((record: any) => savedIds.includes(record.question.id))
    .map((record: any) => record.question);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-20">
      {/* Header */}
      <header className="bg-slate-900 rounded-3xl sm:rounded-[3rem] p-6 sm:p-12 md:p-16 text-white mb-8 sm:mb-12 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-4 flex items-center gap-3 sm:gap-4 flex-wrap">
            <Folder className="text-yellow-500 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 shrink-0" /> Dossiê de Evidências
          </h2>
          <p className="text-slate-400 text-lg md:text-xl font-light max-w-2xl leading-relaxed">
            Seu arquivo secreto de questões críticas. Salve itens complexos, pegadinhas recorrentes e jurisprudências para revisão tática antes da prova.
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl"></div>
      </header>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-6 mb-12">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Pesquisar no dossiê..."
            className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-4 pl-14 text-slate-700 font-medium focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm transition-all"
          />
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Recentes</button>
          <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Por Matéria</button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {savedQuestions.length > 0 ? (
          savedQuestions.map((q: any, idx: number) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-12 shadow-sm hover:shadow-xl hover:border-yellow-500/30 transition-all"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-3 mb-6">
                    <span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                      {q.materia}
                    </span>
                    <span className="bg-slate-50 text-slate-400 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100">
                      {q.assunto}
                    </span>
                    <span className="bg-yellow-500/10 text-yellow-700 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-yellow-500/20">
                      {q.banca} {q.ano}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-snug mb-8 line-clamp-3">
                    {q.texto}
                  </h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => onReviewQuestion(q)}
                      className="flex items-center gap-2 bg-slate-950 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> Revisar Item
                    </button>
                    <button className="flex items-center gap-2 bg-slate-50 text-slate-400 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-all">
                      <Trash2 className="w-3 h-3" /> Remover
                    </button>
                  </div>
                </div>
                
                <div className="w-full md:w-64 bg-slate-50 rounded-3xl p-6 border border-slate-100">
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    <ShieldAlert className="w-3 h-3 text-orange-500" /> Alerta de Pegadinha
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "Este item costuma confundir o candidato na distinção entre dolo eventual e culpa consciente."
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="bg-white rounded-3xl sm:rounded-[4rem] p-10 sm:p-24 text-center border-4 border-dashed border-slate-100">
            <div className="text-6xl mb-6 opacity-20">📂</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Seu dossiê está vazio</h3>
            <p className="text-slate-400 font-medium">Salve questões importantes durante seus treinos para que elas apareçam aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
};
