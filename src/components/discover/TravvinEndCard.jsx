import React from 'react';
import { motion } from 'framer-motion';

// End-of-video logo card. Shown for ~2s when the video finishes, then the
// video loops again. A branded "Travvin" mark animates in (scale + fade).
export default function TravvinEndCard() {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="flex items-center justify-center mb-3"
          style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 10px 30px rgba(249,115,22,0.4)' }}
          initial={{ rotate: -12 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <svg width="34" height="34" viewBox="0 0 16 16" fill="none">
            <path d="M2 13l2-6 3 3 2-5 2 5 3-3 2 6H2z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <motion.h1
          className="text-white text-3xl font-black tracking-tight"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          style={{ fontFamily: 'Heebo, sans-serif', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
        >
          Travvin
        </motion.h1>
        <motion.p
          className="text-white/50 text-xs mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          גלו את הצימרים הבאים שלכם
        </motion.p>
      </motion.div>
    </motion.div>
  );
}