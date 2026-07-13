import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Inline — import de ./xp quebra o bundle serverless na Vercel. */
function computeXpFromHistory(history: any): { xp: number; level: number } {
  const answered = Object.values(history?.answeredQuestions || {}) as any[];
  const correct = answered.filter(q => q.correct === true || q.isCorrect === true).length;
  const streak = history?.streak || 0;
  const sessions = (history?.studySessions || []).length;
  const xp = answered.length * 10 + correct * 15 + streak * 25 + sessions * 5;
  const level = Math.max(1, Math.floor(xp / 350) + 1);
  return { xp, level };
}

const app = express();

type AuthedRequest = express.Request & {
  supabase: SupabaseClient;
  user: { id: string; email: string };
};

/* ==== Gemini (inlined para bundle Vercel) ==== */
/** Flash-Lite atual (alto volume). 2.5-flash-lite foi descontinuado para contas novas. */
const getGeminiModel = () =>
  (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim() || 'gemini-3.1-flash-lite';

let aiInstance: any = null;

const getAi = async (): Promise<any> => {
  if (!aiInstance) {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (!apiKey) {
      throw new Error("CHAVE_API_AUSENTE: Configure GEMINI_API_KEY no servidor.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};
type QuestionType = 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
type QuestionOrigin = 'BANCO' | 'IA';

interface Question {
  id: string;
  banca: string;
  ano: number;
  orgao: string;
  cargo: string;
  materia: string;
  assunto: string;
  tema: string;
  textoBase?: string;
  texto: string;
  tipo: QuestionType;
  alternativas: string[];
  correta: number;
  comentario: string;
  origem: QuestionOrigin;
  isAiGenerated?: boolean;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  materia: string;
  assunto: string;
  nextReview: number;
  difficultyFactor: number;
}

interface UserHistory {
  answeredQuestions: Record<string, {
    correct: boolean;
    answerIndex: number;
    timestamp: number;
    responseTime: number;
    question: Question;
  }>;
  savedQuestions?: string[];
  missionProgress?: Record<string, {
    theoryDone: boolean;
    exercisesDone: boolean;
    mastery: number;
  }>;
}

interface QuestionFilters {
  materia?: string;
  assunto?: string;
  banca?: string;
  ano?: number;
  status?: 'TODAS' | 'RESOLVIDAS' | 'NAO_RESOLVIDAS' | 'ACERTEI' | 'ERREI';
  tipos?: QuestionType[];
}

interface EssayFeedback {
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
  }[];
}

const cleanJson = (text: string): string => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }

  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const memoryCache = new Map<string, { data: any; expires: number }>();
const pendingRequests = new Map<string, Promise<any>>();

const getCachedData = (key: string) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCachedData = (key: string, data: any) => {
  memoryCache.set(key, { data, expires: Date.now() + 5 * 60 * 1000 });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMessage = (error?.message || String(error) || '').toLowerCase();
    const isQuotaError =
      errorMessage.includes('429') ||
      errorMessage.includes('resource_exhausted') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('rate_limit') ||
      errorMessage.includes('too many requests');

    const isRetryable =
      isQuotaError ||
      errorMessage.includes('503') ||
      errorMessage.includes('unavailable') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('internal error');

    if (retries > 0 && isRetryable) {
      console.warn('Gemini retry (' + retries + ' left):', error?.message || error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    console.error('Gemini final error:', error?.message || error);
    if (isQuotaError) {
      throw new Error("Muitas solicitações ao mesmo tempo. Aguarde alguns segundos e tente novamente.");
    }
    if (errorMessage.includes('api_key') || errorMessage.includes('api key') || errorMessage.includes('chave_api')) {
      throw new Error("CHAVE_API_AUSENTE: Configure GEMINI_API_KEY no servidor.");
    }
    const original = (error?.message || '').toString();
    if (original && original.length < 240 && !original.includes('\n')) {
      throw new Error(original);
    }
    throw new Error("Instabilidade momentânea no servidor de IA. Tente novamente em alguns segundos.");
  }
}

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    banca: { type: 'STRING' },
    ano: { type: 'INTEGER' },
    orgao: { type: 'STRING' },
    cargo: { type: 'STRING' },
    materia: { type: 'STRING' },
    assunto: { type: 'STRING' },
    textoBase: { type: 'STRING' },
    texto: { type: 'STRING' },
    tipo: { type: 'STRING', enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] },
    alternativas: { type: 'ARRAY', items: { type: 'STRING' } },
    correta: { type: 'INTEGER' },
    comentario: { type: 'STRING' }
  },
  required: ["banca", "ano", "orgao", "cargo", "materia", "assunto", "texto", "tipo", "alternativas", "correta", "comentario"]
};

const DETAILED_COMMENTARY_INSTRUCTION = `
PARA O CAMPO 'comentario', VOCÊ DEVE SEGUIR ESTE FORMATO OBRIGATÓRIO (USE ESTES MARCADORES EXATOS):

[RESUMO DA CORRETA]
Explicar de forma profunda e técnica por que a alternativa correta está certa.

[POR QUE AS OUTRAS ESTÃO ERRADAS?]
Comente cada uma das alternativas incorretas.

[MNEMÔNICO / DICA DE OURO]
Forneça um macete ou dica prática.

[RESUMO DO TEMA]
Um parágrafo de fechamento sintetizando a teoria cobrada.
`;

function buildStatusGuidance(filters: QuestionFilters, history?: UserHistory | null): string {
  const status = filters.status || 'TODAS';
  if (status === 'TODAS' || !history?.answeredQuestions) return '';

  const records = Object.values(history.answeredQuestions);
  const wrongSubjects = new Map<string, number>();
  const correctSubjects = new Map<string, number>();

  records.forEach((r: any) => {
    const materia = r.question?.materia || r.subject || 'Geral';
    const ok = r.correct === true || r.isCorrect === true;
    if (ok) correctSubjects.set(materia, (correctSubjects.get(materia) || 0) + 1);
    else wrongSubjects.set(materia, (wrongSubjects.get(materia) || 0) + 1);
  });

  const topWrong = [...wrongSubjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);
  const topCorrect = [...correctSubjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);

  switch (status) {
    case 'ERREI':
      return `FOCO PEDAGÓGICO: O aluno errou questões em: ${topWrong.join(', ') || 'diversas matérias'}. Gere questões que reforcem esses pontos fracos.`;
    case 'ACERTEI':
      return `FOCO PEDAGÓGICO: O aluno acertou bem em: ${topCorrect.join(', ') || 'diversas matérias'}. Gere questões um nível acima nesses temas para consolidar.`;
    case 'RESOLVIDAS':
      return `FOCO: Variar temas já praticados pelo aluno, com pegadinhas novas (não repetir enunciados óbvios).`;
    case 'NAO_RESOLVIDAS':
      return `FOCO: Priorizar temas ainda pouco explorados pelo aluno, evitando repetir o núcleo dos erros/acertos já registrados.`;
    default:
      return '';
  }
}

const fetchFilteredQuestions = async (
  filters: QuestionFilters,
  count: number = 10,
  history?: UserHistory | null
): Promise<Question[]> => {
  const cacheKey = `FQ:${JSON.stringify(filters)}:${count}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const filterDesc = [
      filters.materia ? `Matéria: ${filters.materia}` : '',
      filters.assunto ? `Assunto: ${filters.assunto}` : '',
      filters.banca ? `Banca: ${filters.banca}` : 'Banca: FGV ou CEBRASPE',
      filters.ano ? `Ano: ${filters.ano}` : '',
      filters.tipos && filters.tipos.length > 0 ? `Estilo: ${filters.tipos.join('/')}` : '',
      filters.status && filters.status !== 'TODAS' ? `Filtro de status do aluno: ${filters.status}` : ''
    ].filter(Boolean).join(', ');

    const statusGuidance = buildStatusGuidance(filters, history);

    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para: ${filterDesc}.
        Nível: Muito Difícil (Padrão Delegado/Perito/Agente Federal).
        ${statusGuidance}

        DIRETRIZES DE QUALIDADE PEDAGÓGICA:
        1. A alternativa correta deve ser irrefutável.
        2. As incorretas devem ser plausíveis (pegadinhas de alto nível).
        ${DETAILED_COMMENTARY_INSTRUCTION}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'ARRAY',
          items: QUESTION_SCHEMA
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text || '[]'));
    const results = items.map((q: any) => ({
      ...q,
      id: `filt-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    }));

    setCachedData(cacheKey, results);
    return results;
  });

  pendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
};

const fetchSinglePoliceQuestion = async (
  subject: string,
  topic: string
): Promise<Question | null> => {
  const cacheKey = `SQ:${subject}:${topic}:${Date.now() - (Date.now() % 60000)}`;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar 1 questão técnica inédita EXCLUSIVAMENTE para:
        MATÉRIA: "${subject}"
        ASSUNTO: "${topic}"
        Nível: Muito Difícil. Banca: CEBRASPE ou FGV.
        ${DETAILED_COMMENTARY_INSTRUCTION}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA
      }
    });

    const q = JSON.parse(cleanJson(response.text || '{}'));
    return {
      ...q,
      id: `inf-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    };
  });

  pendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
};

const generateQuestionsBatchOnce = async (
  subject: string,
  count: number,
  entropy?: string
): Promise<Question[]> => {
  const variation = entropy || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await (await getAi()).models.generateContent({
    model: getGeminiModel(),
    contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
      MISSÃO: Gerar EXATAMENTE ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".
      VARIAÇÃO OBRIGATÓRIA (não repita enunciados): seed=${variation}.
      REGRAS OBRIGATÓRIAS:
      1. O array JSON deve conter EXATAMENTE ${count} itens (nem mais, nem menos).
      2. Nível: Muito Difícil. Banca: CEBRASPE ou FGV.
      3. Cada questão deve ser diferente das demais do lote e inédita em relação a gerações anteriores.
      ${DETAILED_COMMENTARY_INSTRUCTION}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: 'ARRAY',
        items: QUESTION_SCHEMA
      }
    }
  });

  const items = JSON.parse(cleanJson(response.text || '[]'));
  if (!Array.isArray(items)) return [];
  return items.map((q: any) => ({
    ...q,
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    origem: 'IA',
    isAiGenerated: true
  }));
};

/**
 * Simulado: SEM cache e SEM coalescing de pending.
 * Cache por matéria fazia o cliente receber as mesmas 2 questões e travar ~na 10ª.
 */
const generateSimuladoQuestions = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  const target = Math.max(1, Math.min(Number(count) || 1, 2));
  const collected: Question[] = [];
  let attempts = 0;
  while (collected.length < target && attempts < 3) {
    attempts += 1;
    const need = target - collected.length;
    try {
      const batch = await withRetry(
        () => generateQuestionsBatchOnce(subject, need, `${Date.now()}-${attempts}-${Math.random()}`),
        2,
        800
      );
      if (!batch.length) continue;
      for (const q of batch) {
        if (collected.length >= target) break;
        const dup = collected.some(c => c.texto && q.texto && c.texto === q.texto);
        if (!dup) collected.push(q);
      }
    } catch (e) {
      console.error('generateSimuladoQuestions error:', e);
      if (collected.length > 0) break;
      throw e;
    }
  }
  return collected.slice(0, target);
};

/** Gera até `count` questões em lotes (máx. 8/chamada) — Gemini raramente entrega lotes grandes completos. */
const generateQuestionsForSubject = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  const target = Math.max(1, Math.min(Number(count) || 1, 10));
  const cacheKey = `GS:${subject}:${target}:${Date.now()}`;
  // Sem cache de resultado: questões de treino precisam ser sempre novas.
  // Mantém pending só para a chave única desta chamada (não compartilha entre requests).

  const request = (async () => {
    const collected: Question[] = [];
    let attempts = 0;
    while (collected.length < target && attempts < 4) {
      attempts += 1;
      const need = Math.min(8, target - collected.length);
      try {
        const batch = await withRetry(
          () => generateQuestionsBatchOnce(subject, need, `${Date.now()}-${attempts}`),
          3,
          1500
        );
        if (!batch.length) continue;
        for (const q of batch) {
          if (collected.length >= target) break;
          const dup = collected.some(c => c.texto && q.texto && c.texto === q.texto);
          if (!dup) collected.push(q);
        }
      } catch (e) {
        console.error('generateQuestionsForSubject batch error:', e);
        if (collected.length > 0) break;
        throw e;
      }
    }
    return collected.slice(0, target);
  })();

  pendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
};

const correctEssayWithAi = async (essay: string, theme: string): Promise<EssayFeedback> => {
  return withRetry(async () => {
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `Você é um avaliador sênior de redações para concursos.
        TEMA PROPOSTO: "${theme}"
        REDAÇÃO PARA AVALIAÇÃO:
        ${essay}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'OBJECT',
          properties: {
            score: { type: 'NUMBER' },
            detailedScores: {
              type: 'OBJECT',
              properties: {
                estrutura: { type: 'NUMBER' },
                argumentacao: { type: 'NUMBER' },
                coesao: { type: 'NUMBER' },
                gramatica: { type: 'NUMBER' },
                total: { type: 'NUMBER' }
              },
              required: ["estrutura", "argumentacao", "coesao", "gramatica", "total"]
            },
            comments: { type: 'STRING' },
            strengths: { type: 'ARRAY', items: { type: 'STRING' } },
            weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
            grammarIssues: { type: 'ARRAY', items: { type: 'STRING' } },
            markedEssay: { type: 'STRING' },
            improvementExamples: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  original: { type: 'STRING' },
                  corrected: { type: 'STRING' },
                  explanation: { type: 'STRING' },
                  paragraph: { type: 'NUMBER' }
                },
                required: ["original", "corrected", "explanation", "paragraph"]
              }
            },
            recommendation: { type: 'STRING' }
          },
          required: ["score", "detailedScores", "comments", "strengths", "weaknesses", "grammarIssues", "markedEssay", "improvementExamples", "recommendation"]
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '{}'));
  });
};

const generateFlashcardsBatch = async (
  subject: string,
  count: number,
  options?: { fresh?: boolean }
): Promise<Flashcard[]> => {
  const safeCount = Math.max(1, Math.min(Number(count) || 10, 12));
  const fresh = options?.fresh === true;
  const cacheKey = `FC:${subject}:${safeCount}`;

  if (!fresh) {
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;
  }

  const request = withRetry(async () => {
    const entropy = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `VOCÊ É UM ESPECIALISTA EM MEMORIZAÇÃO E ACTIVE RECALL.
        MISSÃO: Gerar EXATAMENTE ${safeCount} flashcards de alto rendimento para a matéria: ${subject}.
        VARIAÇÃO OBRIGATÓRIA (não repita enunciados anteriores): seed=${entropy}.
        REGRAS: front = pergunta/gatilho; back = explicação rica com bases legais/mnemônicos.
        Cada card deve ser inédito e cobrir um ponto diferente do edital.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              front: { type: 'STRING' },
              back: { type: 'STRING' },
              assunto: { type: 'STRING' }
            },
            required: ["front", "back", "assunto"]
          }
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text || '[]'));
    if (!Array.isArray(items)) return [];
    const results = items.map((f: any) => ({
      ...f,
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      materia: subject,
      nextReview: Date.now(),
      difficultyFactor: 2.5
    }));

    if (!fresh && results.length) setCachedData(cacheKey, results);
    return results;
  });

  if (!fresh) {
    pendingRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }

  return request;
};

/** Persiste flashcards no banco compartilhado por matéria (ignora duplicatas). */
const saveFlashcardsToBank = async (
  supabase: SupabaseClient,
  cards: { materia: string; assunto?: string; front: string; back: string }[]
): Promise<number> => {
  if (!cards.length) return 0;
  const rows = cards
    .filter(c => c.materia && c.front && c.back)
    .map(c => ({
      materia: c.materia.trim(),
      assunto: (c.assunto || 'Geral').trim(),
      front: c.front.trim(),
      back: c.back.trim(),
    }));
  if (!rows.length) return 0;

  const { data, error } = await supabase
    .from('flashcards_bank')
    .upsert(rows, { onConflict: 'materia,front', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('saveFlashcardsToBank error:', error);
    return 0;
  }
  return data?.length || 0;
};

const mapBankRowToFlashcard = (row: any): Flashcard => ({
  id: row.id || `fc-${Date.now()}`,
  front: row.front,
  back: row.back,
  materia: row.materia,
  assunto: row.assunto || 'Geral',
  nextReview: Date.now(),
  difficultyFactor: 2.5,
});

const loadFlashcardsFromBank = async (
  supabase: SupabaseClient,
  subject: string,
  limit = 80
): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards_bank')
    .select('id, materia, assunto, front, back')
    .eq('materia', subject)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('loadFlashcardsFromBank error:', error);
    return [];
  }
  return (data || []).map(mapBankRowToFlashcard);
};

const mentoriaChat = async (
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string
): Promise<string> => {
  return withRetry(async () => {
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      config: {
        systemInstruction: "Você é um Mentor de Elite para concursos policiais brasileiros (PF, PRF, PC, PM). Seu objetivo é ajudar o aluno com estratégias de estudo, cronogramas, motivação e explicação de temas. Seja direto, técnico e motivador. Use termos policiais se apropriado (ex: \"Operador\", \"QAP\", \"Foco na Missão\")."
      },
      contents: [
        ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userMessage }] }
      ]
    });
    return response.text || "Desculpe, tive um problema na comunicação. QAP?";
  });
};


/* ==== fim Gemini ==== */

const sanitize = (val: string | undefined) => {
  let cleaned = (val || '').trim().replace(/^['"]|['"]$/g, '');
  return cleaned.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
};

const getSupabaseEnv = () => {
  const url = sanitize(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceKey = sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = sanitize(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  return { url, serviceKey, anonKey, key: serviceKey || anonKey };
};

let supabaseClient: SupabaseClient | null = null;
const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  const { url, key } = getSupabaseEnv();
  if (!url || !key || !url.startsWith('https://')) return null;
  try {
    supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return supabaseClient;
  } catch {
    return null;
  }
};

const checkSupabase = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const supabase = getSupabase();
  if (!supabase) {
    const { url, serviceKey, anonKey } = getSupabaseEnv();
    const missing: string[] = [];
    if (!url) missing.push('SUPABASE_URL');
    if (!serviceKey && !anonKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({
      error: `Supabase não configurado: ${missing.join(', ') || 'erro de inicialização'}.`,
    });
  }
  (req as AuthedRequest).supabase = supabase;
  next();
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const supabase = (req as AuthedRequest).supabase || getSupabase();
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase não configurado.' });
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Token ausente.' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    (req as AuthedRequest).supabase = supabase;
    (req as AuthedRequest).user = {
      id: data.user.id,
      email: data.user.email.trim().toLowerCase(),
    };
    next();
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'Falha na autenticação.' });
  }
};

const getStripe = () => {
  let key = (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '').trim();
  key = key.replace(/['"\s\u200B-\u200D\uFEFF]/g, '');
  if (!key) throw new Error('Stripe key missing');
  return new Stripe(key, { apiVersion: '2024-06-20' as any });
};

const defaultHistory = () => ({
  answeredQuestions: {},
  savedQuestions: [] as string[],
  studySessions: [] as any[],
  missionProgress: {} as Record<string, any>,
  streak: 0,
  lastStudyDate: null as string | null,
});

const ensureUserRow = async (
  supabase: SupabaseClient,
  email: string,
  name?: string
) => {
  const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert([{
      email,
      name: name || 'Operador',
      subscription_status: 'pending',
      history: defaultHistory(),
      created_at: new Date().toISOString(),
    }])
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

const updateStreak = (history: any) => {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = history.lastStudyDate;
  if (lastDate !== today) {
    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      history.streak = lastDate === yesterdayStr ? (history.streak || 0) + 1 : 1;
    } else {
      history.streak = 1;
    }
    history.lastStudyDate = today;
  }
  return history;
};

app.use(cors());

app.get('/api/health', async (_req, res) => {
  const supabase = getSupabase();
  const missingKeys: string[] = [];
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missingKeys.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET) missingKeys.push('STRIPE_SECRET_KEY');
  if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) missingKeys.push('GEMINI_API_KEY');

  let dbStatus = 'not_initialized';
  let dbError: string | null = null;
  if (supabase) {
    try {
      const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      dbStatus = error ? 'error' : 'connected';
      dbError = error?.message || null;
    } catch (e: any) {
      dbStatus = 'exception';
      dbError = e.message;
    }
  }

  res.json({
    status: 'ok',
    supabase: !!supabase,
    database_connectivity: dbStatus,
    database_error: dbError,
    missing_keys: missingKeys,
    env: process.env.NODE_ENV,
  });
});

// Health check do webhook (browser = GET; Stripe envia POST)
app.get('/api/webhook', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Endpoint de webhook Stripe ativo. O Stripe deve enviar POST com assinatura.',
    expects: 'POST /api/webhook',
    has_webhook_secret: !!(process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
  });
});

// Webhook ANTES do express.json() para preservar raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), checkSupabase, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    if (!endpointSecret) {
      console.error('STRIPE_WEBHOOK_SECRET ausente no ambiente');
      return res.status(500).send('Webhook secret not configured');
    }
    if (!sig) {
      return res.status(400).send('Webhook Error: Missing stripe-signature header');
    }
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = (req as AuthedRequest).supabase;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = (session.customer_email || session.customer_details?.email || '').toLowerCase();
      if (email) {
        await ensureUserRow(supabase, email);
        await supabase
          .from('users')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('email', email);
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      let email = (invoice.customer_email || '').toLowerCase();
      if (!email && invoice.customer) {
        try {
          const stripe = getStripe();
          const customer = await stripe.customers.retrieve(invoice.customer as string);
          if (!('deleted' in customer) && customer.email) {
            email = customer.email.toLowerCase();
          }
        } catch (e) {
          console.error('Failed to resolve invoice customer email', e);
        }
      }
      if (email) {
        await supabase.from('users').update({ subscription_status: 'active' }).eq('email', email);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from('users')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', subscription.customer);
      break;
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '2mb' }));

// --- Profile bootstrap (após signup Supabase Auth) ---
app.post('/api/user/ensure-profile', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const name = (req.body?.name as string) || 'Operador';
    const user = await ensureUserRow((req as AuthedRequest).supabase, email, name);
    if (name && name !== 'Operador' && (!user.name || user.name === 'Operador')) {
      await (req as AuthedRequest).supabase.from('users').update({ name }).eq('email', email);
      user.name = name;
    }
    res.json({ success: true, email: user.email, name: user.name, status: user.subscription_status });
  } catch (error: any) {
    console.error('ensure-profile error:', error);
    res.status(500).json({ error: error.message || 'Erro ao garantir perfil.' });
  }
});

app.get('/api/user/status', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const user = await ensureUserRow((req as AuthedRequest).supabase, email);
    res.json({ status: user.subscription_status || 'pending', name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status.' });
  }
});

app.get('/api/user/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const user = await ensureUserRow((req as AuthedRequest).supabase, email);
    res.json({ history: user.history || defaultHistory() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

app.post('/api/user/history/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { questionId, result, missionProgress } = req.body;

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    if (!history.answeredQuestions) history.answeredQuestions = {};
    if (!history.studySessions) history.studySessions = [];
    if (!history.savedQuestions) history.savedQuestions = [];
    if (!history.missionProgress) history.missionProgress = {};

    if (questionId && result) {
      history.answeredQuestions[questionId] = { ...result, timestamp: Date.now() };
      updateStreak(history);
    }

    if (missionProgress && typeof missionProgress === 'object') {
      // Merge por missão (PRF/PF/PC) ou formato legado (matéria no root)
      const missionIds = new Set(['PRF_2025', 'PF_AGENTE', 'PC_SP_INVEST']);

      for (const [key, val] of Object.entries(missionProgress)) {
        if (!val || typeof val !== 'object') continue;
        const entry = val as Record<string, unknown>;
        const looksLikeSubject =
          'theoryDone' in entry ||
          'theory' in entry ||
          'exercisesDone' in entry ||
          'exercises' in entry ||
          'mastery' in entry;

        if (missionIds.has(key) && !looksLikeSubject) {
          // Bucket por missão: merge profundo das matérias
          const existingBucket = (history.missionProgress[key] && typeof history.missionProgress[key] === 'object')
            ? { ...history.missionProgress[key] }
            : {};
          for (const [subId, subVal] of Object.entries(entry)) {
            if (!subVal || typeof subVal !== 'object') continue;
            existingBucket[subId] = {
              ...(existingBucket[subId] || {}),
              ...(subVal as object),
            };
          }
          history.missionProgress[key] = existingBucket;
        } else if (looksLikeSubject) {
          // Legado flat (sem escopo de missão)
          history.missionProgress[key] = {
            ...(history.missionProgress[key] || {}),
            ...entry,
          };
        }
      }
    }

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true, history });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ error: 'Erro ao salvar histórico.' });
  }
});

app.post('/api/user/dossier/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { questionId, remove } = req.body;
    if (!questionId) return res.status(400).json({ error: 'questionId obrigatório.' });

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    const saved: string[] = Array.isArray(history.savedQuestions) ? [...history.savedQuestions] : [];

    if (remove) {
      history.savedQuestions = saved.filter(id => id !== questionId);
    } else if (!saved.includes(questionId)) {
      history.savedQuestions = [...saved, questionId];
    } else {
      history.savedQuestions = saved;
    }

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true, savedQuestions: history.savedQuestions });
  } catch (error) {
    console.error('Dossier save error:', error);
    res.status(500).json({ error: 'Erro ao salvar no dossiê.' });
  }
});

app.post('/api/user/study/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { duration, type } = req.body;
    if (duration === undefined) return res.status(400).json({ error: 'Dados incompletos.' });

    const user = await ensureUserRow(supabase, email);
    const history = { ...defaultHistory(), ...(user.history || {}) };
    if (!history.studySessions) history.studySessions = [];

    const now = Date.now();
    history.studySessions.push({
      startTime: now - duration * 1000,
      duration,
      type: type || 'TIMER',
      timestamp: now,
    });
    updateStreak(history);

    const { error } = await supabase.from('users').update({ history }).eq('email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Save study session error:', error);
    res.status(500).json({ error: 'Erro ao salvar sessão de estudo.' });
  }
});

app.post('/api/user/simulados/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { score_percentage, correct_count, total_questions, subjects } = req.body;
    const { error } = await (req as AuthedRequest).supabase.from('simulados_history').insert([{
      user_email: email,
      score_percentage,
      correct_count,
      total_questions,
      subjects,
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Save simulado error:', error);
    res.status(500).json({ error: 'Erro ao salvar simulado.' });
  }
});

app.get('/api/user/simulados/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await (req as AuthedRequest).supabase
      .from('simulados_history')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de simulados.' });
  }
});

app.post('/api/user/flashcards/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { materia, assunto, front, back, status } = req.body;
    const supabase = (req as AuthedRequest).supabase;

    // Salva no banco compartilhado da matéria (reuso entre alunos)
    if (materia && front && back) {
      await saveFlashcardsToBank(supabase, [{ materia, assunto, front, back }]);
    }

    const { error } = await supabase.from('user_flashcards').insert([{
      user_email: email,
      materia,
      assunto,
      front,
      back,
      status: status || 'new',
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar flashcard.' });
  }
});

app.get('/api/user/flashcards/list', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const materia = typeof req.query.materia === 'string' ? req.query.materia : null;

    // Preferência: banco compartilhado (rápido e reutilizável)
    let query = supabase
      .from('flashcards_bank')
      .select('id, materia, assunto, front, back, created_at')
      .order('created_at', { ascending: true })
      .limit(500);

    if (materia && materia !== 'TODAS') {
      query = query.eq('materia', materia);
    }

    const { data: bank, error: bankError } = await query;
    if (!bankError && bank && bank.length > 0) {
      return res.json({
        flashcards: bank.map(mapBankRowToFlashcard),
        source: 'bank',
        total: bank.length,
      });
    }

    // Fallback: cards pessoais do usuário
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await supabase
      .from('user_flashcards')
      .select('*')
      .eq('user_email', email);
    if (error) throw error;
    res.json({
      flashcards: (data || []).map((row: any) => mapBankRowToFlashcard(row)),
      source: 'user',
      total: data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar flashcards.' });
  }
});

/**
 * Garante flashcards da matéria: lê do banco e, se faltar, gera 1 lote via IA e grava.
 * Assim a 1ª carga pode demorar; as próximas vêm do banco.
 */
app.post('/api/flashcards/for-subject', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const subject = String(req.body?.subject || '').trim();
    if (!subject) return res.status(400).json({ error: 'subject obrigatório.' });

    const target = Math.min(Math.max(Number(req.body?.target) || 50, 10), 80);
    const generate = req.body?.generate !== false; // default: tenta preencher
    const batchSize = Math.min(Math.max(Number(req.body?.batchSize) || 8, 4), 12);

    let flashcards = await loadFlashcardsFromBank(supabase, subject, target + 20);
    let generated = 0;

    if (generate && flashcards.length < target) {
      const need = Math.min(batchSize, target - flashcards.length);
      try {
        const fresh = await generateFlashcardsBatch(subject, need, { fresh: true });
        if (fresh.length) {
          await saveFlashcardsToBank(supabase, fresh);
          generated = fresh.length;
          flashcards = await loadFlashcardsFromBank(supabase, subject, target + 20);
        }
      } catch (genErr: any) {
        console.error('for-subject generate error:', genErr);
        // Se já temos cards no banco, devolve o que tem em vez de falhar
        if (!flashcards.length) throw genErr;
      }
    }

    const bankCount = flashcards.length;
    res.json({
      flashcards: flashcards.slice(0, Math.max(target, bankCount)),
      bankCount,
      target,
      generated,
      needsMore: bankCount < target,
      source: 'bank',
    });
  } catch (error: any) {
    console.error('flashcards for-subject error:', error);
    res.status(500).json({ error: error.message || 'Erro ao carregar flashcards.' });
  }
});

app.post('/api/user/essays/save', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    await ensureUserRow((req as AuthedRequest).supabase, email);
    const { theme, content, correction_json, final_score } = req.body;
    const { error } = await (req as AuthedRequest).supabase.from('essays_history').insert([{
      user_email: email,
      theme,
      content,
      correction_json,
      final_score,
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar redação.' });
  }
});

app.get('/api/user/essays/history', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data, error } = await (req as AuthedRequest).supabase
      .from('essays_history')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de redações.' });
  }
});

app.get('/api/user/ranking', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { email } = (req as AuthedRequest).user;
    const { data: users, error } = await (req as AuthedRequest).supabase
      .from('users')
      .select('email, name, history')
      .limit(200);
    if (error) throw error;

    const ranking = (users || [])
      .map((u: any) => {
        const { xp, level } = computeXpFromHistory(u.history || {});
        return {
          name: u.name || u.email?.split('@')[0] || 'Operador',
          email: u.email,
          xp,
          level,
          avatar: u.email === email ? '👤' : '👮',
          isCurrentUser: u.email === email,
        };
      })
      .sort((a: any, b: any) => b.xp - a.xp)
      .slice(0, 50);

    const myIndex = ranking.findIndex((r: any) => r.isCurrentUser);
    res.json({ ranking, myPosition: myIndex >= 0 ? myIndex + 1 : null });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Erro ao carregar ranking.' });
  }
});

app.post('/api/create-checkout-session', checkSupabase, requireAuth, async (req, res) => {
  try {
    const supabase = (req as AuthedRequest).supabase;
    const { email } = (req as AuthedRequest).user;
    const { plan } = req.body;

    if (!plan || !['MONTHLY', 'ANNUAL'].includes(plan)) {
      return res.status(400).json({ error: 'Plano inválido. Use MONTHLY ou ANNUAL.' });
    }

    await ensureUserRow(supabase, email);

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch {
      return res.status(500).json({
        error: 'STRIPE_SECRET_KEY não configurada no ambiente de produção (Vercel).',
      });
    }

    const appUrl = (
      process.env.APP_URL ||
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host']}`
        : `${req.protocol}://${req.get('host')}`)
    ).replace(/\/$/, '');

    const prices: Record<string, string> = {
      MONTHLY: (process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_MONTHLY_PRICE_ID || '').trim(),
      ANNUAL: (process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_ANNUAL_PRICE_ID || '').trim(),
    };

    const priceId = prices[plan];
    if (!priceId) {
      return res.status(400).json({
        error: `ID do preço Stripe para o plano ${plan} não configurado. Defina STRIPE_PRICE_ID_${plan} na Vercel.`,
      });
    }

    const sessionConfig: any = {
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?status=cancel`,
      metadata: { email, plan },
      payment_method_types: ['card', 'boleto'],
      billing_address_collection: 'required',
      subscription_data: { metadata: { email, plan } },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (stripeError: any) {
      if (stripeError.message?.includes('recurring') || stripeError.message?.includes('subscription')) {
        session = await stripe.checkout.sessions.create({
          ...sessionConfig,
          mode: 'payment',
          subscription_data: undefined,
        });
      } else {
        throw stripeError;
      }
    }
    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Session Error:', error);
    res.status(500).json({ error: `Erro no Stripe: ${error.message}` });
  }
});

app.post('/api/ai/questions', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { filters = {}, count = 10 } = req.body;
    const user = await ensureUserRow((req as AuthedRequest).supabase, (req as AuthedRequest).user.email);
    const questions = await fetchFilteredQuestions(filters, count, user.history);
    res.json({ questions });
  } catch (error: any) {
    console.error('AI questions error:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar questões.' });
  }
});

app.post('/api/ai/question', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, topic } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: 'subject e topic obrigatórios.' });
    const question = await fetchSinglePoliceQuestion(subject, topic);
    res.json({ question });
  } catch (error: any) {
    console.error('AI question error:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar questão.' });
  }
});

app.post('/api/ai/simulado', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, count = 2 } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject obrigatório.' });
    // Máx. 2 por request — mais rápido e sem cache (evita travar ~na 10ª questão).
    const safeCount = Math.min(Math.max(1, Number(count) || 2), 2);
    const questions = await generateSimuladoQuestions(subject, safeCount);
    res.json({ questions, requested: safeCount, generated: questions.length });
  } catch (error: any) {
    console.error('AI simulado error:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar simulado.' });
  }
});

app.post('/api/ai/essay', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { essay, theme } = req.body;
    if (!essay || !theme) return res.status(400).json({ error: 'essay e theme obrigatórios.' });
    const feedback = await correctEssayWithAi(essay, theme);
    res.json({ feedback });
  } catch (error: any) {
    console.error('AI essay error:', error);
    res.status(500).json({ error: error.message || 'Erro ao corrigir redação.' });
  }
});

app.post('/api/ai/flashcards', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { subject, count = 10 } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject obrigatório.' });
    const safeCount = Math.min(Math.max(1, Number(count) || 10), 12);
    const flashcards = await generateFlashcardsBatch(subject, safeCount, { fresh: true });
    // Sempre grava no banco compartilhado para próximas sessões
    await saveFlashcardsToBank((req as AuthedRequest).supabase, flashcards);
    res.json({ flashcards, savedToBank: true });
  } catch (error: any) {
    console.error('AI flashcards error:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar flashcards.' });
  }
});

app.post('/api/ai/mentoria', checkSupabase, requireAuth, async (req, res) => {
  try {
    const { messages = [], userMessage } = req.body;
    if (!userMessage) return res.status(400).json({ error: 'userMessage obrigatório.' });
    const text = await mentoriaChat(messages, userMessage);
    res.json({ text });
  } catch (error: any) {
    console.error('AI mentoria error:', error);
    res.status(500).json({ error: error.message || 'Erro na mentoria.' });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ error: 'Erro interno no servidor.', message: err.message });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.url}` });
});

// Handler explícito — exportar só `app` causa FUNCTION_INVOCATION_FAILED na Vercel.
export { app };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
