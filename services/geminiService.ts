import { Question, EssayFeedback, Flashcard, QuestionFilters } from "../types";
import { apiJson } from "./apiClient";

export const fetchFilteredQuestions = async (
  filters: QuestionFilters,
  count: number = 10
): Promise<Question[]> => {
  const data = await apiJson<{ questions: Question[] }>('/api/ai/questions', {
    method: 'POST',
    body: JSON.stringify({ filters, count }),
  });
  return data.questions;
};

export const fetchSinglePoliceQuestion = async (
  subject: string,
  topic: string
): Promise<Question | null> => {
  const data = await apiJson<{ question: Question | null }>('/api/ai/question', {
    method: 'POST',
    body: JSON.stringify({ subject, topic }),
  });
  return data.question;
};

export const generateQuestionsForSubject = async (
  subject: string,
  count: number,
  options?: { signal?: AbortSignal }
): Promise<Question[]> => {
  const data = await apiJson<{ questions: Question[] }>('/api/ai/simulado', {
    method: 'POST',
    body: JSON.stringify({ subject, count }),
    signal: options?.signal,
  });
  return data.questions ?? [];
};

export const correctEssayWithAi = async (essay: string, theme: string): Promise<EssayFeedback> => {
  const data = await apiJson<{ feedback: EssayFeedback }>('/api/ai/essay', {
    method: 'POST',
    body: JSON.stringify({ essay, theme }),
  });
  return data.feedback;
};

export const generateFlashcardsBatch = async (
  subject: string,
  count: number
): Promise<Flashcard[]> => {
  const data = await apiJson<{ flashcards: Flashcard[] }>('/api/ai/flashcards', {
    method: 'POST',
    body: JSON.stringify({ subject, count }),
  });
  return data.flashcards;
};

export const mentoriaChat = async (
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string
): Promise<string> => {
  const data = await apiJson<{ text: string }>('/api/ai/mentoria', {
    method: 'POST',
    body: JSON.stringify({ messages, userMessage }),
  });
  return data.text;
};
