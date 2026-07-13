
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Sparkles, Brain, Target, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { mentoriaChat } from '../services/geminiService';

export const MentoriaIA: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Olá, Operador! Eu sou o seu Mentor de Elite. Como posso ajudar na sua jornada rumo à aprovação hoje? Posso criar cronogramas, explicar temas complexos ou dar dicas de produtividade.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const historyForApi = messages;
      const text = await mentoriaChat(historyForApi, userMessage);
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Erro na conexão com a mentoria. Tente novamente em instantes." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100dvh-9rem)] sm:h-[calc(100vh-12rem)] flex flex-col animate-fade-in min-w-0">
      {/* Header */}
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-t-[3rem] p-4 sm:p-8 text-white flex items-center justify-between border-b border-white/5 gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-950 shrink-0">
            <Bot className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black tracking-tight truncate">Mentoria de Elite IA</h2>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest truncate">Estrategista de Carreira Policial</p>
          </div>
        </div>
        <div className="hidden md:flex gap-3">
          <div className="bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
            <Target className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Foco: Aprovação</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-white border-x border-slate-200 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6 custom-scrollbar"
      >
        {messages.map((m, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={idx}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 sm:gap-4 max-w-[90%] sm:max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-yellow-500 text-slate-950'}`}>
                {m.role === 'user' ? <User className="w-4 h-4 sm:w-5 sm:h-5" /> : <Bot className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm border min-w-0 ${
                m.role === 'user' 
                  ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                  : 'bg-slate-50 text-slate-800 border-slate-100 rounded-tl-none'
              }`}>
                <div className="prose prose-slate max-w-none prose-sm font-medium leading-relaxed break-words">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 sm:p-8 rounded-b-2xl sm:rounded-b-[3rem] border border-slate-200 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre cronogramas, editais ou dicas..."
            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-yellow-500 transition-all text-sm sm:text-base"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-yellow-500 text-slate-950 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto shrink-0"
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
        </div>
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
          {[
            { icon: <Calendar className="w-3 h-3" />, text: 'Criar cronograma de 30 dias' },
            { icon: <Brain className="w-3 h-3" />, text: 'Como estudar Direito Penal?' },
            { icon: <Sparkles className="w-3 h-3" />, text: 'Dicas para o TAF' }
          ].map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => setInput(suggestion.text)}
              className="px-3 sm:px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest border border-slate-200 transition-all flex items-center gap-2"
            >
              {suggestion.icon}
              <span className="truncate max-w-[180px] sm:max-w-none">{suggestion.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
