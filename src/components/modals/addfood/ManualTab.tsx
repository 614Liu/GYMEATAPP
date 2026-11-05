import { motion } from 'motion/react';
import type { NewFood } from '../../../types';
import { getAutoCalories } from '../../../lib/nutrition';

/** 手动录入表单的草稿状态（全部按字符串存，提交时再转数字） */
export interface ManualFoodDraft {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  amount: string;
}

interface ManualTabProps {
  manualFood: ManualFoodDraft;
  setManualFood: (food: ManualFoodDraft) => void;
  onAddFood: (food: NewFood) => void;
}

export function ManualTab({ manualFood, setManualFood, onAddFood }: ManualTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">食物名称</label>
        <input
          type="text"
          placeholder="例如：全麦吐司"
          value={manualFood.name}
          onChange={(e) => setManualFood({...manualFood, name: e.target.value})}
          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">热量 (kcal)</label>
          <input
            type="number"
            value={manualFood.calories}
            onChange={(e) => setManualFood({...manualFood, calories: e.target.value})}
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">份量 (如 100g)</label>
          <input
            type="text"
            value={manualFood.amount}
            onChange={(e) => setManualFood({...manualFood, amount: e.target.value})}
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">蛋白质</label>
          <input
            type="number"
            placeholder="克"
            value={manualFood.protein}
            onChange={(e) => {
              const newProtein = e.target.value;
              setManualFood({
                ...manualFood,
                protein: newProtein,
                calories: getAutoCalories(newProtein, manualFood.carbs, manualFood.fat).toString()
              });
            }}
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">碳水</label>
          <input
            type="number"
            placeholder="克"
            value={manualFood.carbs}
            onChange={(e) => {
              const newCarbs = e.target.value;
              setManualFood({
                ...manualFood,
                carbs: newCarbs,
                calories: getAutoCalories(manualFood.protein, newCarbs, manualFood.fat).toString()
              });
            }}
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">脂肪</label>
          <input
            type="number"
            placeholder="克"
            value={manualFood.fat}
            onChange={(e) => {
              const newFat = e.target.value;
              setManualFood({
                ...manualFood,
                fat: newFat,
                calories: getAutoCalories(manualFood.protein, manualFood.carbs, newFat).toString()
              });
            }}
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
          />
        </div>
      </div>
      <motion.button
        disabled={!manualFood.name || !manualFood.calories}
        onClick={() => onAddFood({
          name: manualFood.name,
          calories: Number(manualFood.calories),
          protein: Number(manualFood.protein) || 0,
          carbs: Number(manualFood.carbs) || 0,
          fat: Number(manualFood.fat) || 0,
          amount: manualFood.amount || '1 份'
        })}
        className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-5 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
      >
        添加到记录
      </motion.button>
    </div>
  );
}
