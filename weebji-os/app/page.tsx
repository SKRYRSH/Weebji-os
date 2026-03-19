'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
type Screen = 'splash' | 'class-selection';

const CLASSES = [
  {
    id: 'monarch',
    name: 'THE MONARCH',
    color: '#00F5FF',
    shadowClass: 'shadow-[#00F5FF]/40',
    borderClass: 'border-[#00F5FF]/50',
    textClass: 'text-[#00F5FF]',
    lore: 'Physical supremacy. Calisthenics, body recomposition, gym tracking. Evolve from a Weak NPC to The Shadow Monarch.',
    placeholder: '/assets/monarch-placeholder.jpg'
  },
  {
    id: 'mastermind',
    name: 'THE MASTERMIND',
    color: '#FF2233',
    shadowClass: 'shadow-[#FF2233]/40',
    borderClass: 'border-[#FF2233]/50',
    textClass: 'text-[#FF2233]',
    lore: 'Academic domination. Deep work, study streaks, exam prep. Evolve from a Bored Student to God of the New World.',
    placeholder: '/assets/mastermind-placeholder.jpg'
  },
  {
    id: 'monk',
    name: 'THE MONK',
    color: '#A8D8A8',
    shadowClass: 'shadow-[#A8D8A8]/40',
    borderClass: 'border-[#A8D8A8]/50',
    textClass: 'text-[#A8D8A8]',
    lore: 'Dopamine detox combined with daily mindset rituals. Evolve from The Distracted to The Untouchable.',
    placeholder: '/assets/monk-placeholder.jpg'
  }
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {currentScreen === 'splash' && (
          <Splash key="splash" onEnter={() => setCurrentScreen('class-selection')} />
        )}
        {currentScreen === 'class-selection' && (
          <ClassSelection key="class-selection" />
        )}
      </AnimatePresence>
    </div>
  );
}

function Splash({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.div 
      className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ delay: 0.2, duration: 1.2, ease: "easeOut" }}
        className="mb-16"
      >
        <h1 className="font-cinzel text-4xl tracking-widest text-white mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">WEEBJI OS</h1>
        <p className="font-mono text-text-secondary text-sm tracking-widest uppercase">The Awakening</p>
      </motion.div>

      <motion.button
        onClick={onEnter}
        className="glass-card px-8 py-4 font-cinzel text-xp-gold tracking-widest uppercase text-sm relative overflow-hidden group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        <span className="relative z-10 drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]">Enter the Forge</span>
        <div className="absolute inset-0 bg-xp-gold opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
        <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(255,215,0,0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </motion.button>
    </motion.div>
  );
}

function ClassSelection() {
  return (
    <motion.div 
      className="flex-1 flex flex-col p-6 pt-12 overflow-y-auto pb-12 z-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-8 text-center">
        <h2 className="font-cinzel text-xp-gold text-2xl mb-2 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">SELECT YOUR PATH</h2>
        <p className="text-text-secondary text-xs font-mono uppercase tracking-widest">The system awaits your decision</p>
      </div>

      <div className="space-y-6">
        {CLASSES.map((cls, i) => (
          <motion.button
            key={cls.id}
            className={`w-full text-left glass-card p-4 relative overflow-hidden group transition-all duration-500 border border-white/10 hover:${cls.borderClass} hover:shadow-[0_0_25px_rgba(0,0,0,0)] hover:${cls.shadowClass}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.2, duration: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Background Glow on Hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-r from-transparent via-[${cls.color}] to-transparent`} />
            
            <div className="relative z-10">
              {/* 16:9 Placeholder */}
              <div className="w-full aspect-video bg-black/40 rounded-lg mb-4 border border-white/5 flex items-center justify-center overflow-hidden relative group-hover:border-white/20 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest z-20 opacity-50">
                  [ Leonardo.ai Asset: {cls.id} ]
                </span>
              </div>

              {/* Class Info */}
              <h3 className={`font-cinzel text-xl mb-2 ${cls.textClass} drop-shadow-[0_0_8px_currentColor]`}>{cls.name}</h3>
              <p className="text-sm text-white/80 leading-relaxed font-sans">{cls.lore}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
