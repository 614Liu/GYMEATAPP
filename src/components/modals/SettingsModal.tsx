import { useEffect, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { MacroGoals } from '../../types';
import { FITNESS_GOAL_OPTIONS } from '../../constants';
import { STORAGE_KEYS, readString, writeString, removeKey } from '../../lib/storage';
import type { ToastType } from '../../hooks/useToast';

type AiProvider = 'gemini' | 'deepseek';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: MacroGoals;
  /** 返回 false 表示目标不合理、没有保存 */
  onSaveGoals: (goals: MacroGoals) => boolean;
  fitnessGoal: string;
  onSaveFitnessGoal: (goal: string) => void;
  /** 导出备份文件 */
  onExport: () => Promise<void>;
  /** 导入备份文件，返回新增了多少条记录 */
  onImport: (file: File) => Promise<number>;
  notify: (message: string, type?: ToastType) => void;
}

/** 输入框里的值按字符串存，允许暂时清空；保存时再转数字 */
type GoalDraft = { protein: string; carbs: string; fat: string };

const toDraft = (g: MacroGoals): GoalDraft => ({ protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat) });

function draftToGoals(d: GoalDraft): MacroGoals | null {
  if ([d.protein, d.carbs, d.fat].some((v) => v.trim() === '')) return null;
  const protein = Number(d.protein);
  const carbs = Number(d.carbs);
  const fat = Number(d.fat);
  if (![protein, carbs, fat].every((n) => Number.isFinite(n) && n >= 0)) return null;
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
  return calories > 0 ? { protein, carbs, fat, calories } : null;
}

const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1';

/**
 * 设置。所有修改先存在草稿里，点「保存修改」才生效；点叉或点背景关闭则放弃修改。
 * 以前目标每敲一个字就写一次云端，API Key 只有点小按钮才保存、点底部大按钮反而会丢。
 */
export function SettingsModal({ isOpen, onClose, goals, onSaveGoals, fitnessGoal, onSaveFitnessGoal, onExport, onImport, notify }: SettingsModalProps) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const runExport = async () => {
    setBusy('export');
    try {
      await onExport();
    } catch (err) {
      console.error('Export failed:', err);
      notify('导出失败，请检查网络后重试', 'error');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy('import');
    try {
      const added = await onImport(file);
      notify(added > 0 ? `已导入 ${added} 条记录，目标已恢复` : '没有新记录需要导入，目标已恢复', 'success');
      onClose(); // 目标已按备份恢复，关掉弹窗，免得草稿里的旧目标被再次保存
    } catch (err) {
      console.error('Import failed:', err);
      notify(err instanceof Error && err.message ? err.message : '导入失败，请重试', 'error');
    } finally {
      setBusy(null);
    }
  };

  const [goalDraft, setGoalDraft] = useState<GoalDraft>(() => toDraft(goals));
  const [goalChoice, setGoalChoice] = useState(fitnessGoal);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');

  // 每次打开时从当前值重新填草稿
  useEffect(() => {
    if (!isOpen) return;
    setGoalDraft(toDraft(goals));
    setGoalChoice(fitnessGoal);
    setProvider(readString(STORAGE_KEYS.aiProvider) === 'deepseek' ? 'deepseek' : 'gemini');
    setGeminiKey(readString(STORAGE_KEYS.geminiKey) || '');
    setDeepseekKey(readString(STORAGE_KEYS.deepseekKey) || '');
    // 只在打开的那一刻取值，打开期间云端目标变化不覆盖用户正在改的草稿，所以依赖里故意只有 isOpen
  }, [isOpen]);

  const draftGoals = draftToGoals(goalDraft);
  const previewCalories = draftGoals?.calories ?? 0;

  const saveKey = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) writeString(key, trimmed);
    else removeKey(key);
  };

  const handleSave = () => {
    if (!draftGoals || !onSaveGoals(draftGoals)) {
      notify('目标数值不合理，请检查蛋白质、碳水、脂肪', 'error');
      return;
    }
    onSaveFitnessGoal(goalChoice);
    writeString(STORAGE_KEYS.aiProvider, provider);
    saveKey(STORAGE_KEYS.geminiKey, geminiKey);
    saveKey(STORAGE_KEYS.deepseekKey, deepseekKey);
    notify('设置已保存', 'success');
    onClose();
  };

  const macroInputs: { key: keyof GoalDraft; label: string; focus: string }[] = [
    { key: 'protein', label: '蛋白质 (g)', focus: 'focus:ring-purple-500/10 focus:border-purple-500' },
    { key: 'carbs', label: '碳水 (g)', focus: 'focus:ring-blue-500/10 focus:border-blue-500' },
    { key: 'fat', label: '脂肪 (g)', focus: 'focus:ring-orange-500/10 focus:border-orange-500' },
  ];

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
            role="dialog"
            aria-modal="true"
            aria-label="目标设定"
            className="relative w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85dvh]"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-3xl font-black tracking-tighter text-slate-900">目标设定</h2>
              <button onClick={onClose} aria-label="关闭，不保存" className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className={`${labelClass} block`}>我的目标（影响 AI 教练建议）</label>
                <div className="grid grid-cols-3 gap-2">
                  {FITNESS_GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setGoalChoice(opt.key)}
                      aria-pressed={goalChoice === opt.key}
                      className={`py-3 rounded-2xl font-black transition-colors ${goalChoice === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className={`${labelClass} flex justify-between items-center`}>
                  <span>每日热量目标 (kcal)</span>
                  <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full normal-case tracking-normal">自动计算</span>
                </label>
                <input
                  type="number"
                  value={previewCalories}
                  readOnly
                  aria-label="每日热量目标，由三大营养素自动计算"
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-2xl text-emerald-600 opacity-80 cursor-not-allowed"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {macroInputs.map(({ key, label, focus }) => (
                  <div key={key} className="space-y-3">
                    <label className={labelClass}>{label}</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={goalDraft[key]}
                      onChange={(e) => setGoalDraft({ ...goalDraft, [key]: e.target.value })}
                      className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 ${focus} outline-none font-black text-center`}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100">
                <label className={`${labelClass} block`}>AI 识别引擎</label>
                <p className="text-xs text-slate-400 font-bold mb-2">国内网络无法访问 Gemini，请切换到 DeepSeek。</p>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setProvider('gemini')}
                    aria-pressed={provider === 'gemini'}
                    className={`flex-1 py-3 rounded-xl font-black transition-colors ${provider === 'gemini' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Gemini
                  </button>
                  <button
                    onClick={() => setProvider('deepseek')}
                    aria-pressed={provider === 'deepseek'}
                    className={`flex-1 py-3 rounded-xl font-black transition-colors ${provider === 'deepseek' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    DeepSeek（国内）
                  </button>
                </div>

                {provider === 'gemini' ? (
                  <>
                    <label className={`${labelClass} block`}>自定义 Gemini API Key</label>
                    <p className="text-xs text-slate-400 font-bold mb-2">在浏览器或手机中独立打开此应用时，请配置您的 API Key。留空则使用服务器默认通道。</p>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      autoComplete="off"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-emerald-500"
                    />
                  </>
                ) : (
                  <>
                    <label className={`${labelClass} block`}>DeepSeek API Key</label>
                    <p className="text-xs text-slate-400 font-bold mb-2">在 platform.deepseek.com 申请，格式以 sk- 开头。国内可直连，支持文字与拍照识别。</p>
                    <input
                      type="password"
                      placeholder="sk-..."
                      autoComplete="off"
                      value={deepseekKey}
                      onChange={(e) => setDeepseekKey(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-indigo-500"
                    />
                  </>
                )}
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100">
                <label className={`${labelClass} block`}>数据备份</label>
                <p className="text-xs text-slate-400 font-bold mb-2">
                  导出全部记录、食物库、体重和目标为一个文件。换手机或重装后导入即可恢复，已有的记录不会被覆盖。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={runExport}
                    disabled={busy !== null}
                    className="flex-1 py-3 rounded-xl font-black bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {busy === 'export' ? '正在导出…' : '导出数据'}
                  </button>
                  <label
                    className={`flex-1 py-3 rounded-xl font-black text-center bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors ${busy !== null ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                  >
                    {busy === 'import' ? '正在导入…' : '导入数据'}
                    <input type="file" accept="application/json,.json" className="hidden" onChange={runImport} disabled={busy !== null} />
                  </label>
                </div>
              </div>

              <motion.button
                onClick={handleSave}
                disabled={!draftGoals}
                className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white py-5 rounded-full font-black text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-8 active:scale-95 transition-transform touch-manipulation disabled:opacity-50"
              >
                保存修改
              </motion.button>
              <p className="text-center text-[11px] text-slate-300 font-bold mt-4">健食 GYMEAT · v1.11</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
