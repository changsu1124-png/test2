import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';

interface FeedbackOverlayProps {
  type: 'correct' | 'incorrect' | 'timeout' | null;
  pointsEarned?: number;
  onAnimationComplete: () => void;
}

export const FeedbackOverlay: React.FC<FeedbackOverlayProps> = ({
  type,
  pointsEarned = 10,
  onAnimationComplete,
}) => {
  const [waterPhase, setWaterPhase] = useState<'rising' | 'full' | 'disappearing'>('rising');

  useEffect(() => {
    if (!type) return;

    if (type === 'correct') {
      // Water rises up over ~1.6s, stays full briefly, then disappears
      const timer1 = setTimeout(() => {
        setWaterPhase('full');
      }, 1500);

      const timer2 = setTimeout(() => {
        setWaterPhase('disappearing');
      }, 2000);

      const timer3 = setTimeout(() => {
        onAnimationComplete();
      }, 2500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }

    if (type === 'incorrect' || type === 'timeout') {
      // User prompt requirement: "그리고 1초후 다음 문제로 넘어가"
      const timer = setTimeout(() => {
        onAnimationComplete();
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [type, onAnimationComplete]);

  if (!type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
        {/* 1. CORRECT CASE:
            "맞춘다면 고래이모지가 나오고 점점 화면에 물이 차올라 그리고 물이 다 차오르면 물이 사라지고 다음문제로 넘어갈수있게해줘." */}
        {type === 'correct' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Water rising from bottom */}
            <motion.div
              initial={{ height: '0%' }}
              animate={
                waterPhase === 'rising' || waterPhase === 'full'
                  ? { height: '100%', opacity: 0.92 }
                  : { opacity: 0 }
              }
              transition={{
                height: { duration: 1.5, ease: 'easeInOut' },
                opacity: { duration: 0.5 },
              }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-600 via-cyan-500 to-sky-400 z-10 overflow-hidden"
            >
              {/* Wave crest at top of rising water */}
              <div className="absolute top-0 left-0 right-0 h-12 -translate-y-6 w-[200%] flex animate-wave opacity-70">
                <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12 fill-cyan-300">
                  <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,-20 1200,30 L1200,120 L0,120 Z" />
                </svg>
              </div>

              {/* Water sparkling bubbles rising */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-10 left-1/4 w-6 h-6 rounded-full bg-white/40 animate-bubble-rise" />
                <div className="absolute bottom-16 right-1/3 w-8 h-8 rounded-full bg-white/30 animate-bubble-rise" style={{ animationDelay: '0.4s' }} />
                <div className="absolute bottom-5 left-1/2 w-5 h-5 rounded-full bg-white/50 animate-bubble-rise" style={{ animationDelay: '0.8s' }} />
                <div className="absolute bottom-20 right-1/4 w-10 h-10 rounded-full bg-white/30 animate-bubble-rise" style={{ animationDelay: '1.2s' }} />
              </div>
            </motion.div>

            {/* Joyful Whale Emoji & Text in Center */}
            <motion.div
              initial={{ scale: 0, y: 50, rotate: -20 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="relative z-20 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative">
                <span className="text-8xl sm:text-9xl filter drop-shadow-2xl animate-bounce select-none">
                  🐳
                </span>
                <span className="absolute -top-3 -right-3 text-4xl animate-pulse">✨</span>
                <span className="absolute -bottom-2 -left-3 text-4xl animate-pulse" style={{ animationDelay: '0.3s' }}>💦</span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-4 bg-white/95 px-6 py-3 rounded-3xl shadow-xl border-2 border-sky-300"
              >
                <p className="font-jua text-3xl sm:text-4xl text-sky-600 font-bold tracking-wide">
                  정답입니다! 🌟
                </p>
                <p className="font-gaegu text-xl sm:text-2xl text-emerald-600 font-bold mt-1">
                  +{pointsEarned}점 획득! 🌊 시원한 물이 차올라요!
                </p>
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* 2. INCORRECT CASE:
            "못맞추면 화면에 가장자리에서 빨간색이 연하게 나오고 화면 중간에 하얀색 X가 나와 그리고 1초후 다음 문제로 넘어가." */}
        {type === 'incorrect' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Soft Red Vignette around screen edges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(239,68,68,0.55)] border-[12px] border-red-400/40"
            />

            {/* Dark translucent backdrop for contrast */}
            <div className="absolute inset-0 bg-red-950/25 pointer-events-none" />

            {/* Crisp Big White 'X' in Screen Center */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
              animate={{ scale: [0.4, 1.2, 1], opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="relative z-20 flex flex-col items-center justify-center"
            >
              {/* White X symbol */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-red-500/90 shadow-2xl flex items-center justify-center border-4 border-white">
                <svg
                  className="w-20 h-20 sm:w-24 sm:h-24 text-white drop-shadow-md stroke-[4]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-5 bg-white/95 px-6 py-2.5 rounded-full shadow-lg border border-red-200"
              >
                <p className="font-jua text-2xl sm:text-3xl text-red-600 font-bold">
                  아쉬워요! 다음 문제에서 도전해봐요!
                </p>
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* 3. TIMEOUT CASE:
            "10초안에 못맞추면 시계가 나오고 TIME OUT이라고 동글동글 한 검은색 문자가 나오는데 1초후에 다음문제로 넘어가." */}
        {type === 'timeout' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Neutral soft dimming overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-amber-950/20 shadow-[inset_0_0_80px_rgba(245,158,11,0.3)] pointer-events-none"
            />

            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4, type: 'spring' }}
              className="relative z-20 flex flex-col items-center justify-center text-center p-6"
            >
              {/* Cute Clock Graphic */}
              <div className="relative mb-3">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-amber-100 border-4 border-amber-400 flex items-center justify-center shadow-xl">
                  <Clock className="w-16 h-16 sm:w-20 sm:h-20 text-amber-600 animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 text-3xl animate-bounce">⏳</div>
              </div>

              {/* 동글동글한 검은색 문자: "TIME OUT" */}
              <div className="bg-white/95 px-8 py-3 rounded-3xl border-3 border-slate-900 shadow-2xl">
                <h2
                  className="font-dongle text-6xl sm:text-7xl text-black font-extrabold tracking-wider leading-none select-none"
                  style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}
                >
                  TIME OUT
                </h2>
                <p className="font-jua text-lg sm:text-xl text-slate-700 mt-0.5">
                  시간이 모두 끝났어요!
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
