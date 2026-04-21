
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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
      
      Nível: Difícil (estilo carreiras policiais).
      
      Cada questão deve seguir a estrutura de comentário:
      [RESUMO DA CORRETA]
      [POR QUE AS OUTRAS ESTÃO ERRADAS?]
      [MNEMÔNICO / DICA DE OURO]
      [CUIDADO COM A PEGADINHA!]
      
      IMPORTANTE: Para questões do tipo CERTO_ERRADO, as alternativas DEVEM ser ["Certo", "Errado"] nesta ordem.`);

    const items = JSON.parse(cleanJson(response.response.text()));
    
    // Subject and Topic Guard: Validar se a IA respeitou rigorosamente a matéria e o assunto
    if (filters.materia || filters.assunto) {
      const normalize = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const sMateria = normalize(filters.materia || "");
      const sAssunto = normalize(filters.assunto || "");

      const invalidItems = items.filter((q: any) => {
        const qMateria = normalize(q.materia);
        const qAssunto = normalize(q.assunto);

        const subjectMatch = !filters.materia || qMateria === sMateria || qMateria.includes(sMateria) || sMateria.includes(qMateria);
        const topicMatch = !filters.assunto || qAssunto === sAssunto || qAssunto.includes(sAssunto) || sAssunto.includes(qAssunto);
        
        return !subjectMatch || !topicMatch;
      });

      if (invalidItems.length > 0 && invalidItems.length === items.length) {
        console.warn(`[Subject/Topic Guard] IA gerou conteúdo irrelevante. Tentando novamente...`);
        throw new Error(`Subject/Topic mismatch: AI generated content for wrong subject or topic.`);
      }
    }

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
let aiInstance: GoogleGenerativeAI | null = null;

const getAi = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MISSING_KEY') {
      const errorMsg = "GEMINI_API_KEY não configurada. Por favor, adicione a chave no menu Settings.";
      console.warn(errorMsg);
      throw new Error(errorMsg);
    }
    aiInstance = new GoogleGenerativeAI(apiKey);
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

/**
 * Generates a single high-quality question for a specific subject and topic.
 */
export const fetchSinglePoliceQuestion = async (
  subject: string, 
  topic: string
): Promise<Question | null> => {
  return withRetry(async () => {
    try {
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
        ASSUNTO: "${topic}"
        
        REGRA DE OURO (ISOLAMENTO TOTAL): 
        - A questão deve ser 100% focada em "${subject}" e especificamente no assunto "${topic}". 
        - É TERMINANTEMENTE PROIBIDO que a questão contenha qualquer elemento, termo ou conceito que pertença a outra disciplina ou outro assunto. 
        - ERRO CRÍTICO A EVITAR: Não misture Direito com Matemática. Se o usuário pediu Direito Processual Penal, não gere questões de Raciocínio Lógico ou Matemática.
        - Antes de finalizar o JSON, faça uma auto-auditoria: "Esta questão pertence EXCLUSIVAMENTE a ${subject} - ${topic}?". Se a resposta for não, descarte e gere outra.
        - No campo 'materia' do JSON, escreva EXATAMENTE: "${subject}"
        - No campo 'assunto' do JSON, escreva EXATAMENTE: "${topic}"
        
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
        - Para questões CERTO_ERRADO: Alternativas devem ser obrigatoriamente ["Certo", "Errado"] nesta ordem.`);

      const q = JSON.parse(cleanJson(response.response.text()));

      // Strict Subject and Topic Guard
      const normalize = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const qMateria = normalize(q.materia);
      const qAssunto = normalize(q.assunto);
      const sMateria = normalize(subject);
      const sAssunto = normalize(topic);

      const subjectMatch = qMateria === sMateria || qMateria.includes(sMateria) || sMateria.includes(qMateria);
      const topicMatch = qAssunto === sAssunto || qAssunto.includes(sAssunto) || sAssunto.includes(qAssunto);

      if (!subjectMatch || !topicMatch) {
        console.warn(`[Subject/Topic Guard] IA gerou questão de [${q.materia} | ${q.assunto}] para [${subject} | ${topic}]. Relaxando para evitar erro...`);
      }

      return {
        ...q,
        id: `inf-${Date.now()}-${Math.random()}`,
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
      MISSÃO: Gerar um lote de ${count} questões técnicas inéditas EXCLUSIVAMENTE para a matéria: "${subject}".
      
      PROTOCOLO DE SEGURANÇA DE MATÉRIA:
      - Você deve gerar questões APENAS de "${subject}". 
      - É TERMINANTEMENTE PROIBIDO misturar temas. Se o usuário pediu "${subject}", ele quer testar conhecimentos específicos desta área.
      - ERRO CRÍTICO A EVITAR: Não misture Direito com Matemática. Se o usuário pediu Direito Processual Penal, não gere questões de Raciocínio Lógico ou Matemática.
      - Mantenha o foco 100% na disciplina solicitada.
      - No campo 'materia' do JSON, escreva EXATAMENTE: "${subject}"
      
      Nível: Difícil (estilo CEBRASPE/FGV para carreiras policiais).
      
      Cada questão deve seguir a estrutura de comentário:
      [RESUMO DA CORRETA]
      [POR QUE AS OUTRAS ESTÃO ERRADAS?]
      [MNEMÔNICO / DICA DE OURO]
      [CUIDADO COM A PEGADINHA!]
      
      IMPORTANTE: Para questões do tipo CERTO_ERRADO, as alternativas DEVEM ser ["Certo", "Errado"] nesta ordem.`);

    const items = JSON.parse(cleanJson(response.response.text()));

    // Strict Subject Guard
    const normalize = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const sMateria = normalize(subject);
    const invalidItems = items.filter((q: any) => {
      const qMateria = normalize(q.materia);
      return !(qMateria === sMateria || qMateria.includes(sMateria) || sMateria.includes(qMateria));
    });
    if (invalidItems.length > 0 && invalidItems.length === items.length) {
      console.warn(`[Subject Guard] IA gerou conteúdo irrelevante para a matéria ${subject}.`);
      throw new Error(`Subject mismatch: AI generated content for wrong subject.`);
    }

    return items.map((q: any) => ({
      ...q,
      id: `sim-${Date.now()}-${Math.random()}`,
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
    }).generateContent(`Você é um avaliador sênior de redações para concursos de elite (PF, PRF, PC, Senado).
      Sua correção deve ser rigorosa, técnica e seguir estritamente os padrões das bancas CEBRASPE e FGV.
      
      TEMA PROPOSTO: "${theme}"
      REDAÇÃO PARA AVALIAÇÃO:
      ${essay}
      
      DIRETRIZES DE CORREÇÃO:
      1. RIGOR TÉCNICO: Não seja "bonzinho". Se houver erro de concordância, desconte. Se o argumento for raso, desconte.
      2. CRITÉRIOS DE PONTUAÇÃO (0-25 cada):
         - ESTRUTURA: Respeito à tipologia dissertativo-argumentativa, introdução, desenvolvimento e conclusão.
         - ARGUMENTAÇÃO: Capacidade de defender um ponto de vista com dados, fatos e lógica.
         - COESÃO E COERÊNCIA: Uso de conectivos, progressão textual e ausência de contradições.
         - GRAMÁTICA: Domínio da norma culta (ortografia, pontuação, regência, concordância).
      3. MARCAÇÃO DE ERROS (CRUCIAL): No campo 'markedEssay', você DEVE transcrever a redação inteira e envolver CADA erro (gramatical, sintático ou de pontuação) em tags <u></u>. Não pule nenhum erro.
      4. EXEMPLOS DIDÁTICOS: No campo 'improvementExamples', mostre como o aluno errou e como seria a forma correta (padrão ouro).
      
      REQUISITOS DA RESPOSTA (JSON):
      - score: Nota final de 0 a 100.
      - detailedScores: Objeto com as notas individuais (estrutura, argumentacao, coesao, gramatica, total).
      - comments: Breve comentário sobre a qualidade geral da redação (ANÁLISE GERAL).
      - strengths: Lista de 2 a 4 pontos positivos (PONTOS FORTES).
      - weaknesses: Lista de problemas de estrutura ou desenvolvimento (PONTOS DE MELHORIA).
      - grammarIssues: Lista de termos gramaticais identificados como problemas.
      - markedEssay: Texto completo com erros envolvidos em tags <u></u>.
      - improvementExamples: Lista de objetos com original, corrected, explanation e paragraph.
      - recommendation: 2 ou 3 frases orientando como melhorar (RECOMENDAÇÃO FINAL).`);

    return JSON.parse(cleanJson(response.response.text()));
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
    const response = await getAi().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              front: { type: SchemaType.STRING, description: "Pergunta ou conceito" },
              back: { type: SchemaType.STRING, description: "Resposta técnica ou explicação" },
              assunto: { type: SchemaType.STRING }
            },
            required: ["front", "back", "assunto"]
          }
        }
      }
    }).generateContent(`Gerar ${count} flashcards de alto rendimento EXCLUSIVAMENTE para a matéria: ${subject}.
      
      PROTOCOLO DE ISOLAMENTO:
      - Os flashcards devem tratar APENAS de ${subject}. 
      - É terminantemente proibido misturar com outras disciplinas. 
      - Se a matéria for ${subject}, não inclua conceitos de Direito se for uma matéria de Exatas, ou vice-versa.
      
      Foque em conceitos-chave, prazos legais, mnemônicos e pegadinhas recorrentes em concursos policiais.`);

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
