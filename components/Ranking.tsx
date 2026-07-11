import React, { useEffect, useState } from 'react';
import { Trophy, Medal, TrendingUp, Users } from 'lucide-react';
import { RankEntry } from '../types';
import { apiJson } from '../services/apiClient';

interface RankingProps {
  userName: string;
}

export const Ranking: React.FC<RankingProps> = ({ userName }) => {
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiJson<{ ranking: RankEntry[]; myPosition: number | null }>('/api/user/ranking');
        setRanking(data.ranking || []);
        setMyPosition(data.myPosition);
      } catch (e) {
        console.error(e);
        setRanking([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const me = ranking.find(r => r.isCurrentUser) || ranking.find(r => r.name === userName);
  const top3 = ranking.slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in pb-20">
      <header className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-[4rem] p-12 md:p-16 text-slate-950 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-3 bg-black/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-black/5">
              <Trophy className="w-4 h-4" />
              RANKING GLOBAL DE OPERADORES
            </div>
            <h2 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter leading-tight">
              Elite do Treinamento
            </h2>
            <p className="text-black/60 text-lg font-bold max-w-md">
              Posição baseada no XP real: questões, acertos, streak e sessões de estudo.
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-md p-10 rounded-[3rem] border border-white/30 text-center min-w-[240px]">
            <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Sua Posição</div>
            <div className="text-7xl font-black tracking-tighter mb-2">
              {myPosition ? `#${String(myPosition).padStart(2, '0')}` : '—'}
            </div>
            <div className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white px-4 py-1.5 rounded-full inline-block">
              Nível {me?.level || 1}
            </div>
          </div>
        </div>
      </header>

      {top3.length >= 3 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
          <div className="order-2 md:order-1 bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl text-center relative pt-20">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl border-4 border-white">
              {top3[1].avatar}
            </div>
            <div className="absolute top-6 right-6 w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500">2</div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{top3[1].name}</h3>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6">Nível {top3[1].level}</div>
            <div className="bg-slate-50 py-3 rounded-2xl font-black text-slate-900">{top3[1].xp.toLocaleString()} XP</div>
          </div>

          <div className="order-1 md:order-2 bg-slate-950 rounded-[3.5rem] p-12 border border-yellow-500/30 shadow-2xl text-center relative pt-24 transform scale-105 z-10">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-500 rounded-[2.5rem] flex items-center justify-center text-7xl shadow-2xl border-8 border-slate-950">
              {top3[0].avatar}
            </div>
            <div className="absolute top-8 right-8 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-slate-950">
              <Medal className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">{top3[0].name}</h3>
            <div className="text-yellow-500/60 text-[10px] font-black uppercase tracking-widest mb-8">Nível {top3[0].level}</div>
            <div className="bg-white/5 border border-white/10 py-4 rounded-2xl font-black text-yellow-500 text-xl">
              {top3[0].xp.toLocaleString()} XP
            </div>
          </div>

          <div className="order-3 bg-white rounded-[3rem] p-10 border border-yellow-500/20 shadow-xl text-center relative pt-20">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-50 rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl border-4 border-white">
              {top3[2].avatar}
            </div>
            <div className="absolute top-6 right-6 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600">3</div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{top3[2].name}</h3>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6">Nível {top3[2].level}</div>
            <div className="bg-orange-50 py-3 rounded-2xl font-black text-orange-600">{top3[2].xp.toLocaleString()} XP</div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] p-12 text-center border border-slate-200">
          <p className="font-bold text-slate-500">Ainda há poucos operadores no ranking. Continue treinando para subir!</p>
        </div>
      )}

      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <Users className="w-6 h-6 text-slate-400" />
            Classificação Geral
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> XP real
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {ranking.slice(3).map((user, idx) => (
            <div key={`${user.name}-${idx}`} className={`p-8 flex items-center justify-between hover:bg-slate-50 transition-colors ${user.isCurrentUser ? 'bg-yellow-50' : ''}`}>
              <div className="flex items-center gap-8">
                <span className="text-2xl font-black text-slate-200 w-8">{(idx + 4).toString().padStart(2, '0')}</span>
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">
                  {user.avatar}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">{user.name}{user.isCurrentUser ? ' (você)' : ''}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível {user.level}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-slate-900">{user.xp.toLocaleString()}</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pontos de Experiência</div>
              </div>
            </div>
          ))}
          {ranking.length === 0 && (
            <div className="p-10 text-center text-slate-400 font-bold">Nenhum dado ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
};
