
import React, { useMemo } from 'react';
import { UserHistory, Question } from '../types';
import { motion } from 'motion/react';
import { Brain, Target, Clock, AlertCircle, Play, ChevronRight, BookOpen, TrendingDown } from 'lucide-react';

interface GeniusIAProps {
  userHistory: UserHistory | null;
  onStartIntensive: (subject: string, topic?: string) => void;
  onReviewQuestion: (question: Question) => void;
}

export const GeniusIA: React.FC<GeniusIAProps> = ({ userHistory, onStartIntensive, onReviewQuestion }) => {
  const analysis = useMemo(() => {
    if (!userHistory || !userHistory.answeredQuestions) return null;

    const subjectStats: Record<string, { total: number; errors: number; totalTime: number; questions: Question[] }> = {};
    const topicStats: Record<string, { name: string; subject: string; total: number; errors: number }> = {};
    
    Object.values(userHistory.answeredQuestions).forEach((record: any) => {
      const subject = record.question.materia;
      const topic = record.question.assunto;
      const topicKey = `${subject}|${topic}`;

      // Subject stats
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, errors: 0, totalTime: 0, questions: [] };
      }
      subjectStats[subject].total++;
      if (!record.correct) {
        subjectStats[subject].errors++;
        subjectStats[subject].questions.push(record.question);
      }
      subjectStats[subject].totalTime += record.responseTime || 0;

      // Topic stats
      if (!topicStats[topicKey]) {
        topicStats[topicKey] = { name: topic, subject: subject, total: 0, errors: 0 };
      }
      topicStats[topicKey].total++;
      if (!record.correct) {
        topicStats[topicKey].errors++;
      }
    });

    const subjects = Object.entries(subjectStats).map(([name, data]) => ({
      name,
      ...data,
      errorRate: (data.errors / data.total) * 100,
      avgTime: data.totalTime / data.total
    })).sort((a, b) => b.errorRate - a.errorRate);

    const topics = Object.entries(topicStats).map(([key, data]) => ({
      ...data,
      errorRate: (data.errors / data.total) * 100
    })).filter(t => t.total >= 2) // Only consider topics with at least 2 questions
      .sort((a, b) => b.errorRate - a.errorRate);

    const weakSubject = subjects[0];
    const weakTopic = topics[0];

    return {
      subjects,
      weakSubject,
      weakTopic
    };
  }, [userHistory]);

  if (!analysis || analysis.subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-[3rem] border border-slate-200 shadow-xl">
        <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mb-8">
          <Brain className="w-12 h-12 text-yellow-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Sua IA está em fase de coleta</h2>
        <p className="text-slate-500 max-w-md font-medium leading-relaxed">
          Resolva algumas questões para que o Genius IA possa analisar seu desempenho e identificar seus pontos fracos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Header / Diagnostic */}
      <header className="bg-slate-950 rounded-[4rem] p-12 md:p-16 text-white relative overflow-hidden border border-white/5 shadow-2xl">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-yellow-500/10 text-yellow-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-yellow-500/20">
            <Brain className="w-4 h-4" />
            DIAGNÓSTICO GENIUS IA
          </div>
          
          <h2 className="text-5xl md:text-6xl font-black mb-8 tracking-tighter leading-tight">
            Seu ponto fraco é <span className="text-yellow-500">{analysis.weakTopic ? analysis.weakTopic.name : analysis.weakSubject.name}</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Taxa de Erro
              </div>
              <div className="text-3xl font-black text-white">
                {(analysis.weakTopic ? analysis.weakTopic.errorRate : analysis.weakSubject.errorRate).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Tempo Médio
              </div>
              <div className="text-3xl font-black text-white">
                {(analysis.weakSubject.avgTime / 1000).toFixed(1)}s
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Matéria Crítica
              </div>
              <div className="text-3xl font-black text-white truncate">
                {analysis.weakSubject.name}
              </div>
            </div>
          </div>

          <button 
            onClick={() => onStartIntensive(analysis.weakSubject.name, analysis.weakTopic?.name)}
            className="group flex items-center gap-4 bg-yellow-500 text-slate-950 px-10 py-6 rounded-3xl font-black text-xl hover:bg-yellow-400 transition-all shadow-2xl"
          >
            <Play className="w-6 h-6 fill-current" />
            INICIAR TREINO INTENSIVO (20 QUESTÕES)
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />
      </header>

      {/* Subjects Breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {analysis.subjects.map((sub, idx) => (
          <motion.div 
            key={sub.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl hover:border-yellow-500/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{sub.name}</h3>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Target className="w-3 h-3" />
                    {sub.total} Resolvidas
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest">
                    <AlertCircle className="w-3 h-3" />
                    {sub.errors} Erros
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-900">{sub.errorRate.toFixed(0)}%</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa de Erro</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full mb-10 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${sub.errorRate > 50 ? 'bg-red-500' : 'bg-yellow-500'}`}
                style={{ width: `${sub.errorRate}%` }}
              />
            </div>

            {/* Wrong Questions List */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Histórico de Erros</h4>
              {sub.questions.length > 0 ? (
                <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {sub.questions.map((q, qIdx) => (
                    <button 
                      key={q.id}
                      onClick={() => onReviewQuestion(q)}
                      className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all text-left group/item"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-xs font-black text-slate-400 border border-slate-200">
                          {qIdx + 1}
                        </div>
                        <p className="text-xs font-bold text-slate-700 line-clamp-1">{q.texto}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover/item:text-yellow-500 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-emerald-50 rounded-3xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600">Nenhum erro registrado nesta matéria. Excelente!</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => onStartIntensive(sub.name)}
              className="w-full mt-10 flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              TREINAR ESTA MATÉRIA
            </button>
          </motion.div>
        ))}
      </section>
    </div>
  );
};

