import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ToastMessage } from '../../hooks/useToast';

export function Toast({ toast }: { toast: ToastMessage | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-28 left-1/2 z-[100] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className={cn(
            'px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-black text-sm border',
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
            toast.type === 'error' ? 'bg-rose-50 text-rose-600 border-rose-100' :
            'bg-slate-800 text-white border-slate-700'
          )}>
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'error' && <X size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
