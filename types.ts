
export type SubscriptionStatus = 'pending' | 'active' | 'canceled' | 'unpaid';

export interface User {
  email: string;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId?: string;
}

export type ViewState = 
  | 'LANDING'
  | 'LOGIN'
  | 'SIGNUP'
  | 'CHECKOUT'
  | 'HOME' 
  | 'SUBJECTS' 
  | 'TOPICS' 
  | 'QUESTIONS' 
  | 'SIMULADOS' 
  | 'REDACAO' 
  | 'FLASHCARDS' 
  | 'DASHBOARD' 
  | 'VADE_MECUM';

export interface Subject {
  id: string;
  name: string;
  icon: string;
  topics: string[];
}

export type QuestionType = 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
export type QuestionOrigin = 'BANCO' | 'IA';

export interface Question {
  id: string; 
  banca: string;
  ano: number;
  orgao: string;
  cargo: string;
  materia: string;
  assunto: string;
  tema: string;
  textoBase?: string; // Para textos de interpretação
  texto: string;
  tipo: QuestionType;
  alternativas: string[]; 
  correta: number; // Índice 0-1 para C/E, 0-4 para ABCDE
  comentario: string;
  origem: QuestionOrigin;
  isAiGenerated?: boolean;
}

export interface VadeMecumItem {
  name: string;
  category: string;
  link: string;
}

export interface SimuladoResult {
  totalQuestions: number;
  correctCount: number;
  answers: Record<string, number>;
  questions: Question[];
  date: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  materia: string;
  assunto: string;
  nextReview: number;
  difficultyFactor: number;
}

export interface EssayFeedback {
  score: number;
  comments: string;
  strengths: string[];
  weaknesses: string[];
  grammarIssues: string[];
  improvementExamples: {
    original: string;
    corrected: string;
    explanation: string;
  }[];
}
