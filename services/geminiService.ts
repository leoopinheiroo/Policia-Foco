
import { GoogleGenAI, Type } from "@google/genai";
/**
 * Fetches a batch of questions based on filters.
 */
export const fetchFilteredQuestions = async (
  filters: QuestionFilters,
  count: number = 10
): Promise<Question[]> => {
  return withRetry(async () => {
    const filterDesc = [
      filters.materia ? `Matéria: ${filters.materia}` : '',
      filters.assunto ? `Assunto: ${filters.assunto}` : '',
      filters.banca ? `Banca: ${filters.banca}` : 'Banca: CEBRASPE ou FGV',
      filters.ano ? `Ano: ${filters.ano}` : '',
      filters.tipos && filters.tipos.length > 0 ? `Estilo de Pergunta: ${filters.tipos.map(t => t === 'MULTIPLA_ESCOLHA' ? 'Múltipla Escolha (5 alternativas ABCDE)' : 'Certo/Errado').join(' e ')}` : ''
    ].filter(Boolean).join(', ');

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gerar um lote de ${count} questões técnicas inéditas com os seguintes filtros: ${filterDesc}.
      Nível: Difícil (estilo carreiras policiais).
      
      Cada questão deve seguir a estrutura de comentário:
      [RESUMO DA CORRETA]
      [POR QUE AS OUTRAS ESTÃO ERRADAS?]
      [MNEMÔNICO / DICA DE OURO]
      [CUIDADO COM A PEGADINHA!]
      
      IMPORTANTE: Para questões do tipo CERTO_ERRADO, as alternativas DEVEM ser ["Certo", "Errado"] nesta ordem.`,
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
          }
        }
      }
    });

    const items = JSON.parse(cleanJson(response.text));
    return items.map((q: any) => ({
      ...q,
      id: `filt-${Date.now()}-${Math.random()}`,
      origem: 'IA',
      isAiGenerated: true
    }));
  });
};

import { Question, EssayFeedback, Flashcard, UserHistory, QuestionFilters } from "../types";

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
  // Tenta extrair o objeto JSON entre as chaves ou colchetes
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
        - Formato: JSON puro.
        - Para questões CERTO_ERRADO: Alternativas devem ser obrigatoriamente ["Certo", "Errado"] nesta ordem.`,
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
      [CUIDADO COM A PEGADINHA!]
      
      IMPORTANTE: Para questões do tipo CERTO_ERRADO, as alternativas DEVEM ser ["Certo", "Errado"] nesta ordem.`,
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
      model: 'gemini-3.1-pro-preview',
      contents: `Você é um corretor profissional especializado em redações de concursos públicos brasileiros, especialmente para carreiras policiais.
      Sua tarefa é analisar e corrigir a redação enviada pelo usuário de forma clara, técnica e objetiva, evitando respostas excessivamente longas para manter o sistema rápido.
      
      TEMA: "${theme}"
      REDAÇÃO DO ALUNO:
      ${essay}
      
      REGRAS DA ANÁLISE:
      - Considere redações dissertativo-argumentativas no padrão de concursos públicos.
      - Avalie a redação em quatro critérios principais: Estrutura (0-25), Argumentação (0-25), Coesão e Coerência (0-25), Gramática (0-25).
      - Identifique erros gramaticais, de crase, pontuação, concordância, regência e colocação pronominal.
      - Para cada erro, forneça o trecho original, a correção sugerida e uma explicação breve.
      - Se a redação estiver correta em determinado ponto, destaque como ponto forte.
      - Mantenha explicações curtas para evitar lentidão.
      
      REQUISITOS DA RESPOSTA (JSON):
      - score: Nota final de 0 a 100.
      - detailedScores: Objeto com as notas individuais (estrutura, argumentacao, coesao, gramatica, total).
      - comments: Breve comentário sobre a qualidade geral da redação (ANÁLISE GERAL).
      - strengths: Lista de 2 a 4 pontos positivos (PONTOS FORTES).
      - weaknesses: Lista de problemas de estrutura ou desenvolvimento (PONTOS DE MELHORIA).
      - grammarIssues: Lista de termos gramaticais identificados como problemas.
      - markedEssay: Texto completo com erros envolvidos em tags <u></u>.
      - improvementExamples: Lista de objetos com original, corrected, explanation e paragraph.
      - recommendation: 2 ou 3 frases orientando como melhorar (RECOMENDAÇÃO FINAL).`,
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
                  paragraph: { type: Type.INTEGER }
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
      model: 'gemini-3-flash-preview',
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
