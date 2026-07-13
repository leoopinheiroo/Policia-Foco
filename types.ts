
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
  | 'FORGOT_PASSWORD'
  | 'RESET_PASSWORD'
  | 'CHECKOUT'
  | 'HOME' 
  | 'SUBJECTS' 
  | 'TOPICS' 
  | 'QUESTIONS' 
  | 'SIMULADOS' 
  | 'REDACAO' 
  | 'FLASHCARDS' 
  | 'DASHBOARD' 
  | 'GENIUS_IA'
  | 'MENTORIA'
  | 'MISSION_CONTROL'
  | 'RANKING'
  | 'DOSSIER'
  | 'VADE_MECUM';

export type SubjectCategory = 'BASICAS' | 'HUMANAS' | 'JURIDICAS' | 'ESPECIFICAS';

export interface Subject {
  id: string;
  name: string;
  icon: string;
  topics: string[];
  category: SubjectCategory;
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

export interface UserHistory {
  answeredQuestions: Record<string, {
    correct: boolean;
    answerIndex: number;
    timestamp: number;
    responseTime: number;
    question: Question;
  }>;
  savedQuestions?: string[]; // IDs of questions in the "Dossier"
  missionProgress?: Record<string, any>; // por missão (PRF/PF/PC) ou legado flat por matéria
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  subjects: {
    subjectId: string;
    weight: number;
    topics: string[];
  }[];
}

export interface RankEntry {
  name: string;
  xp: number;
  level: number;
  avatar: string;
  isCurrentUser?: boolean;
}

export type ToastType = 'success' | 'error' | 'info';

export interface QuestionFilters {
  materia?: string;
  assunto?: string;
  banca?: string;
  ano?: number;
  status?: 'TODAS' | 'RESOLVIDAS' | 'NAO_RESOLVIDAS' | 'ACERTEI' | 'ERREI';
  tipos?: QuestionType[];
}

export interface EssayFeedback {
  score: number;
  detailedScores: {
    estrutura: number;
    argumentacao: number;
    coesao: number;
    gramatica: number;
    total: number;
  };
  comments: string;
  strengths: string[];
  weaknesses: string[];
  grammarIssues: string[];
  markedEssay: string;
  improvementExamples: {
    original: string;
    corrected: string;
    explanation: string;
    paragraph?: number;
  }[];
  recommendation: string;
}
