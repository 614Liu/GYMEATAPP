import { motion } from 'motion/react';
import { Sparkles, RefreshCw, Lightbulb } from 'lucide-react';
import { cardVariants } from '../ui/motion';

interface CoachCardProps {
  tip: string;
  loading: boolean;
  onRefresh: () => void;
  onOpenChat: () => void;
}

export function CoachCard({ tip, loading, onRefresh, onOpenChat }: CoachCardProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
            <Sparkles size={16} />
          </div>
          <span className="text-sm font-black text-slate-900">AI 营养教练</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          aria-label="刷新建议"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {tip ? (
        <div className="flex gap-2 items-start mb-4 bg-emerald-50/60 rounded-2xl p-3.5">
          <Lightbulb size={16} className="text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700 leading-relaxed font-medium">{tip}</p>
        </div>
      ) : (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full text-left text-sm text-slate-400 mb-4 hover:text-emerald-600 transition-colors bg-slate-50 rounded-2xl p-3.5"
        >
          {loading ? '正在思考…' : '💡 点我获取今日营养建议 →'}
        </button>
      )}

      <button
        onClick={onOpenChat}
        className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl transition-colors text-sm"
      >
        <Sparkles size={15} />
        问教练 · 聊聊今天吃什么
      </button>
    </motion.section>
  );
}
