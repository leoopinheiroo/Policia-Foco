/** XP puro — sem dependência do Gemini (seguro no cold start da Vercel). */
export function computeXpFromHistory(history: any): { xp: number; level: number } {
  const answered = Object.values(history?.answeredQuestions || {}) as any[];
  const correct = answered.filter(q => q.correct === true || q.isCorrect === true).length;
  const streak = history?.streak || 0;
  const sessions = (history?.studySessions || []).length;
  const xp = answered.length * 10 + correct * 15 + streak * 25 + sessions * 5;
  const level = Math.max(1, Math.floor(xp / 350) + 1);
  return { xp, level };
}
