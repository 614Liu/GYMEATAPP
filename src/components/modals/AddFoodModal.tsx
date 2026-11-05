import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, Cookie, Moon, Sun, X } from 'lucide-react';
import type { LibraryFood, MealType, NewFood } from '../../types';
import { MEAL_LABELS, MEAL_TYPES } from '../../constants';
import { cn } from '../../lib/utils';
import { compressImage } from '../../lib/image';
import { newFoodFromPer100g, newId, toPer100g } from '../../lib/nutrition';
import { estimateLogNutrition, parseAiError, type NutritionResult } from '../../lib/gemini';
import type { ToastType } from '../../hooks/useToast';
import { AiTab } from './addfood/AiTab';
import { LibraryTab } from './addfood/LibraryTab';
import { ManualTab, type ManualFoodDraft } from './addfood/ManualTab';

type AddTab = 'ai' | 'library' | 'manual';

const TABS: { key: AddTab; label: string }[] = [
  { key: 'ai', label: 'AI 智能' },
  { key: 'library', label: '收藏库' },
  { key: 'manual', label: '手动录入' },
];

const MEAL_ICONS: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};

const EMPTY_MANUAL: ManualFoodDraft = { name: '', calories: '', protein: '', carbs: '', fat: '', amount: '' };

/** AI 识别两次请求之间至少间隔多久 */
const ESTIMATE_COOLDOWN_MS = 5000;

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: LibraryFood[];
  fitnessGoal: string;
  /** 添加到当前日期；返回 false 表示份量无法换算、没有添加 */
  onAddFood: (food: NewFood, mealType: MealType) => boolean;
  onSaveToLibrary: (food: LibraryFood) => void;
  onEditLibraryFood: (food: LibraryFood) => void;
  onRemoveLibraryFood: (id: string) => void;
  onOpenLibrary: () => void;
  notify: (message: string, type?: ToastType) => void;
}

/**
 * 添加食物弹窗。表单草稿都留在这个组件里：在里面打字只重渲染弹窗，不会牵动整个首页。
 * 组件本身一直挂载，关掉再打开时草稿还在（和旧版行为一致），添加成功后才清空。
 */
export function AddFoodModal({
  isOpen, onClose, library, fitnessGoal,
  onAddFood, onSaveToLibrary, onEditLibraryFood, onRemoveLibraryFood, onOpenLibrary, notify,
}: AddFoodModalProps) {
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [tab, setTab] = useState<AddTab>('ai');

  // AI 识别
  const [aiQuery, setAiQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<NutritionResult | null>(null);
  const [portionMult, setPortionMult] = useState(1);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastEstimateAt = useRef(0);

  // 手动录入 / 收藏库
  const [manualFood, setManualFood] = useState<ManualFoodDraft>(EMPTY_MANUAL);
  const [selectedLibraryFood, setSelectedLibraryFood] = useState<LibraryFood | null>(null);
  const [libraryAmount, setLibraryAmount] = useState('100');

  // 选中的食物被删掉（或被别的设备删掉）时取消选中，避免用已删除的条目添加
  useEffect(() => {
    if (selectedLibraryFood && !library.some((f) => f.id === selectedLibraryFood.id)) {
      setSelectedLibraryFood(null);
    }
  }, [library, selectedLibraryFood]);

  const resetDrafts = () => {
    setEstimate(null);
    setAiQuery('');
    setSelectedImage(null);
    setAiError(null);
    setPortionMult(1);
    setManualFood(EMPTY_MANUAL);
    setSelectedLibraryFood(null);
    setLibraryAmount('100');
  };

  const add = (food: NewFood) => {
    if (!onAddFood(food, mealType)) {
      notify('份量需要大于 0，请修改后再添加', 'error');
      return;
    }
    notify(`已添加 ${food.name}`, 'success');
    resetDrafts();
    onClose();
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ''; // 允许再次选同一张图
    if (!file) return;
    try {
      setSelectedImage(await compressImage(file));
    } catch (err) {
      console.error('Failed to compress image', err);
      notify('图片处理失败，请重试', 'error');
    }
  };

  const handleEstimate = async () => {
    if (!aiQuery.trim() && !selectedImage) return;
    const now = Date.now();
    if (now - lastEstimateAt.current < ESTIMATE_COOLDOWN_MS) {
      setAiError('识别太快了，请稍等几秒再试');
      return;
    }
    lastEstimateAt.current = now;
    setIsEstimating(true);
    setAiError(null);
    try {
      const result = await estimateLogNutrition(aiQuery, selectedImage || undefined);
      if (!result.isFood) {
        setAiError(result.reason || '未能识别出食物，请换张图片或重新描述');
        return;
      }
      setEstimate(result);
      setPortionMult(1);
    } catch (err) {
      console.error('AI Estimation failed:', err);
      setAiError(parseAiError(err));
    } finally {
      setIsEstimating(false);
    }
  };

  /**
   * AI 识别结果「存入库中」。识别返回的是这一份的总营养，食物库存的是每 100g：
   * 份量是克时按比例换算；「1个中等大小」这类没有克重的份量无法换算，原样存下并提示核对。
   */
  const handleSaveEstimateToLibrary = (result: NutritionResult) => {
    const per100 = toPer100g(result);
    const food: LibraryFood = {
      id: newId(),
      name: result.name || '未命名食物',
      caloriesPer100g: per100.calories,
      proteinPer100g: per100.protein,
      carbsPer100g: per100.carbs,
      fatPer100g: per100.fat,
      createdAt: Date.now(),
    };
    onSaveToLibrary(food);
    notify(
      per100.converted
        ? `已保存 ${food.name} 到食物库`
        : `已保存 ${food.name}，但「${result.amount}」无法换算成每 100g，请核对`,
      per100.converted ? 'success' : 'info'
    );
    onClose();
    onOpenLibrary();
  };

  const handleAddFromLibrary = () => {
    if (!selectedLibraryFood) return;
    const grams = Number(libraryAmount);
    if (!Number.isFinite(grams) || grams <= 0) {
      notify('请输入大于 0 的克数', 'error');
      return;
    }
    add(newFoodFromPer100g(selectedLibraryFood, grams));
  };

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
            aria-label="记录美食"
            className="relative w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85dvh]"
          >
            <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-2xl font-black tracking-tighter text-slate-900">记录美食</h2>
              <button onClick={onClose} aria-label="关闭" className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">选择用餐时段</label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map((type) => {
                    const Icon = MEAL_ICONS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setMealType(type)}
                        aria-pressed={mealType === type}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all',
                          mealType === type
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm'
                            : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-200'
                        )}
                      >
                        <Icon size={16} />
                        <span className="text-[10px] font-black">{MEAL_LABELS[type]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex p-1.5 bg-slate-100 rounded-[1.5rem] shadow-inner" role="tablist">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'flex-1 py-3 text-sm font-black rounded-[1.2rem] transition-all',
                      tab === key ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'ai' ? (
                <AiTab
                  selectedImage={selectedImage}
                  setSelectedImage={setSelectedImage}
                  aiQuery={aiQuery}
                  setAiQuery={setAiQuery}
                  onImageChange={handleImageChange}
                  onEstimate={handleEstimate}
                  isEstimating={isEstimating}
                  error={aiError}
                  estimatedResult={estimate}
                  portionMult={portionMult}
                  setPortionMult={setPortionMult}
                  fitnessGoal={fitnessGoal}
                  onAddFood={add}
                  onSaveToLibrary={handleSaveEstimateToLibrary}
                />
              ) : tab === 'library' ? (
                <LibraryTab
                  library={library}
                  fitnessGoal={fitnessGoal}
                  selectedLibraryFood={selectedLibraryFood}
                  setSelectedLibraryFood={setSelectedLibraryFood}
                  onEditFood={onEditLibraryFood}
                  onRemoveFood={onRemoveLibraryFood}
                  libraryAmount={libraryAmount}
                  setLibraryAmount={setLibraryAmount}
                  onAddFromLibrary={handleAddFromLibrary}
                  onGoToLibrary={() => { onClose(); onOpenLibrary(); }}
                />
              ) : (
                <ManualTab manualFood={manualFood} setManualFood={setManualFood} onAddFood={add} />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
