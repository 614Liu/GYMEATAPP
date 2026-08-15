import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 text-center"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">确定要退出登录吗？</h3>
            <p className="text-sm text-slate-500 font-bold mb-8">退出后将无法同步云端数据，但本地数据仍会保留。</p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black transition-colors shadow-lg shadow-rose-500/20"
              >
                确认退出
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
