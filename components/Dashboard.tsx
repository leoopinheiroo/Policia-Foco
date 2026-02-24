
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { SUBJECTS } from '../constants';

const MOCK_WEEKLY_EVOLUTION = [
  { day: 'Seg', acerto: 65, volume: 45 },
  { day: 'Ter', acerto: 72, volume: 52 },
  { day: 'Qua', acerto: 68, volume: 38 },
  { day: 'Qui', acerto: 75, volume: 60 },
  { day: 'Sex', acerto: 82, volume: 48 },
  { day: 'Sab', acerto: 78, volume: 85 },
  { day: 'Dom', acerto: 85, volume: 20 },
];

export const Dashboard: React.FC = () => {
  // Calculando dados de maestria baseados nas matérias reais
  const masteryData = useMemo(() => {
    return SUBJECTS.slice(0, 8).map(s => {
      const acerto = Math.floor(Math.random() * 60) + 30; // Mock de 30% a 90%
      return {
        name: s.name,
        icon: s.icon,
        acerto,
        status: acerto >= 80 ? 'Elite' : acerto >= 60 ? 'Combatente' : 'Recruta'
      };
    });
  }, []);

  const criticalSubjects = masteryData.filter(d => d.acerto < 60);

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in">
      {/* 1. HUD DE MÉTRICAS GLOBAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Questões Resolvidas" 
          value="1.428" 
          trend="+12%" 
          trendPositive={true} 
          icon="🎯"
        />
        <MetricCard 
          label="Taxa de Acerto Geral" 
          value="74.2%" 
          trend="-2.1%" 
          trendPositive={false} 
          icon="📊"
        />
        <MetricCard 
          label="Horas de Estudo" 
          value="156h" 
          trend="+8h hoje" 
          trendPositive={true} 
          icon="⏱️"
        />
        <MetricCard 
          label="Sequência Ativa" 
          value="14 Dias" 
          trend="Recorde!" 
          trendPositive={true} 
          icon="🔥"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. EVOLUÇÃO SEMANAL (GRÁFICO PRINCIPAL) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Evolução de Performance</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Comparativo de Acertos nos últimos 7 dias</p>
            </div>
            <select className="bg-slate-50 border-none rounded-xl text-xs font-black p-2 outline-none">
              <option>Última Semana</option>
              <option>Último Mês</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_WEEKLY_EVOLUTION}>
                <defs>
                  <linearGradient id="colorAcerto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="acerto" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorAcerto)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. ALERTA DE PONTOS CEGOS */}
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
                  <button className="w-8 h-8 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    🔥
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-green-400 font-bold">Excelente! Nenhuma matéria abaixo da meta de 60%.</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 p-5 bg-white/5 rounded-2xl border border-dashed border-white/20">
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              "A aprovação é decidida nas matérias que você menos gosta. Foque no erro para garantir o acerto."
            </p>
          </div>
        </div>

        {/* 4. MAPA DE MAESTRIA DETALHADO */}
        <div className="lg:col-span-3 bg-white p-10 rounded-[4rem] shadow-xl border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Mapa de Maestria Policial</h3>
              <p className="text-slate-400 text-sm font-medium">Nível de conhecimento teórico vs Prática em questões</p>
            </div>
            <div className="flex gap-4">
               <LegendItem color="bg-yellow-500" label="Elite (80%+)" />
               <LegendItem color="bg-slate-900" label="Combatente (60%+)" />
               <LegendItem color="bg-slate-200" label="Recruta (<60%)" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {masteryData.map((m, idx) => (
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
                  <div className="absolute top-0 left-[80%] w-0.5 h-full bg-red-400/30 border-r border-dashed border-red-500/50" title="Linha de Aprovação"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Componentes Auxiliares
const MetricCard = ({ label, value, trend, trendPositive, icon }: any) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-200 flex flex-col justify-between hover:shadow-2xl transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${trendPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {trend}
      </span>
    </div>
    <div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </div>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2">
    <div className={`w-3 h-3 rounded-full ${color}`}></div>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);
