
import React, { useState } from 'react';
import { QuestionFilters, QuestionType } from '../types';
import { SUBJECTS } from '../constants';

interface QuestionFilterProps {
  onFilter: (filters: QuestionFilters) => void;
}

export const QuestionFilter: React.FC<QuestionFilterProps> = ({ onFilter }) => {
  const [filters, setFilters] = useState<QuestionFilters>({
    status: 'TODAS',
  });

  const handleApply = () => {
    onFilter(filters);
  };

  const handleClear = () => {
    const cleared = { status: 'TODAS' as const };
    setFilters(cleared);
    onFilter(cleared);
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-8 mb-10 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <span className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center text-lg">🔍</span>
          Filtro Avançado de Questões
        </h3>
        <button 
          onClick={handleClear}
          className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-all"
        >
          Limpar Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Minhas Questões (Status) */}
        <div className="col-span-1 md:col-span-3">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Minhas Questões</label>
          <div className="flex flex-wrap gap-2">
            {(['TODAS', 'RESOLVIDAS', 'NAO_RESOLVIDAS', 'ACERTEI', 'ERREI'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilters({ ...filters, status: s })}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                  ${filters.status === s 
                    ? 'bg-slate-950 border-slate-950 text-white shadow-lg' 
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}
                `}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Disciplina */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Disciplina</label>
          <select
            value={filters.materia || ''}
            onChange={(e) => setFilters({ ...filters, materia: e.target.value || undefined, assunto: undefined })}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-yellow-500 transition-all"
          >
            <option value="">Todas as Disciplinas</option>
            {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        {/* Assunto */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assunto</label>
          <select
            value={filters.assunto || ''}
            onChange={(e) => setFilters({ ...filters, assunto: e.target.value || undefined })}
            disabled={!filters.materia}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-yellow-500 transition-all disabled:opacity-50"
          >
            <option value="">Todos os Assuntos</option>
            {filters.materia && SUBJECTS.find(s => s.name === filters.materia)?.topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Tipo de Questão */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Modalidade</label>
          <select
            value={filters.tipo || ''}
            onChange={(e) => setFilters({ ...filters, tipo: e.target.value as QuestionType || undefined })}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-yellow-500 transition-all"
          >
            <option value="">Todas as Modalidades</option>
            <option value="CERTO_ERRADO">Certo / Errado</option>
            <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
          </select>
        </div>

        {/* Banca */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Banca</label>
          <select
            value={filters.banca || ''}
            onChange={(e) => setFilters({ ...filters, banca: e.target.value || undefined })}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-yellow-500 transition-all"
          >
            <option value="">Todas as Bancas</option>
            <option value="CEBRASPE">CEBRASPE</option>
            <option value="FGV">FGV</option>
            <option value="VUNESP">VUNESP</option>
            <option value="FCC">FCC</option>
          </select>
        </div>

        {/* Ano */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ano</label>
          <select
            value={filters.ano || ''}
            onChange={(e) => setFilters({ ...filters, ano: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-yellow-500 transition-all"
          >
            <option value="">Todos os Anos</option>
            {[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleApply}
          className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          Filtrar Questões →
        </button>
      </div>
    </div>
  );
};
