import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Target, Shield, Zap, CheckCircle2, ChevronRight, Trophy, BarChart3 } from 'lucide-react';
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

type SubjectProgress = { theory: boolean; exercises: boolean };
/** missionId -> subjectId -> checks */
type MissionProgressMap = Record<string, Record<string, SubjectProgress>>;

interface MissionControlProps {
  userHistory?: any;
  onProgressSaved?: () => void;
}

const isFlatSubjectEntry = (val: unknown): boolean => {
  if (!val || typeof val !== 'object') return false;
  const e = val as Record<string, unknown>;
  return 'theoryDone' in e || 'theory' in e || 'exercisesDone' in e || 'exercises' in e || 'mastery' in e;
};

/** Normaliza histórico legado (flat) e novo (por missão). */
const parseMissionProgress = (raw: Record<string, any> | undefined): MissionProgressMap => {
  const result: MissionProgressMap = {};
  if (!raw || typeof raw !== 'object') return result;

  const missionIds = new Set(MISSIONS.map(m => m.id));

  Object.entries(raw).forEach(([key, val]) => {
    if (!val || typeof val !== 'object') return;

    // Formato novo: missionProgress.PRF_2025.constitucional = {...}
    if (missionIds.has(key) && !isFlatSubjectEntry(val)) {
      result[key] = result[key] || {};
      Object.entries(val as Record<string, any>).forEach(([subId, subVal]) => {
        if (!subVal || typeof subVal !== 'object') return;
        result[key][subId] = {
          theory: !!(subVal.theory || subVal.theoryDone),
          exercises: !!(subVal.exercises || subVal.exercisesDone),
        };
      });
      return;
    }

    // Formato legado flat: missionProgress.constitucional = {...}
    // Não compartilha entre missões — fica só como legado (ignorado na UI por missão).
  });

  return result;
};

export const MissionControl: React.FC<MissionControlProps> = ({ userHistory, onProgressSaved }) => {
  const [activeMission, setActiveMission] = useState(MISSIONS[0]);
  const [allProgress, setAllProgress] = useState<MissionProgressMap>({});

  useEffect(() => {
    setAllProgress(parseMissionProgress(userHistory?.missionProgress));
  }, [userHistory]);

  /** Checks somente da missão ativa */
  const progress = useMemo(
    () => allProgress[activeMission.id] || {},
    [allProgress, activeMission.id]
  );

  const theoryDone = useMemo(
    () => Object.values(progress).filter(p => p.theory).length,
    [progress]
  );
  const exercisesDone = useMemo(
    () => Object.values(progress).filter(p => p.exercises).length,
    [progress]
  );

  const overallProgress = useMemo(() => {
    const totalTasks = SUBJECTS.length * 2;
    const completed = theoryDone + exercisesDone;
    return Math.round((completed / totalTasks) * 100) || 0;
  }, [theoryDone, exercisesDone]);

  const toggleStatus = async (topicId: string, type: 'theory' | 'exercises') => {
    const missionId = activeMission.id;
    const currentMission = allProgress[missionId] || {};
    const currentSubject = currentMission[topicId] || { theory: false, exercises: false };

    const nextMission: Record<string, SubjectProgress> = {
      ...currentMission,
      [topicId]: {
        ...currentSubject,
        [type]: !currentSubject[type],
      },
    };

    const nextAll: MissionProgressMap = {
      ...allProgress,
      [missionId]: nextMission,
    };
    setAllProgress(nextAll);

    // Envia só o bucket da missão ativa (merge profundo no servidor)
    const missionPayload: Record<string, any> = {};
    Object.entries(nextMission).forEach(([id, val]) => {
      missionPayload[id] = {
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
        body: JSON.stringify({
          missionProgress: {
            [missionId]: missionPayload,
          },
        }),
      });
      onProgressSaved?.();
    } catch (e) {
      console.error('Erro ao salvar progresso da missão:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-fade-in pb-20">
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
                <span className="text-xs font-black uppercase tracking-widest">Progresso: {overallProgress}%</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Trocar Missão Alvo</p>
            {MISSIONS.map(m => {
              const mp = allProgress[m.id] || {};
              const done = Object.values(mp).reduce(
                (acc, p) => acc + (p.theory ? 1 : 0) + (p.exercises ? 1 : 0),
                0
              );
              const total = SUBJECTS.length * 2;
              const pct = Math.round((done / total) * 100) || 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMission(m)}
                  className={`px-6 sm:px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 text-left flex items-center gap-4
                    ${activeMission.id === m.id
                      ? 'bg-yellow-500 border-yellow-500 text-slate-950 shadow-xl shadow-yellow-500/20'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }
                  `}
                >
                  <span className="text-2xl shrink-0">{m.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{m.name}</span>
                    <span className={`block text-[9px] mt-1 tracking-wider ${activeMission.id === m.id ? 'text-slate-950/60' : 'text-slate-500'}`}>
                      {pct}% · {done}/{total} checks
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-yellow-500" />
              Análise de Infiltração
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">
              Somente {activeMission.name}
            </p>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <span>Teoria Concluída</span>
                  <span>{theoryDone} / {SUBJECTS.length}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${(theoryDone / SUBJECTS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <span>Exercícios Praticados</span>
                  <span>{exercisesDone} / {SUBJECTS.length}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${(exercisesDone / SUBJECTS.length) * 100}%` }}
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

        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 px-2 sm:px-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
              Mapa · {activeMission.icon} {activeMission.id === 'PRF_2025' ? 'PRF' : activeMission.id === 'PF_AGENTE' ? 'PF' : 'PC-SP'}
            </h3>
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
                key={`${activeMission.id}-${sub.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                className="group bg-white rounded-[2rem] border border-slate-200 p-4 sm:p-6 hover:border-yellow-500/30 transition-all flex items-center justify-between gap-3 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-110 transition-transform shrink-0">
                    {sub.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">{sub.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sub.topics.length} Tópicos</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  <button
                    onClick={() => toggleStatus(sub.id, 'theory')}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all border-2
                      ${progress[sub.id]?.theory
                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-white border-slate-100 text-slate-200 hover:border-blue-200 hover:text-blue-200'
                      }
                    `}
                    title={`Teoria · ${activeMission.name}`}
                  >
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  <button
                    onClick={() => toggleStatus(sub.id, 'exercises')}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all border-2
                      ${progress[sub.id]?.exercises
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-white border-slate-100 text-slate-200 hover:border-emerald-200 hover:text-emerald-200'
                      }
                    `}
                    title={`Exercícios · ${activeMission.name}`}
                  >
                    <Target className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  <div className="w-[1px] h-10 bg-slate-100 mx-1 sm:mx-2 hidden sm:block" />

                  <button className="p-2 sm:p-3 text-slate-300 hover:text-slate-900 transition-colors hidden sm:block">
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
