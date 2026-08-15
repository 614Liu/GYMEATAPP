import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { MacroGoals } from '../../types';

type Toast = { message: string; type: 'success' | 'error' | 'info' };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: MacroGoals;
  onUpdateGoals: (goals: MacroGoals) => void;
  fitnessGoal: string;
  setFitnessGoal: (goal: string) => void;
  aiProvider: 'gemini' | 'deepseek';
  setAiProvider: (provider: 'gemini' | 'deepseek') => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  deepseekKey: string;
  setDeepseekKey: (key: string) => void;
  setToast: (toast: Toast) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  goals,
  onUpdateGoals,
  fitnessGoal,
  setFitnessGoal,
  aiProvider,
  setAiProvider,
  apiKey,
  setApiKey,
  deepseekKey,
  setDeepseekKey,
  setToast,
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85dvh]"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-3xl font-black tracking-tighter text-slate-900">目标设定</h2>
              <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">我的目标（影响 AI 教练建议）</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'gain', label: '增肌' },
                    { key: 'lose', label: '减脂' },
                    { key: 'maintain', label: '维持' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFitnessGoal(opt.key)}
                      className={`py-3 rounded-2xl font-black transition-colors ${fitnessGoal === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex justify-between items-center">
                  <span>每日热量目标 (kcal)</span>
                  <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full normal-case tracking-normal">自动计算</span>
                </label>
                <input
                  type="number"
                  value={goals.calories}
                  readOnly
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-2xl text-emerald-600 opacity-80 cursor-not-allowed"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">蛋白质 (g)</label>
                  <input
                    type="number"
                    value={goals.protein}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateGoals({
                        ...goals,
                        protein: val,
                        calories: Math.round(val * 4 + goals.carbs * 4 + goals.fat * 9)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-black text-center"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">碳水 (g)</label>
                  <input
                    type="number"
                    value={goals.carbs}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateGoals({
                        ...goals,
                        carbs: val,
                        calories: Math.round(goals.protein * 4 + val * 4 + goals.fat * 9)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none font-black text-center"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">脂肪 (g)</label>
                  <input
                    type="number"
                    value={goals.fat}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateGoals({
                        ...goals,
                        fat: val,
                        calories: Math.round(goals.protein * 4 + goals.carbs * 4 + val * 9)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-black text-center"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex justify-between items-center">
                  <span>AI 识别引擎</span>
                </label>
                <p className="text-xs text-slate-400 font-bold mb-2">国内网络无法访问 Gemini，请切换到 DeepSeek。</p>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => {
                      setAiProvider('gemini');
                      if (typeof window !== 'undefined') localStorage.setItem('ai_provider', 'gemini');
                    }}
                    className={`flex-1 py-3 rounded-xl font-black transition-colors ${aiProvider === 'gemini' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Gemini
                  </button>
                  <button
                    onClick={() => {
                      setAiProvider('deepseek');
                      if (typeof window !== 'undefined') localStorage.setItem('ai_provider', 'deepseek');
                    }}
                    className={`flex-1 py-3 rounded-xl font-black transition-colors ${aiProvider === 'deepseek' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    DeepSeek（国内）
                  </button>
                </div>

                {aiProvider === 'gemini' ? (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">自定义 Gemini API Key</label>
                    <p className="text-xs text-slate-400 font-bold mb-2">在浏览器或手机中独立打开此应用时，请配置您的 API Key。</p>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-emerald-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('user_gemini_api_key', apiKey);
                          }
                          setToast({ message: "API Key 已保存", type: "success" });
                        }}
                        className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300 transition-colors"
                      >
                        保存 API Key
                      </button>
                      <button
                        onClick={() => {
                          setApiKey('');
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('user_gemini_api_key');
                          }
                          setToast({ message: "API Key 已清除", type: "info" });
                        }}
                        className="flex-1 bg-rose-50 text-rose-600 font-black py-3 rounded-xl hover:bg-rose-100 transition-colors"
                      >
                        清除记录
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">DeepSeek API Key</label>
                    <p className="text-xs text-slate-400 font-bold mb-2">在 platform.deepseek.com 申请，格式以 sk- 开头。国内可直连，支持文字与拍照识别。</p>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={deepseekKey}
                      onChange={(e) => setDeepseekKey(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-indigo-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('user_deepseek_api_key', deepseekKey);
                          }
                          setToast({ message: "DeepSeek Key 已保存", type: "success" });
                        }}
                        className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300 transition-colors"
                      >
                        保存 API Key
                      </button>
                      <button
                        onClick={() => {
                          setDeepseekKey('');
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('user_deepseek_api_key');
                          }
                          setToast({ message: "DeepSeek Key 已清除", type: "info" });
                        }}
                        className="flex-1 bg-rose-50 text-rose-600 font-black py-3 rounded-xl hover:bg-rose-100 transition-colors"
                      >
                        清除记录
                      </button>
                    </div>
                  </>
                )}
              </div>

              <motion.button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white py-5 rounded-full font-black text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-8 active:scale-95 transition-transform touch-manipulation"
              >
                保存修改
              </motion.button>
              <p className="text-center text-[11px] text-slate-300 font-bold mt-4">健食 GYMEAT · v1.9</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
