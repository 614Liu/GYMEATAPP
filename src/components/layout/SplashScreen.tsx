import { motion, AnimatePresence } from 'motion/react';
import { Flame } from 'lucide-react';

export function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center p-8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
            className="relative"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20"
            >
              <Flame size={48} fill="currentColor" />
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
            className="mt-8 text-center space-y-4"
          >
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">健食</h1>
            <p className="text-xs font-black text-slate-400 tracking-widest uppercase">by 614</p>
            <div className="flex items-center gap-2 justify-center pt-2">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
