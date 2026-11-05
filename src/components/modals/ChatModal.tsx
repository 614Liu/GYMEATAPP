import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Utensils, Lightbulb } from 'lucide-react';
import type { ChatMessage } from '../../lib/gemini';
import { isSubmitEnter } from '../ui/motion';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  /** 返回是否已发出 */
  onSend: (text: string) => Promise<boolean>;
}

export function ChatModal({ isOpen, onClose, messages, loading, onSend }: ChatModalProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 有新消息或正在等回复时滚到底部
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const sendTyped = () => {
    const text = input;
    onSend(text).then((sent) => { if (sent) setInput(''); });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[80dvh]"
          >
            {/* header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">AI 营养教练</h2>
                  <p className="text-[11px] text-slate-400 font-bold">只回答饮食营养相关问题</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="关闭" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar" aria-live="polite">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 mt-8 px-6">
                  <Sparkles size={32} className="mx-auto mb-3 text-emerald-200" />
                  <p className="text-sm font-medium">问我任何饮食、营养、热量相关的问题吧。</p>
                  <p className="text-xs mt-2 text-slate-300">比如："我今天蛋白够吗？""晚上还能吃点什么？"</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-400 rounded-2xl px-4 py-2.5 text-sm">正在思考…</div>
                </div>
              )}
            </div>

            {/* quick actions */}
            <div className="px-4 pt-2 shrink-0 flex gap-2 flex-wrap">
              <button
                onClick={() => onSend('根据我今天的饮食和目标，推荐下一餐吃什么，给我2-3个具体建议')}
                disabled={loading}
                className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                <Utensils size={13} /> 推荐下一餐
              </button>
              <button
                onClick={() => onSend('我今天的营养摄入怎么样？还差什么？')}
                disabled={loading}
                className="flex items-center gap-1 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                <Lightbulb size={13} /> 今日分析
              </button>
            </div>

            {/* input */}
            <div className="p-4 pt-2 border-t border-slate-100 shrink-0 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (isSubmitEnter(e)) sendTyped(); }}
                placeholder="输入你的问题…"
                className="flex-1 px-4 py-3 bg-slate-50 rounded-2xl outline-none font-medium text-sm focus:bg-slate-100 transition-colors"
              />
              <button
                onClick={sendTyped}
                disabled={loading || !input.trim()}
                className="px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-colors disabled:opacity-40 text-sm"
              >
                发送
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
