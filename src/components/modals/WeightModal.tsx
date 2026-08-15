import { motion, AnimatePresence } from 'motion/react';
import { Scale, X } from 'lucide-react';

interface WeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  weightInput: string;
  setWeightInput: (value: string) => void;
  onSave: (weight: number) => void;
}

export function WeightModal({ isOpen, onClose, weightInput, setWeightInput, onSave }: WeightModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <Scale size={24} className="text-violet-500" />
                记录体重
              </h3>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="例如: 65.5"
                  className="w-full p-4 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-violet-500 font-black text-2xl text-slate-900 placeholder:text-slate-300 transition-colors"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">kg</span>
              </div>

              <motion.button
                onClick={() => {
                  const w = Number(weightInput);
                  if (w > 0) {
                    onSave(w);
                    onClose();
                  }
                }}
                disabled={!weightInput || Number(weightInput) <= 0}
                className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full font-black text-lg shadow-[0_8px_30px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
              >
                保存记录
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
