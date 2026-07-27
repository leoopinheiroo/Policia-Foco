
import React, { useState, useMemo } from 'react';
import { VADE_MECUM_DATA } from '../constants';

export const VadeMecum: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("TODOS");

  const categories = useMemo(() => {
    const cats = new Set(VADE_MECUM_DATA.map(item => item.category));
    return ["TODOS", ...Array.from(cats)];
  }, []);

  const filteredLegislation = useMemo(() => {
    return VADE_MECUM_DATA.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === "TODOS" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
      {/* Header Profissional */}
      <div className="bg-slate-900 rounded-[3rem] p-12 md:p-16 text-white mb-12 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <span className="text-yellow-500">⚖️</span> Vade Mecum Digital
          </h2>
          <p className="text-slate-400 text-lg md:text-xl font-light max-w-2xl leading-relaxed">
            Acesso instantâneo à base jurídica nacional atualizada. Legislação compilada diretamente dos portais oficiais para garantir precisão absoluta no seu estudo.
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Toolbar: Busca e Filtros */}
      <div className="flex flex-col lg:flex-row gap-6 mb-12 items-center justify-between">
        <div className="w-full lg:max-w-md relative">
          <input 
            type="text" 
            placeholder="Buscar lei, número ou tema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-4 pl-14 text-slate-700 font-medium focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none shadow-sm transition-all"
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                ${activeCategory === cat 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Legislação */}
      {filteredLegislation.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLegislation.map((item, idx) => (
            <a 
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-yellow-500/30 transition-all transform hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="bg-slate-50 text-slate-500 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100">
                    {item.category}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-yellow-600 group-hover:bg-yellow-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 group-hover:text-slate-950 transition-colors leading-tight mb-2">
                  {item.name}
                </h3>
              </div>
              <div className="mt-8 flex items-center gap-3 text-slate-400 group-hover:text-yellow-600 transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Consultar Planalto</span>
                <div className="flex-1 h-[1px] bg-slate-100 group-hover:bg-yellow-100 transition-colors"></div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[4rem] p-24 text-center border-4 border-dashed border-slate-100">
          <div className="text-6xl mb-6 opacity-20">📖</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Nenhuma lei encontrada</h3>
          <p className="text-slate-400 font-medium">Tente ajustar sua busca ou mudar a categoria selecionada.</p>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-16 bg-blue-50 border border-blue-100 p-8 rounded-[3rem] flex items-start gap-6">
        <div className="text-4xl">💡</div>
        <div>
          <h4 className="text-blue-900 font-black uppercase text-xs tracking-widest mb-2">Dica de Estudo:</h4>
          <p className="text-blue-800/80 leading-relaxed font-medium">
            Muitas questões de concursos policiais exigem a <span className="font-bold">literalidade da lei</span> (lei seca). Use nosso Vade Mecum para revisar os artigos fundamentais enquanto resolve as questões comentadas. Clique nos links para ser direcionado às versões mais atualizadas no site do Planalto.
          </p>
        </div>
      </div>
    </div>
  );
};
