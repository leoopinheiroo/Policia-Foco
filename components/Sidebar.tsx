
import React from 'react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  onLogout: () => void;
  userType?: string;
  userName?: string;
}

const MenuItems: { id: ViewState; label: string; icon: string }[] = [
  { id: 'HOME', label: 'Início', icon: '🏠' },
  { id: 'MISSION_CONTROL', label: 'Missões Alvo', icon: '🎯' },
  { id: 'RANKING', label: 'Ranking Elite', icon: '🏆' },
  { id: 'DOSSIER', label: 'Dossiê de Evidências', icon: '📂' },
  { id: 'GENIUS_IA', label: 'Genius IA', icon: '🧠' },
  { id: 'MENTORIA', label: 'Mentoria IA', icon: '👨‍🏫' },
  { id: 'SUBJECTS', label: 'Estudar por Matéria', icon: '📚' },
  { id: 'SIMULADOS', label: 'Simulados', icon: '📝' },
  { id: 'REDACAO', label: 'Redação', icon: '✍️' },
  { id: 'FLASHCARDS', label: 'Flashcards', icon: '🗂️' },
  { id: 'DASHBOARD', label: 'Desempenho', icon: '📊' },
  { id: 'VADE_MECUM', label: 'Vade Mecum', icon: '⚖️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onChangeView, 
  isOpen, 
  setIsOpen, 
  onLogout,
  userType = 'ELITE',
  userName = 'Operador'
}) => {
  const isGuest = userType === 'VISITANTE';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full bg-slate-900 text-white z-30 transition-transform duration-300 ease-in-out
        w-64 flex flex-col shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-yellow-400">GeniusAI</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Alta Performance</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {MenuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onChangeView(item.id);
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                    ${currentView === item.id 
                      ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* Debug Panel for Developer */}
          {(userName.includes('Dev') || userType === 'ELITE') && (
            <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Status do Sistema</p>
              <button 
                onClick={async () => {
                  try {
                    const [healthRes, debugRes] = await Promise.all([
                      fetch('/api/health'),
                      fetch('/api/debug-config')
                    ]);
                    const health = await healthRes.json();
                    const debug = await debugRes.json();
                    alert(`Status: ${health.status}\nSupabase: ${health.supabase ? 'OK' : 'FALHA'}\nDB: ${health.database_connectivity}\nErro: ${health.database_error || 'Nenhum'}\n\nURL: ${debug.url_status}\nKey: ${debug.service_key_status}`);
                  } catch (e) {
                    alert('Erro ao conectar com a API');
                  }
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black text-slate-400 transition-all"
              >
                DIAGNÓSTICO TÉCNICO
              </button>
            </div>
          )}
          <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${isGuest ? 'from-blue-400 to-indigo-500' : 'from-yellow-400 to-orange-500'} flex items-center justify-center text-slate-900 font-bold text-xs`}>
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className={`text-[10px] ${isGuest ? 'text-blue-400/70' : 'text-yellow-500/70'} font-black uppercase tracking-widest`}>
                Plano {userType}
              </p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-3 text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition"
          >
            {isGuest ? 'Encerrar Demonstração' : 'Sair do Treinamento'}
          </button>
        </div>
      </div>
    </>
  );
};
