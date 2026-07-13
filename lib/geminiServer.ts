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

export const fetchSinglePoliceQuestion = async (
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

export const generateQuestionsForSubject = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  const cacheKey = `GS:${subject}:${count}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".
        Nível: Muito Difícil.
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

export const generateFlashcardsBatch = async (
  subject: string,
  count: number
): Promise<Flashcard[]> => {
  const cacheKey = `FC:${subject}:${count}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;

  const request = withRetry(async () => {
    const response = await (await getAi()).models.generateContent({
      model: getGeminiModel(),
      contents: `VOCÊ É UM ESPECIALISTA EM MEMORIZAÇÃO E ACTIVE RECALL.
        MISSÃO: Gerar ${count} flashcards de alto rendimento para a matéria: ${subject}.
        REGRAS: front = pergunta/gatilho; back = explicação rica com bases legais/mnemônicos.`,
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

