import React, { useMemo, useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { SUBJECTS } from '../constants';
import { apiJson } from '../services/apiClient';

function isCorrectRecord(q: any): boolean {
  return q.correct === true || q.isCorrect === true;
}

function getSubject(q: any): string {
  return q.question?.materia || q.subject || 'Geral';
}

export const Dashboard: React.FC = () => {
  const [history, setHistory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiJson<{ history: any }>('/api/user/history');
        setHistory(data.history || { answeredQuestions: {} });
      } catch (e) {
        console.error("Erro ao buscar histórico:", e);
        setHistory({ answeredQuestions: {} });
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const stats = useMemo(() => {
    if (!history || !history.answeredQuestions) return {
      total: 0,
      correct: 0,
      accuracy: 0,
      mastery: [] as any[],
      evolution: [] as any[],
      totalHours: 0,
      streak: 0,
    };

    const questions = Object.values(history.answeredQuestions || {}) as any[];
    const total = questions.length;
    const correct = questions.filter(isCorrectRecord).length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    const studySessions = history.studySessions || [];
    const totalStudySeconds = studySessions.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);
    const questionsSeconds = questions.reduce((acc: number, q: any) => acc + ((q.responseTime || 0) / 1000), 0);
    const totalHours = (totalStudySeconds + questionsSeconds) / 3600;
    const streak = history.streak || 0;

    const subjectStats: Record<string, { total: number, correct: number }> = {};
    questions.forEach(q => {
      const subject = getSubject(q);
      if (!subjectStats[subject]) subjectStats[subject] = { total: 0, correct: 0 };
      subjectStats[subject].total++;
      if (isCorrectRecord(q)) subjectStats[subject].correct++;
    });

    const mastery = SUBJECTS.map(s => {
      const stat = subjectStats[s.name] || { total: 0, correct: 0 };
      const acerto = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      return {
        name: s.name,
        icon: s.icon,
        acerto,
        total: stat.total,
        category: s.category,
        status: acerto >= 80 ? 'Elite' : acerto >= 60 ? 'Combatente' : 'Recruta'
      };
    }).filter(s => s.total > 0 || s.category === 'BASICAS');

    const dayKeys = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const evolution = dayKeys.map((dayDate) => {
      const dayLabel = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const start = dayDate.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const dayQs = questions.filter(q => {
        const ts = q.timestamp || 0;
        return ts >= start && ts < end;
      });
      const dayCorrect = dayQs.filter(isCorrectRecord).length;
      const acerto = dayQs.length > 0 ? Math.round((dayCorrect / dayQs.length) * 100) : 0;
      return { day: dayLabel, acerto };
    });

    return { total, correct, accuracy, mastery, evolution, totalHours, streak };
  }, [history]);

  const criticalSubjects = stats.mastery.filter(d => d.total > 0 && d.acerto < 60);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Questões Resolvidas" 
          value={stats.total.toLocaleString()} 
          trend="+12%" 
          trendPositive={true} 
          icon="🎯"
        />
        <MetricCard 
          label="Taxa de Acerto Geral" 
          value={`${stats.accuracy.toFixed(1)}%`} 
          trend={stats.accuracy > 70 ? "Excelente" : "Em evolução"} 
          trendPositive={stats.accuracy > 70} 
          icon="📊"
        />
        <MetricCard 
          label="Horas de Estudo" 
          value={stats.totalHours > 0 ? `${stats.totalHours.toFixed(1)}h` : "0.0h"} 
          trend={stats.totalHours > 1 ? "Foco Total" : "Iniciando"} 
          trendPositive={true} 
          icon="⏱️"
        />
        <MetricCard 
          label="Sequência Ativa" 
          value={`${stats.streak} dias`} 
          trend={stats.streak > 0 ? "Fogo!" : "Comece hoje"} 
          trendPositive={stats.streak > 0} 
          icon="🔥"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Evolução de Performance</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Acertos reais nos últimos 7 dias</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolution}>
                <defs>
                  <linearGradient id="colorAcerto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="acerto" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorAcerto)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white flex flex-col">
          <div className="mb-8">
            <h3 className="text-yellow-500 text-xs font-black uppercase tracking-[0.2em] mb-2">Gargalos de Aprendizado</h3>
            <h4 className="text-2xl font-bold leading-tight">Matérias com Desempenho Crítico</h4>
          </div>
          
          <div className="flex-1 space-y-4">
            {criticalSubjects.length > 0 ? (
              criticalSubjects.map((s, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{s.name}</p>
                      <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">{s.acerto}% de Aproveitamento</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-green-400 font-bold">Excelente! Nenhuma matéria abaixo da meta de 60%.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white p-5 sm:p-10 rounded-3xl sm:rounded-[4rem] shadow-xl border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-10 gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Mapa de Maestria Policial</h3>
              <p className="text-slate-400 text-sm font-medium">Nível de conhecimento teórico vs Prática em questões</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-start md:justify-end">
               <LegendItem color="bg-yellow-500" label="Elite (80%+)" />
               <LegendItem color="bg-slate-900" label="Combatente (60%+)" />
               <LegendItem color="bg-slate-200" label="Recruta (&lt;60%)" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {stats.mastery.map((m, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{m.name}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${m.acerto >= 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.acerto}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${m.acerto >= 80 ? 'bg-yellow-500' : m.acerto >= 60 ? 'bg-slate-900' : 'bg-slate-300'}`}
                    style={{ width: `${m.acerto}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, trend, trendPositive, icon }: any) => (
  <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-lg border border-slate-200 flex flex-col justify-between hover:shadow-2xl transition-all group min-w-0">
    <div className="flex justify-between items-start mb-4 gap-2">
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform shrink-0">
        {icon}
      </div>
      <span className={`text-[10px] font-black px-2 sm:px-3 py-1 rounded-full shrink-0 ${trendPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {trend}
      </span>
    </div>
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter break-words">{value}</p>
    </div>
  </div>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2">
    <div className={`w-3 h-3 rounded-full ${color}`}></div>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);
