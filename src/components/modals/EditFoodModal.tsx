import { motion, AnimatePresence } from 'motion/react';
import type { FoodItem } from '../../types';

interface EditFoodModalProps {
  editingFood: FoodItem | null;
  setEditingFood: (food: FoodItem | null) => void;
  onSave: (food: FoodItem) => void;
}

/**
 * 归一化出换算基准。
 *
 * baseNutrition 的约定（见 App.tsx 的 handleAddFood）：克类食物存「每 100g」的值，
 * 件类食物存「每 1 份」的值。老数据可能没有 baseNutrition，这里按当前份量反推补齐，
 * 让两条路径的语义一致，后面就能用同一个换算式。
 */
function getBase(food: FoodItem) {
  if (food.baseNutrition) {
    return { base: food.baseNutrition, isGram: food.baseNutrition.unit === 'g' };
  }

  const isGram = food.amount.toLowerCase().includes('g') || food.amount.includes('克');
  // 当前值对应的是 amountValue 份 / 克，先除回单位量再放大到基准量
  const per = food.amountValue || (isGram ? 100 : 1);
  const scale = (isGram ? 100 : 1) / per;

  return {
    isGram,
    base: {
      calories: food.calories * scale,
      protein: food.protein * scale,
      carbs: food.carbs * scale,
      fat: food.fat * scale,
      unit: (isGram ? 'g' : 'unit') as 'g' | 'unit',
    },
  };
}

/** 从 "1 份" / "2个" 这类份量串里取出单位名，取不到就用「份」 */
function getUnitLabel(amount: string) {
  const label = amount.replace(/[\d.]+/g, '').trim();
  return label || '份';
}

function EditFoodForm({ editingFood, setEditingFood, onSave }: EditFoodModalProps & { editingFood: FoodItem }) {
  const { base, isGram } = getBase(editingFood);
  const unitLabel = getUnitLabel(editingFood.amount);

  return (
    <>
      <h2 className="text-2xl font-black tracking-tighter text-slate-900 mb-6">修改摄入量</h2>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">食物名称</label>
          <p className="text-lg font-black text-slate-900">{editingFood.name}</p>
        </div>
        <div>
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
            {isGram ? '修改克数 (g)' : `修改份量（${unitLabel}）`}
          </label>
          <input
            type="number"
            value={editingFood.amountValue || ''}
            onChange={(e) => {
              const val = Number(e.target.value);

              // 除数是固定的基准量（100g 或 1 份），不能用会随编辑漂移的 amountValue
              const ratio = isGram ? (val / 100) : val;

              setEditingFood({
                ...editingFood,
                amountValue: val,
                amount: isGram ? `${val}g` : `${val} ${unitLabel}`,
                calories: Math.round(base.calories * ratio),
                protein: Number((base.protein * ratio).toFixed(1)),
                carbs: Number((base.carbs * ratio).toFixed(1)),
                fat: Number((base.fat * ratio).toFixed(1)),
                baseNutrition: base
              });
            }}
            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-black text-xl"
          />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400">热量</p>
            <p className="font-black text-emerald-600">{editingFood.calories}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400">蛋白</p>
            <p className="font-black text-blue-500">{editingFood.protein}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400">碳水</p>
            <p className="font-black text-violet-500">{editingFood.carbs}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400">脂肪</p>
            <p className="font-black text-amber-500">{editingFood.fat}</p>
          </div>
        </div>
        <motion.button
          onClick={() => onSave(editingFood)}
          className="w-full py-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-full font-black shadow-[0_8px_30px_rgba(16,185,129,0.3)] active:scale-95 transition-transform touch-manipulation"
        >
          保存修改
        </motion.button>
      </div>
    </>
  );
}

export function EditFoodModal({ editingFood, setEditingFood, onSave }: EditFoodModalProps) {
  return (
    <AnimatePresence>
      {editingFood && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingFood(null)}
            className="absolute inset-0 bg-slate-900/60"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto custom-scrollbar"
          >
            <EditFoodForm editingFood={editingFood} setEditingFood={setEditingFood} onSave={onSave} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
