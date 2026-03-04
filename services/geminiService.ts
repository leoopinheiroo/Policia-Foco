
import { GoogleGenAI, Type } from "@google/genai";
import { Question, EssayFeedback, Flashcard } from "../types";

// Lazy initialization of the Gemini client
let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY não configurada. Algumas funcionalidades podem não funcionar.");
      // Retornamos uma instância dummy ou lidamos com o erro depois
      // Para evitar crash no carregamento do módulo, não lançamos erro aqui
      aiInstance = new GoogleGenAI({ apiKey: "MISSING_KEY" });
    } else {
      aiInstance = new GoogleGenAI({ apiKey });
    }
  }
  return aiInstance;
};

const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.message?.includes('429') || error?.message?.includes('fetch'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generates a single high-quality question for a specific subject and topic.
 */
export const fetchSinglePoliceQuestion = async (
  subject: string, 
  topic: string
): Promise<Question | null> => {
  return withRetry(async () => {
    try {
      const response = await getAi().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `PERSONA: Professor Especialista em Concursos Policiais com foco em Didática e Memorização.
        MISSÃO: Gerar 1 questão técnica inédita sobre ${topic} (${subject}).
        
        REQUISITOS DO COMENTÁRIO (ESTRUTURA OBRIGATÓRIA):
        Você deve formatar o campo 'comentario' exatamente assim, usando estes títulos para eu processar visualmente:

        [RESUMO DA CORRETA]
        (Explique profundamente por que o gabarito é este, citando Lei, Doutrina ou Jurisprudência).

        [POR QUE AS OUTRAS ESTÃO ERRADAS?]
        (Analise cada alternativa incorreta individualmente, apontando o erro jurídico ou lógico de cada uma).

        [MNEMÔNICO / DICA DE OURO]
        (Crie um macete, frase ou técnica de memorização para este tema específico).

        [CUIDADO COM A PEGADINHA!]
        (Explique como a banca costuma tentar enganar o aluno neste assunto).

        REQUISITOS TÉCNICOS:
        - Banca: CEBRASPE ou FGV.
        - Nível: Difícil.
        - Formato: JSON puro.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              banca: { type: Type.STRING },
              ano: { type: Type.INTEGER },
              orgao: { type: Type.STRING },
              cargo: { type: Type.STRING },
              textoBase: { type: Type.STRING },
              texto: { type: Type.STRING },
              tipo: { type: Type.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] },
              alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
              correta: { type: Type.INTEGER },
              comentario: { type: Type.STRING }
            },
            required: ["banca", "ano", "orgao", "cargo", "texto", "tipo", "alternativas", "correta", "comentario"]
          }
        }
      });

      const q = JSON.parse(cleanJson(response.text));
      return {
        ...q,
        id: `inf-${Date.now()}-${Math.random()}`,
        materia: subject,
        assunto: topic,
        tema: topic,
        origem: 'IA',
        isAiGenerated: true
      };
    } catch (error) {
      console.error("Erro na geração de questão:", error);
      return null;
    }
  });
};

/**
 * Gera um lote de questões para uma matéria específica.
 */
export const generateQuestionsForSubject = async (
  subject: string,
  count: number
): Promise<Question[]> => {
  if (count <= 0) return [];
  
  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gerar um lote de ${count} questões técnicas inéditas para a matéria: ${subject}.
      Nível: Difícil (estilo CEBRASPE/FGV para carreiras policiais).
      
      Cada questão deve seguir a estrutura de comentário:
      [RESUMO DA CORRETA]
      [POR QUE AS OUTRAS ESTÃO ERRADAS?]
      [MNEMÔNICO / DICA DE OURO]
      [CUIDADO COM A PEGADINHA!]`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              banca: { type: Type.STRING },
              ano: { type: Type.INTEGER },
              orgao: { type: Type.STRING },
              cargo: { type: Type.STRING },
              assunto: { type: Type.STRING },
              textoBase: { type: Type.STRING },
              texto: { type: Type.STRING },
              tipo: { type: Type.STRING, enum: ["CERTO_ERRADO", "MULTIPLA_ESCOLHA"] },
              alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
              correta: { type: Type.INTEGER },
              comentario: { type: Type.STRING }
            },
            required: ["banca", "ano", "orgao", "cargo", "assunto", "texto", "tipo", "alternativas", "correta", "comentario"]
          }
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text));
    return items.map((q: any) => ({
      ...q,
      id: `sim-${Date.now()}-${Math.random()}`,
      materia: subject,
      origem: 'IA',
      isAiGenerated: true
    }));
  });
};

/**
 * Corrects an essay based on a specific theme using standardized exam criteria.
 */
export const correctEssayWithAi = async (essay: string, theme: string): Promise<EssayFeedback> => {
  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `PERSONA: Professor de Redação Especialista em Concursos Policiais (Bancas CESPE/Cebraspe, FGV, VUNESP).
      MISSÃO: Corrigir a redação abaixo de forma rigorosa, simulando o espelho de correção oficial.
      
      TEMA: "${theme}"
      REDAÇÃO DO ALUNO:
      ${essay}
      
      CRITÉRIOS DE AVALIAÇÃO:
      1. Apresentação e Legibilidade (Estrutura dissertativa-argumentativa).
      2. Desenvolvimento do Tema (Pertinência e profundidade).
      3. Coesão e Coerência (Uso de conectivos, pronomes, progressão textual).
      4. Domínio da Norma Culta (Gramática, pontuação, concordância, regência).
      
      REQUISITOS DA RESPOSTA:
      - NOTA: De 0 a 10.0. Comece com 10.0 e aplique descontos rigorosos para cada erro gramatical (-0.1 a -0.5 dependendo da gravidade) e descontos maiores para falhas de estrutura ou fuga ao tema.
      - MARKED_ESSAY: Retorne o texto completo da redação, mas envolva os erros em tags <u></u> (ex: <u>erro de concordância</u>).
      - COMENTÁRIOS: Explique a nota detalhadamente, citando os critérios da banca escolhida (CESPE ou VUNESP).
      - EXEMPLOS: Mostre como reescrever trechos problemáticos.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Nota de 0 a 10.0" },
            comments: { type: Type.STRING, description: "Visão geral do examinador" },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            grammarIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            markedEssay: { type: Type.STRING, description: "Texto da redação com erros sublinhados usando <u></u>" },
            improvementExamples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  corrected: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["original", "corrected", "explanation"]
              }
            }
          },
          required: ["score", "comments", "strengths", "weaknesses", "grammarIssues", "markedEssay", "improvementExamples"]
        }
      }
    });

    return JSON.parse(cleanJson(response.text));
  });
};

/**
 * Generates a batch of flashcards for active recall study.
 */
export const generateFlashcardsBatch = async (
  subject: string, 
  count: number
): Promise<Flashcard[]> => {
  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Gerar ${count} flashcards de alto rendimento para a matéria: ${subject}.
      Foque em conceitos-chave, prazos legais, mnemônicos e pegadinhas recorrentes em concursos policiais.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING, description: "Pergunta ou conceito" },
              back: { type: Type.STRING, description: "Resposta técnica ou explicação" },
              assunto: { type: Type.STRING }
            },
            required: ["front", "back", "assunto"]
          }
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text));
    return items.map((f: any) => ({
      ...f,
      id: `fc-${Date.now()}-${Math.random()}`,
      materia: subject,
      nextReview: Date.now(),
      difficultyFactor: 2.5
    }));
  });
};
