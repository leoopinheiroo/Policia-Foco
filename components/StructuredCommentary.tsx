
import React from 'react';

interface StructuredCommentaryProps {
  text: string;
}

export const StructuredCommentary: React.FC<StructuredCommentaryProps> = ({ text }) => {
  const sections = [
    { key: '[RESUMO DA CORRETA]', icon: '✅', title: 'Explicação da Correta', color: 'bg-green-500/10 border-green-500/20 text-green-900', labelColor: 'bg-green-600' },
    { key: '[POR QUE AS OUTRAS ESTÃO ERRADAS?]', icon: '✕', title: 'Por que as outras estão erradas', color: 'bg-red-500/5 border-red-500/10 text-slate-800', labelColor: 'bg-red-600' },
    { key: '[MNEMÔNICO / DICA DE OURO]', icon: '💡', title: 'Dica de Prova', color: 'bg-yellow-500/10 border-yellow-500/30 text-slate-900', labelColor: 'bg-yellow-600' },
    { key: '[CUIDADO COM A PEGADINHA!]', icon: '⚠️', title: 'Radar de Pegadinha', color: 'bg-orange-500/10 border-orange-500/30 text-orange-900', labelColor: 'bg-orange-600' },
    { key: '[RESUMO DO TEMA]', icon: '📚', title: 'Resumo do Tema', color: 'bg-blue-500/10 border-blue-500/20 text-blue-900', labelColor: 'bg-blue-600' }
  ];

  const renderSection = (section: typeof sections[0]) => {
    const parts = text.split(section.key);
    if (parts.length < 2) return null;
    
    // Pega o conteúdo até o próximo marcador de seção
    let content = parts[1];
    sections.forEach(s => {
      if (s.key !== section.key) {
        content = content.split(s.key)[0];
      }
    });

    if (!content.trim()) return null;

    return (
      <div key={section.key} id={section.key.replace(/[\[\]]/g, '').toLowerCase().replace(/\s/g, '-')} className={`p-8 rounded-[2.5rem] border-2 mb-8 ${section.color} animate-fade-in shadow-sm`}>
        <div className="flex items-center gap-3 mb-6">
          <span className={`px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest ${section.labelColor} flex items-center gap-2 shadow-lg`}>
            <span>{section.icon}</span> {section.title}
          </span>
        </div>
        <div className="space-y-4">
          {content.trim().split('\n\n').map((para, pi) => (
            <p key={pi} className="text-base md:text-lg leading-relaxed font-medium">
              {/* Transformar citações de leis em "Marca Texto" */}
              {para.split(/(Art\.\s\d+|Lei\snº\s\d+\.\d+)/g).map((chunk, ci) => (
                chunk.match(/(Art\.\s\d+|Lei\snº\s\d+\.\d+)/) ? 
                <span key={ci} className="bg-yellow-300/40 px-2 py-0.5 rounded font-black border-b-2 border-yellow-500/50 text-slate-900">{chunk}</span> : 
                chunk
              ))}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const hasMarkers = sections.some(s => text.includes(s.key));

  return (
    <div className="space-y-6">
      {hasMarkers ? (
        sections.map(s => renderSection(s))
      ) : (
        <div className="p-8 rounded-[2.5rem] border-2 border-slate-200 bg-slate-100 text-slate-800 animate-fade-in shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <span className="px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest bg-slate-600 flex items-center gap-2 shadow-lg">
                💡 Comentário Técnico IA
              </span>
           </div>
           <div className="text-base md:text-lg leading-relaxed font-medium text-slate-700 whitespace-pre-wrap">
              {text}
           </div>
        </div>
      )}
    </div>
  );
};
