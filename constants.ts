
import { Subject, Question, VadeMecumItem, Flashcard } from './types';

export const SUBJECTS: Subject[] = [
  // --- BÁSICAS ---
  { id: 'portugues', name: 'Língua Portuguesa', icon: '📚', topics: ['Compreensão e interpretação de textos', 'Tipologia textual', 'Ortografia oficial', 'Acentuação gráfica', 'Emprego das classes de palavras', 'Sintaxe da oração e do período', 'Pontuação', 'Concordância nominal e verbal', 'Regência nominal e verbal', 'Crase', 'Redação oficial'] },
  { 
    id: 'raciocinio', 
    name: 'Raciocínio Lógico-Matemático', 
    icon: '🧠', 
    topics: [
      'Estruturas lógicas', 
      'Equivalências e negações', 
      'Diagramas lógicos', 
      'Lógica de primeira ordem', 
      'Lógica de argumentação', 
      'Argumentos', 
      'Teoria dos conjuntos', 
      'Problemas aritméticos', 
      'Problemas geométricos', 
      'Problemas matriciais'
    ] 
  },
  { id: 'matematica', name: 'Matemática', icon: '➕', topics: ['Conjuntos numéricos', 'Razão e proporção', 'Regra de três', 'Porcentagem', 'Equações de 1º e 2º grau', 'Funções', 'Geometria básica', 'Probabilidade', 'Análise combinatória'] },
  { id: 'informatica', name: 'Informática', icon: '💻', topics: ['Internet e Intranet', 'Segurança da Informação', 'Redes de computadores', 'Sistemas operacionais', 'Cloud Computing', 'Pacote Office e LibreOffice', 'Big Data', 'Python e R'] },
  { id: 'atualidades', name: 'Atualidades', icon: '🌍', topics: ['Segurança Pública no Brasil', 'Tópicos de relevância política', 'Economia nacional', 'Conflitos internacionais', 'Meio ambiente e sustentabilidade', 'Direitos Humanos na atualidade'] },
  { id: 'redacao_teoria', name: 'Redação (Teoria)', icon: '✍️', topics: ['Estrutura dissertativa-argumentativa', 'Coesão e Coerência', 'Norma culta', 'Técnicas de argumentação', 'Análise de temas policiais anteriores'] },

  // --- DIREITO ---
  { id: 'constitucional', name: 'Direito Constitucional', icon: '⚖️', topics: ['Direitos e garantias fundamentais', 'Organização do Estado', 'Poder Executivo', 'Segurança Pública (Art. 144)', 'Defesa do Estado e instituições', 'Ordem social'] },
  { id: 'administrativo', name: 'Direito Administrativo', icon: '🏛️', topics: ['Estado, governo e administração pública', 'Atos administrativos', 'Agentes públicos', 'Poderes da administração', 'Licitações (Lei 14.133)', 'Improbidade (Lei 8.429)', 'Responsabilidade Civil'] },
  { id: 'penal', name: 'Direito Penal', icon: '⛓️', topics: ['Aplicação da lei penal', 'Teoria do crime', 'Ilicitude e culpabilidade', 'Crimes contra a pessoa', 'Crimes contra o patrimônio', 'Crimes contra a Administração Pública', 'Penas'] },
  { id: 'processo_penal', name: 'Direito Processual Penal', icon: '👮', topics: ['Inquérito policial', 'Prisões e liberdade provisória', 'Prova no processo penal', 'Juiz das garantias', 'Ação penal', 'Citações e intimações'] },
  { id: 'civil', name: 'Direito Civil', icon: '🏠', topics: ['LINDB', 'Pessoas naturais e jurídicas', 'Bens', 'Fatos jurídicos', 'Prescrição e decadência', 'Direito das obrigações', 'Responsabilidade civil'] },
  { id: 'processo_civil', name: 'Direito Processual Civil', icon: '📂', topics: ['Normas fundamentais', 'Competência', 'Atos processuais', 'Tutelas de urgência', 'Procedimento comum', 'Recursos'] },
  { id: 'direitos_humanos', name: 'Direitos Humanos', icon: '🤝', topics: ['Teoria geral dos Direitos Humanos', 'Afirmação histórica', 'Pacto de San José da Costa Rica', 'Declaração Universal (DUDH)', 'Grupos vulneráveis'] },
  { id: 'leg_especial', name: 'Legislação Penal Especial', icon: '📜', topics: ['Lei de Drogas', 'Estatuto do Desarmamento', 'Lei Maria da Penha', 'Abuso de Autoridade', 'Crimes Hediondos', 'Tortura', 'CTB (Crimes de Trânsito)'] },
  { id: 'criminologia', name: 'Criminologia', icon: '🔍', topics: ['Conceito e objeto', 'Escolas criminológicas', 'Teorias da criminalidade', 'Vitimologia', 'Prevenção da infração penal'] },
  { id: 'tributario', name: 'Direito Tributário', icon: '💸', topics: ['Sistema Tributário Nacional', 'Tributos em espécie', 'Competência tributária', 'Crimes contra a ordem tributária'] },

  // --- POLICIAIS ESPECÍFICAS ---
  { id: 'leg_institucional', name: 'Legislação Institucional', icon: '🎖️', topics: ['Estatuto dos Policiais Civis', 'Lei Orgânica da PC', 'Regulamento da PM', 'Lei de Criação da PRF/PF', 'Regimes disciplinares'] },
  { id: 'investigacao', name: 'Investigação Criminal', icon: '🕵️', topics: ['Técnicas de entrevista', 'Inteligência policial', 'Cadeia de custódia', 'Interceptação telefônica', 'Infiltração de agentes'] },
  { id: 'medicina_legal', name: 'Medicina Legal', icon: '🧪', topics: ['Traumatologia forense', 'Tanatologia', 'Toxicologia', 'Asfixiologia', 'Sexologia forense', 'Identificação humana'] },
  { id: 'criminalistica', name: 'Criminalística', icon: '🔬', topics: ['Conceitos e princípios', 'Locais de crime', 'Vestígios e indícios', 'Perícias em espécie', 'Documentoscopia', 'Balística forense'] },
  { id: 'estatistica', name: 'Estatística', icon: '📈', topics: ['Estatística descritiva', 'Probabilidade', 'Variáveis aleatórias', 'Inferência estatística', 'Testes de hipóteses'] },
  { id: 'contabilidade', name: 'Contabilidade', icon: '📊', topics: ['Patrimônio', 'Escrituração', 'DRE e Balanço Patrimonial', 'Contabilidade de Custos', 'Análise de demonstrações'] },
  { id: 'arquivologia', name: 'Arquivologia', icon: '📁', topics: ['Conceitos fundamentais', 'Gestão de documentos', 'Ciclo vital (Teoria das 3 idades)', 'Preservação e conservação'] },
  { id: 'adm_publica', name: 'Administração Pública', icon: '🏢', topics: ['Processo administrativo', 'Gestão de pessoas', 'Ética no serviço público', 'Governança e Transparência', 'Orçamento Público (AFO)'] }
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'rlm-db-001',
    banca: 'CEBRASPE',
    ano: 2024,
    orgao: 'PRF',
    cargo: 'Policial Rodoviário Federal',
    materia: 'Raciocínio Lógico-Matemático',
    assunto: 'Equivalências e negações',
    tema: 'Lógica Sentencial',
    texto: "Considerando a proposição P: 'Se o condutor estiver sob o efeito de álcool, então ele será multado', julgue o item: Uma negação logicamente correta para P seria: 'O condutor está sob o efeito de álcool e não será multado'.",
    tipo: 'CERTO_ERRADO',
    alternativas: ["Certo", "Errado"],
    correta: 0,
    comentario: "Correto. A negação de uma condicional (P -> Q) é feita mantendo-se a primeira parte e negando-se a segunda (P ^ ~Q). RESUMO: Para negar o 'Se... então', use a regra do 'MANÉ' (MANTÉM a primeira E NEGA a segunda).",
    origem: 'BANCO'
  },
  {
    id: 'med-db-001',
    banca: 'CEBRASPE',
    ano: 2024,
    orgao: 'PC-SP',
    cargo: 'Médico Legista',
    materia: 'Medicina Legal',
    assunto: 'Traumatologia forense',
    tema: 'Energias de Ordem Mecânica',
    texto: "No que concerne às lesões produzidas por instrumentos perfurocortantes, julgue o item: O sinal de Romanese é característico das feridas de entrada nos tiros encostados em regiões que possuem plano ósseo subjacente.",
    tipo: 'CERTO_ERRADO',
    alternativas: ["Certo", "Errado"],
    correta: 1,
    comentario: "O sinal de Romanese refere-se à ferida de saída. O sinal descrito (tiro encostado com plano ósseo) é a Câmara de Mina de Hoffmann.",
    origem: 'BANCO'
  }
];

export const INITIAL_FLASHCARDS: Flashcard[] = [
  { id: 'f1', materia: 'Direito Processual Penal', assunto: 'Inquérito Policial', front: 'O Inquérito Policial é obrigatório para o oferecimento da denúncia?', back: 'NÃO. O IP é dispensável (característica da dispensabilidade), desde que o MP possua elementos suficientes.', nextReview: Date.now(), difficultyFactor: 2.5 }
];

export const VADE_MECUM_DATA: VadeMecumItem[] = [
  { name: 'Constituição Federal (CF/88)', category: 'Direito Constitucional', link: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm' },
  { name: 'Código Penal (CP)', category: 'Direito Penal', link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848.htm' },
  { name: 'Código de Processo Penal (CPP)', category: 'Direito Processual Penal', link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm' }
];
