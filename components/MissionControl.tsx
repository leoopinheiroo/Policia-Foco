
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Target, Shield, Zap, CheckCircle2, Circle, Lock, ChevronRight, Trophy, BarChart3 } from 'lucide-react';
import { SUBJECTS } from '../constants';
import { apiJson } from '../services/apiClient';

const MISSIONS = [
  {
    id: 'PRF_2025',
    name: 'Operação Rodoviária (PRF)',
    description: 'Foco total no edital da Polícia Rodoviária Federal. Ênfase em Trânsito e Física.',
    icon: '🛣️',
    difficulty: 'Hard',
    briefing: 'A PRF exige um perfil versátil. O domínio da legislação de trânsito é o seu maior trunfo, mas não negligencie as exatas, que são o divisor de águas entre aprovados e excedentes.'
  },
  {
    id: 'PF_AGENTE',
    name: 'Infiltração Federal (PF)',
    description: 'Foco no cargo de Agente da Polícia Federal. Ênfase em Contabilidade e TI.',
    icon: '🕵️',
    difficulty: 'Extreme',
    briefing: 'A Polícia Federal mudou o jogo. Contabilidade e Informática agora pesam tanto quanto o Direito. Sua missão é equilibrar o conhecimento técnico com a base jurídica sólida.'
  },
  {
    id: 'PC_SP_INVEST',
    name: 'Investigação Civil (PC-SP)',
    description: 'Foco na Polícia Civil de São Paulo. Ênfase em Criminologia e Direito.',
    icon: '🚔',
    difficulty: 'Medium',
    briefing: 'A PC-SP valoriza a tradição jurídica e a análise criminológica. Domine o Código Penal e Processual, mas dê atenção especial à Criminologia, que define o perfil do investigador paulista.'
  }
];

interface MissionControlProps {
  userHistory?: any;
  onProgressSaved?: () => void;
}

export const MissionControl: React.FC<MissionControlProps> = ({ userHistory, onProgressSaved }) => {
  const [activeMission, setActiveMission] = useState(MISSIONS[0]);
  const [progress, setProgress] = useState<Record<string, { theory: boolean; exercises: boolean }>>({});

  useEffect(() => {
    const mp = userHistory?.missionProgress || {};
    const mapped: Record<string, { theory: boolean; exercises: boolean }> = {};
    Object.keys(mp).forEach(key => {
      mapped[key] = {
        theory: !!(mp[key]?.theory || mp[key]?.theoryDone),
        exercises: !!(mp[key]?.exercises || mp[key]?.exercisesDone),
      };
    });
    setProgress(mapped);
  }, [userHistory]);

  const toggleStatus = async (topicId: string, type: 'theory' | 'exercises') => {
    const next = {
      ...progress,
      [topicId]: {
        ...progress[topicId],
        [type]: !progress[topicId]?.[type]
      }
    };
    setProgress(next);

    const missionProgress: Record<string, any> = {};
    Object.entries(next).forEach(([id, val]) => {
      missionProgress[id] = {
        theoryDone: !!val.theory,
        exercisesDone: !!val.exercises,
        theory: !!val.theory,
        exercises: !!val.exercises,
        mastery: (val.theory ? 50 : 0) + (val.exercises ? 50 : 0),
      };
    });

    try {
      await apiJson('/api/user/history/save', {
        method: 'POST',
        body: JSON.stringify({ missionProgress }),
      });
      onProgressSaved?.();
    } catch (e) {
      console.error('Erro ao salvar progresso da missão:', e);
    }
  };

  const calculateOverallProgress = () => {
    const totalTasks = SUBJECTS.length * 2;
    const completedTasks = Object.values(progress).reduce((acc, curr) => {
      return acc + (curr.theory ? 1 : 0) + (curr.exercises ? 1 : 0);
    }, 0);
    return Math.round((completedTasks / totalTasks) * 100) || 0;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-fade-in pb-20">
      {/* Mission Header */}
      <header className="bg-slate-950 rounded-3xl sm:rounded-[4rem] p-6 sm:p-12 md:p-16 text-white relative overflow-hidden border border-white/5 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-3 bg-yellow-500/10 text-yellow-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-yellow-500/20">
              <Shield className="w-4 h-4" />
              CENTRO DE COMANDO DE MISSÃO
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-6 tracking-tighter leading-tight">
              {activeMission.name}
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
              {activeMission.briefing}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-xs font-black uppercase tracking-widest">Dificuldade: {activeMission.difficulty}</span>
              </div>
              <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                <Trophy className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest">Progresso: {calculateOverallProgress()}%</span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-auto flex flex-col gap-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Trocar Missão Alvo</p>
            {MISSIONS.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMission(m)}
                className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 text-left flex items-center gap-4
                  ${activeMission.id === m.id 
                    ? 'bg-yellow-500 border-yellow-500 text-slate-950 shadow-xl shadow-yellow-500/20' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }
                `}
              >
                <span className="text-2xl">{m.icon}</span>
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />
      </header>

      {/* Mission Map (Verticalized Syllabus Reimagined) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Stats & Meta */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-yellow-500" />
              Análise de Infiltração
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <span>Teoria Concluída</span>
                  <span>{Object.values(progress).filter(p => p.theory).length} / {SUBJECTS.length}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000" 
                    style={{ width: `${(Object.values(progress).filter(p => p.theory).length / SUBJECTS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <span>Exercícios Praticados</span>
                  <span>{Object.values(progress).filter(p => p.exercises).length} / {SUBJECTS.length}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${(Object.values(progress).filter(p => p.exercises).length / SUBJECTS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[3rem] p-10 text-white border border-white/5 shadow-xl">
            <h3 className="text-xl font-black mb-6">Dica do Comandante</h3>
            <p className="text-slate-400 text-sm leading-relaxed italic">
              {activeMission.id === 'PRF_2025' && '"A PRF não é apenas sobre leis, é sobre aplicação. Domine a CTB como se sua vida dependesse disso, pois na prova, ela dependerá."'}
              {activeMission.id === 'PF_AGENTE' && '"Na PF, a Informática e a Contabilidade são as novas armas. Se você não dominar o banco de dados e as partidas dobradas, estará fora de combate."'}
              {activeMission.id === 'PC_SP_INVEST' && '"A Polícia Civil de São Paulo exige faro jurídico. Criminologia é o diferencial. Entenda a mente do criminoso para garantir sua vaga."'}
            </p>
          </div>
        </div>

        {/* Right Column: The Map Nodes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-8 px-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Mapa de Infiltração</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-3 h-3 bg-blue-500 rounded-full" /> Teoria
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" /> Exercícios
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {SUBJECTS.map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white rounded-[2rem] border border-slate-200 p-6 hover:border-yellow-500/30 transition-all flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {sub.icon}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 tracking-tight">{sub.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sub.topics.length} Tópicos Estratégicos</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Theory Toggle */}
                  <button
                    onClick={() => toggleStatus(sub.id, 'theory')}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border-2
                      ${progress[sub.id]?.theory 
                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-white border-slate-100 text-slate-200 hover:border-blue-200 hover:text-blue-200'
                      }
                    `}
                    title="Marcar Teoria como Concluída"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </button>

                  {/* Exercises Toggle */}
                  <button
                    onClick={() => toggleStatus(sub.id, 'exercises')}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border-2
                      ${progress[sub.id]?.exercises 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-white border-slate-100 text-slate-200 hover:border-emerald-200 hover:text-emerald-200'
                      }
                    `}
                    title="Marcar Exercícios como Concluídos"
                  >
                    <Target className="w-6 h-6" />
                  </button>

                  <div className="w-[1px] h-10 bg-slate-100 mx-2" />

                  <button className="p-3 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
