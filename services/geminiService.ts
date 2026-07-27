
import { GoogleGenAI, Type } from "@google/genai";
import { Question, EssayFeedback, Flashcard, QuestionFilters } from "../types";

// Lazy initialization of the Gemini client
let aiInstance: any = null;

const getAi = () => {
  if (!aiInstance) {
    const apiKey = (process as any).env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("CHAVE_API_AUSENTE: A Chave API do Gemini não foi encontrada. Por favor, configure-a no menu Settings (GEMINI_API_KEY).");
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

// Cache em memória para evitar requisições duplicadas simultâneas
const pendingRequests = new Map<string, Promise<any>>();

// Cache em sessionStorage para persistência durante a sessão
const getCachedData = (key: string) => {
  try {
    const cached = sessionStorage.getItem(`GEMINI_CACHE_${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
};

const setCachedData = (key: string, data: any) => {
  try {
    sessionStorage.setItem(`GEMINI_CACHE_${key}`, JSON.stringify(data));
  } catch (e) {}
};

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase() || '';
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
      console.warn(`[Gemini Service] Tensão na API detectada. Retentando em ${delay}ms... (${retries} tentativas restantes)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Backoff exponencial: dobra o tempo de espera a cada falha
      return withRetry(fn, retries - 1, delay * 2);
    }

    // Tradução de erros técnicos para mensagens amigáveis
    if (isQuotaError) {
      throw new Error("Muitas solicitações ao mesmo tempo. Estamos preparando sua questão, aguarde alguns segundos e tente novamente.");
    }
    
    if (errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      throw new Error("Conexão instável com a IA. Verifique sua internet ou tente novamente em instantes.");
    }

    throw new Error("Ocorreu uma instabilidade momentânea no servidor de IA. Por favor, tente novamente em alguns segundos.");
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
Explicar de forma profunda e técnica por que a alternativa correta está certa. Se for Direito, cite a lei/artigo. Se for Português, explique a regra gramatical. Não economize palavras.

[POR QUE AS OUTRAS ESTÃO ERRADAS?]
Comente cada uma das alternativas incorretas, uma por uma (A, B, C, D, E conforme o caso). Deixe claro o erro de cada uma. Nunca pule alternativas.

[MNEMÔNICO / DICA DE OURO]
Forneça um macete, mnemônico ou dica prática para o aluno não esquecer esse ponto ou não cair em pegadinha similar.

[RESUMO DO TEMA]
Um parágrafo de fechamento sintetizando a teoria cobrada para fixação.
`;

/**
 * Fetches a batch of questions based on filters.
 */
export const fetchFilteredQuestions = async (
  filters: QuestionFilters,
  count: number = 10
): Promise<Question[]> => {
  const cacheKey = `FQ:${JSON.stringify(filters)}:${count}`;
  
  // 1. Verificar Cache
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // 2. Verificar Requisição Pendente
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const request = withRetry(async () => {
    const filterDesc = [
      filters.materia ? `Matéria: ${filters.materia}` : '',
      filters.assunto ? `Assunto: ${filters.assunto}` : '',
      filters.banca ? `Banca: ${filters.banca}` : 'Banca: FGV ou CEBRASPE',
      filters.ano ? `Ano: ${filters.ano}` : '',
      filters.tipos && filters.tipos.length > 0 ? `Estilo: ${filters.tipos.join('/')}` : ''
    ].filter(Boolean).join(', ');
    
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para: ${filterDesc}.
        Nível: Muito Difícil (Padrão Delegado/Perito/Agente Federal).

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
  const cacheKey = `SQ:${subject}:${topic}`;
  
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar 1 questão técnica inédita EXCLUSIVAMENTE para:
        MATÉRIA: "${subject}"
        ASSUNTO: "${topic}"
        Nível: Muito Difícil. Banca: CEBRASPE ou FGV.
        
        DIRETRIZES DE QUALIDADE PEDAGÓGICA:
        1. Foco em jurisprudência e doutrina moderna para Direito.
        2. Foco em normas cultas e pegadinhas de interpretação para Português.
        ${DETAILED_COMMENTARY_INSTRUCTION}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA
      }
    });

    const q = JSON.parse(cleanJson(response.text || '{}'));
    const result = {
      ...q,
      id: `inf-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    };
    
    setCachedData(cacheKey, result);
    return result;
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

  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR E ESPECIALISTA EM CONCURSOS POLICIAIS.
        MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".
        Nível: Muito Difícil (Padrão Delegado/Perito/Agente Federal).
        
        DIRETRIZES DE QUALIDADE PEDAGÓGICA:
        1. Distribuição equilibrada entre os subtemas mais cobrados da matéria.
        2. Questões que exijam raciocínio e aplicação da lei/conceito, não apenas decoreba.
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

/**
 * Corrects an essay based on a specific theme using standardized exam criteria.
 */
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

/**
 * Generates a batch of flashcards for active recall study.
 */
export const generateFlashcardsBatch = async (
  subject: string, 
  count: number
): Promise<Flashcard[]> => {
  const cacheKey = `FC:${subject}:${count}`;
  
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const request = withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `VOCÊ É UM ESPECIALISTA EM MEMORIZAÇÃO E ACTIVE RECALL.
        MISSÃO: Gerar ${count} flashcards de alto rendimento para a matéria: ${subject}.
        
        REGRAS DO CONTEÚDO:
        1. O 'front' deve ser uma pergunta ou conceito gatilho.
        2. O 'back' deve ser uma explicação rica, direta e incluir bases legais ou mnemônicos quando aplicável.
        ${DETAILED_COMMENTARY_INSTRUCTION}`,
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
