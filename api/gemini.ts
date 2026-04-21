
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Question, EssayFeedback, Flashcard, QuestionFilters } from "../types";

// Lazy initialization of the Gemini client
let aiInstance: GoogleGenerativeAI | null = null;

const getAi = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MISSING_KEY') {
      const errorMsg = "GEMINI_API_KEY não configurada no servidor.";
      console.warn(errorMsg);
      throw new Error(errorMsg);
    }
    aiInstance = new GoogleGenerativeAI(apiKey);
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

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = 
      error?.message?.includes('429') || 
      error?.message?.includes('500') ||
      error?.message?.includes('503') ||
      error?.message?.includes('fetch') || 
      error?.message?.includes('Subject/Topic mismatch') ||
      error?.message?.includes('Subject mismatch');

    if (retries > 0 && isRetryable) {
      console.log(`[Retry] Falha detectada: ${error.message}. Tentando novamente (${retries} restantes)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const fetchFilteredQuestionsAction = async (
  filters: QuestionFilters,
  count: number = 10
): Promise<Question[]> => {
  return withRetry(async () => {
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              banca: { type: SchemaType.STRING },
              ano: { type: SchemaType.NUMBER },
              orgao: { type: SchemaType.STRING },
              cargo: { type: SchemaType.STRING },
              materia: { type: SchemaType.STRING },
              assunto: { type: SchemaType.STRING },
              textoBase: { type: SchemaType.STRING },
              texto: { type: SchemaType.STRING },
              tipo: { type: SchemaType.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] } as any,
              alternativas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correta: { type: SchemaType.NUMBER },
              comentario: { type: SchemaType.STRING }
            },
            required: ["banca", "ano", "orgao", "cargo", "materia", "assunto", "texto", "tipo", "alternativas", "correta", "comentario"]
          }
        }
      }
    }).generateContent(`VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR.
      MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para:
      MATÉRIA: "${filters.materia || 'Não especificada'}"
      ASSUNTO: "${filters.assunto || 'Não especificado'}"
      
      PROTOCOLO DE ISOLAMENTO ABSOLUTO (SEGURANÇA DE CONTEÚDO): 
      - É TERMINANTEMENTE PROIBIDO incluir questões de outras matérias ou assuntos. 
      - Se a matéria solicitada for "${filters.materia}", todas as questões devem ser estritamente sobre temas de "${filters.materia}". 
      - Se o assunto for "${filters.assunto}", todas as questões devem ser estritamente sobre "${filters.assunto}".
      - ERRO CRÍTICO A EVITAR: Não misture Direito com Matemática. Se o usuário pediu Direito Processual Penal, não gere questões de Raciocínio Lógico ou Matemática.
      - No campo 'materia' do JSON, escreva EXATAMENTE: "${filters.materia || 'Matéria'}"
      - No campo 'assunto' do JSON, escreva EXATAMENTE: "${filters.assunto || 'Assunto'}"
      
      Nível: Difícil (estilo carreiras policiais).`);

    const items = JSON.parse(cleanJson(response.response.text()));
    return items.map((q: any) => ({
      ...q,
      id: `filt-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    }));
  });
};

export const fetchSinglePoliceQuestionAction = async (
  subject: string, 
  topic: string
): Promise<Question | null> => {
  return withRetry(async () => {
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            banca: { type: SchemaType.STRING },
            ano: { type: SchemaType.NUMBER },
            orgao: { type: SchemaType.STRING },
            cargo: { type: SchemaType.STRING },
            materia: { type: SchemaType.STRING },
            assunto: { type: SchemaType.STRING },
            textoBase: { type: SchemaType.STRING },
            texto: { type: SchemaType.STRING },
            tipo: { type: SchemaType.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] } as any,
            alternativas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            correta: { type: SchemaType.NUMBER },
            comentario: { type: SchemaType.STRING }
          },
          required: ["banca", "ano", "orgao", "cargo", "materia", "assunto", "texto", "tipo", "alternativas", "correta", "comentario"]
        }
      }
    }).generateContent(`VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR.
      MISSÃO: Gerar 1 questão técnica inédita EXCLUSIVAMENTE para:
      MATÉRIA: "${subject}"
      ASSUNTO: "${topic}"`);

    const q = JSON.parse(cleanJson(response.response.text()));
    return {
      ...q,
      id: `inf-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    };
  });
};

export const generateQuestionsForSubjectAction = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  return withRetry(async () => {
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              banca: { type: SchemaType.STRING },
              ano: { type: SchemaType.NUMBER },
              orgao: { type: SchemaType.STRING },
              cargo: { type: SchemaType.STRING },
              materia: { type: SchemaType.STRING },
              assunto: { type: SchemaType.STRING },
              textoBase: { type: SchemaType.STRING },
              texto: { type: SchemaType.STRING },
              tipo: { type: SchemaType.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] } as any,
              alternativas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correta: { type: SchemaType.NUMBER },
              comentario: { type: SchemaType.STRING }
            },
            required: ["banca", "ano", "orgao", "cargo", "materia", "assunto", "texto", "tipo", "alternativas", "correta", "comentario"]
          }
        }
      }
    }).generateContent(`VOCÊ É UM ARQUITETO DE CONTEÚDO EDUCACIONAL SÊNIOR.
      MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".`);

    const items = JSON.parse(cleanJson(response.response.text()));
    return items.map((q: any) => ({
      ...q,
      id: `sim-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    }));
  });
};

export const correctEssayWithAiAction = async (essay: string, theme: string): Promise<EssayFeedback> => {
  return withRetry(async () => {
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            score: { type: SchemaType.NUMBER },
            detailedScores: {
              type: SchemaType.OBJECT,
              properties: {
                estrutura: { type: SchemaType.NUMBER },
                argumentacao: { type: SchemaType.NUMBER },
                coesao: { type: SchemaType.NUMBER },
                gramatica: { type: SchemaType.NUMBER },
                total: { type: SchemaType.NUMBER }
              },
              required: ["estrutura", "argumentacao", "coesao", "gramatica", "total"]
            },
            comments: { type: SchemaType.STRING },
            strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            weaknesses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            grammarIssues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            markedEssay: { type: SchemaType.STRING },
            improvementExamples: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  original: { type: SchemaType.STRING },
                  corrected: { type: SchemaType.STRING },
                  explanation: { type: SchemaType.STRING },
                  paragraph: { type: SchemaType.NUMBER }
                },
                required: ["original", "corrected", "explanation", "paragraph"]
              }
            },
            recommendation: { type: SchemaType.STRING }
          },
          required: ["score", "detailedScores", "comments", "strengths", "weaknesses", "grammarIssues", "markedEssay", "improvementExamples", "recommendation"]
        }
      }
    }).generateContent(`Você é um avaliador sênior de redações para concursos de elite (PF, PRF, PC, Senado).`);

    return JSON.parse(cleanJson(response.response.text()));
  });
};

export const generateFlashcardsBatchAction = async (
  subject: string, 
  count: number
): Promise<Flashcard[]> => {
  return withRetry(async () => {
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              front: { type: SchemaType.STRING },
              back: { type: SchemaType.STRING },
              assunto: { type: SchemaType.STRING }
            },
            required: ["front", "back", "assunto"]
          }
        }
      }
    }).generateContent(`Gerar ${count} flashcards de alto rendimento EXCLUSIVAMENTE para a matéria: ${subject}.`);

    const items = JSON.parse(cleanJson(response.response.text()));
    return items.map((f: any) => ({
      ...f,
      id: `fc-${Date.now()}-${Math.random()}`,
      materia: subject,
      nextReview: Date.now(),
      difficultyFactor: 2.5
    }));
  });
};
