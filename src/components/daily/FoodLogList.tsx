import type { ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Beef, Coffee, Cookie, History, Moon, Pencil, Search, Sun, Trash2 } from 'lucide-react';
import type { FoodItem, MealType } from '../../types';
import { MACRO_TEXT, MEAL_LABELS, MEAL_TYPES, SCORE_BADGE_STYLES } from '../../constants';
import { scoreLoggedFood } from '../../lib/foodScore';
import { cardVariants } from '../ui/motion';

const MEAL_ICONS: Record<MealType, ReactElement> = {
  breakfast: <Coffee size={18} className="text-amber-500" />,
  lunch: <Sun size={18} className="text-emerald-500" />,
  dinner: <Moon size={18} className="text-violet-500" />,
  snack: <Cookie size={18} className="text-rose-500" />,
};

interface FoodLogListProps {
  foods: FoodItem[];
  fitnessGoal: string;
  onEdit: (food: FoodItem) => void;
  onRemove: (food: FoodItem) => void;
}

function FoodLogItem({ food, fitnessGoal, onEdit, onRemove }: { food: FoodItem } & Omit<FoodLogListProps, 'foods'>) {
  const score = scoreLoggedFood(food, fitnessGoal);
  const macros = [
    { key: 'protein' as const, label: '蛋白质', value: food.protein },
    { key: 'carbs' as const, label: '碳水', value: food.carbs },
    { key: 'fat' as const, label: '脂肪', value: food.fat },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="group bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-[2.5rem] border border-white/50 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all flex flex-col gap-4"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all duration-500 shadow-inner shrink-0">
          <Beef size={24} className="sm:w-[28px] sm:h-[28px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-slate-900 text-base sm:text-lg truncate leading-tight">{food.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md">{food.amount}</span>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md">{food.calories} kcal</span>
            <span className={`text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[score.grade]}`} title={score.reason}>
              {score.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(food)}
            aria-label={`修改 ${food.name}`}
            className="p-2.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => onRemove(food)}
            aria-label={`删除 ${food.name}`}
            className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50">
        {macros.map((m) => (
          <div key={m.key} className="flex flex-col items-center gap-1 border-r border-slate-100 last:border-0">
            <span className={`${MACRO_TEXT[m.key]} font-black text-xs sm:text-sm`}>{m.value.toFixed(1)}g</span>
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-tighter">{m.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 font-medium mt-2 px-1">
        {score.label} · {score.reason}
      </p>
    </motion.div>
  );
}

export function FoodLogList({ foods, fitnessGoal, onEdit, onRemove }: FoodLogListProps) {
  return (
    <motion.section variants={cardVariants} className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900">
          <History size={22} className="text-emerald-500" />
          今日饮食清单
        </h2>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
          {foods.length} 条记录
        </span>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {foods.length > 0 ? (
            MEAL_TYPES.map((mealType) => {
              // 老数据可能没有 mealType，归到加餐
              const mealFoods = foods.filter((f) => (f.mealType ?? 'snack') === mealType);
              if (mealFoods.length === 0) return null;
              return (
                <motion.div
                  key={mealType}
                  layout="position"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 px-2">
                    {MEAL_ICONS[mealType]}
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{MEAL_LABELS[mealType]}</span>
                    <div className="flex-1 h-px bg-slate-100 ml-2" />
                  </div>
                  {mealFoods.map((food) => (
                    <FoodLogItem key={food.id} food={food} fitnessGoal={fitnessGoal} onEdit={onEdit} onRemove={onRemove} />
                  ))}
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="py-20 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center text-slate-200 shadow-sm"
              >
                <Search size={40} />
              </motion.div>
              <div className="space-y-2">
                <p className="text-slate-900 font-black text-xl tracking-tight">清单空空如也</p>
                <p className="text-sm text-slate-400 font-bold">开启你的健康饮食第一步吧</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
