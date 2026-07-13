/** Reexport — implementação em lib/ (fora de /api para a Vercel não criar function extra). */
export * from '../lib/geminiServer';

export function computeXpFromHistory(history: any): { xp: number; level: number } {
  const answered = Object.values(history?.answeredQuestions || {}) as any[];
  const correct = answered.filter(q => q.correct === true || q.isCorrect === true).length;
  const streak = history?.streak || 0;
  const sessions = (history?.studySessions || []).length;
  const xp = answered.length * 10 + correct * 15 + streak * 25 + sessions * 5;
  const level = Math.max(1, Math.floor(xp / 350) + 1);
  return { xp, level };
}
