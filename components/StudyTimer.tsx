
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Timer, Coffee, Brain } from 'lucide-react';

export const StudyTimer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'STUDY' | 'BREAK'>('STUDY');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        if (mode === 'STUDY') {
          setTotalStudyTime(prev => prev + 1);
        }
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Auto switch mode
      if (mode === 'STUDY') {
        setMode('BREAK');
        setTimeLeft(5 * 60);
      } else {
        setMode('STUDY');
        setTimeLeft(25 * 60);
      }
      
      // Play notification sound if possible
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play();
      } catch (e) {}
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setMode('STUDY');
    setTimeLeft(25 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl border border-white/10 mb-6 w-72"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                {mode === 'STUDY' ? <Brain className="w-4 h-4 text-yellow-500" /> : <Coffee className="w-4 h-4 text-emerald-500" />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {mode === 'STUDY' ? 'Foco Total' : 'Descanso'}
                </span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center mb-8">
              <div className="text-6xl font-black tracking-tighter mb-2 tabular-nums">
                {formatTime(timeLeft)}
              </div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Tempo Restante
              </div>
            </div>

            <div className="flex gap-4 mb-8">
              <button
                onClick={toggleTimer}
                className={`flex-1 py-4 rounded-2xl flex items-center justify-center transition-all ${
                  isActive ? 'bg-slate-800 text-white' : 'bg-yellow-500 text-slate-950'
                }`}
              >
                {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button
                onClick={resetTimer}
                className="w-14 bg-slate-800 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-between items-center">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sessão Hoje:</div>
              <div className="text-xs font-black text-yellow-500">{formatTotalTime(totalStudyTime)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
          isOpen ? 'bg-slate-900 text-white' : 'bg-yellow-500 text-slate-950'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Timer className="w-6 h-6" />}
        {!isOpen && isActive && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
        )}
      </motion.button>
    </div>
  );
};
