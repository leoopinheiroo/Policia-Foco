import { GoogleGenAI, Type } from "@google/genai";
import { Question, EssayFeedback, Flashcard, QuestionFilters, UserHistory } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
  if (!aiInstance) {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (!apiKey) {
      throw new Error("CHAVE_API_AUSENTE: Configure GEMINI_API_KEY no servidor.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

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
    const errorMessage = (error?.message || '').toLowerCase();
    const isQuotaError =
      errorMessage.includes('429') ||
      errorMessage.includes('resource_exhausted') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('limit');

    const isRetryable =
      isQuotaError ||
      errorMessage.includes('500') ||
      errorMessage.includes('503') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('mismatch') ||
      errorMessage.includes('content') ||
      errorMessage.includes('server');

    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    if (isQuotaError) {
      throw new Error("Muitas solicitações ao mesmo tempo. Aguarde alguns segundos e tente novamente.");
    }
    if (errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      throw new Error("Conexão instável com a IA. Tente novamente em instantes.");
    }
    throw new Error("Instabilidade momentânea no servidor de IA. Tente novamente em alguns segundos.");
  }
}

const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    banca: { type: Type.STRING },
    ano: { type: Type.INTEGER },
    orgao: { type: Type.STRING },
    cargo: { type: Type.STRING },
    materia: { type: Type.STRING },
    assunto: { type: Type.STRING },
    textoBase: { type: Type.STRING },
    texto: { type: Type.STRING },
    tipo: { type: Type.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] },
    alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
    correta: { type: Type.INTEGER },
    comentario: { type: Type.STRING }
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

export const fetchFilteredQuestions = async (
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

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
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
          type: Type.ARRAY,
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

export const fetchSinglePoliceQuestion = async (
  subject: string,
  topic: string
): Promise<Question | null> => {
  const cacheKey = `SQ:${subject}:${topic}:${Date.now() - (Date.now() % 60000)}`;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
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

export const generateQuestionsForSubject = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  const cacheKey = `GS:${subject}:${count}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".
        Nível: Muito Difícil.
        ${DETAILED_COMMENTARY_INSTRUCTION}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: QUESTION_SCHEMA
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text || '[]'));
    const results = items.map((q: any) => ({
      ...q,
      id: `sim-${Date.now()}-${Math.random()}`,
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

export const correctEssayWithAi = async (essay: string, theme: string): Promise<EssayFeedback> => {
  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um avaliador sênior de redações para concursos.
        TEMA PROPOSTO: "${theme}"
        REDAÇÃO PARA AVALIAÇÃO:
        ${essay}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            detailedScores: {
              type: Type.OBJECT,
              properties: {
                estrutura: { type: Type.NUMBER },
                argumentacao: { type: Type.NUMBER },
                coesao: { type: Type.NUMBER },
                gramatica: { type: Type.NUMBER },
                total: { type: Type.NUMBER }
              },
              required: ["estrutura", "argumentacao", "coesao", "gramatica", "total"]
            },
            comments: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            grammarIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            markedEssay: { type: Type.STRING },
            improvementExamples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  corrected: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  paragraph: { type: Type.NUMBER }
                },
                required: ["original", "corrected", "explanation", "paragraph"]
              }
            },
            recommendation: { type: Type.STRING }
          },
          required: ["score", "detailedScores", "comments", "strengths", "weaknesses", "grammarIssues", "markedEssay", "improvementExamples", "recommendation"]
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '{}'));
  });
};

export const generateFlashcardsBatch = async (
  subject: string,
  count: number
): Promise<Flashcard[]> => {
  const cacheKey = `FC:${subject}:${count}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ESPECIALISTA EM MEMORIZAÇÃO E ACTIVE RECALL.
        MISSÃO: Gerar ${count} flashcards de alto rendimento para a matéria: ${subject}.
        REGRAS: front = pergunta/gatilho; back = explicação rica com bases legais/mnemônicos.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
              assunto: { type: Type.STRING }
            },
            required: ["front", "back", "assunto"]
          }
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text || '[]'));
    const results = items.map((f: any) => ({
      ...f,
      id: `fc-${Date.now()}-${Math.random()}`,
      materia: subject,
      nextReview: Date.now(),
      difficultyFactor: 2.5
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

export const mentoriaChat = async (
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string
): Promise<string> => {
  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: "gemini-3-flash-preview",
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

export function computeXpFromHistory(history: any): { xp: number; level: number } {
  const answered = Object.values(history?.answeredQuestions || {}) as any[];
  const correct = answered.filter(q => q.correct === true || q.isCorrect === true).length;
  const streak = history?.streak || 0;
  const sessions = (history?.studySessions || []).length;
  const xp = answered.length * 10 + correct * 15 + streak * 25 + sessions * 5;
  const level = Math.max(1, Math.floor(xp / 350) + 1);
  return { xp, level };
}
