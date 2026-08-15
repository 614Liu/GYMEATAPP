import { motion, AnimatePresence } from 'motion/react';
import type { LibraryFood } from '../../types';
import { getAutoCalories } from '../../lib/nutrition';

interface EditLibraryFoodModalProps {
  editingLibraryFood: LibraryFood | null;
  setEditingLibraryFood: (food: LibraryFood | null) => void;
  onSave: (food: LibraryFood) => void;
}

export function EditLibraryFoodModal({ editingLibraryFood, setEditingLibraryFood, onSave }: EditLibraryFoodModalProps) {
  return (
    <AnimatePresence>
      {editingLibraryFood && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingLibraryFood(null)}
            className="absolute inset-0 bg-slate-900/60"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100"
          >
            <h2 className="text-2xl font-black tracking-tighter text-slate-900 mb-6">修改食物库数据</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="食物名称"
                value={editingLibraryFood.name}
                onChange={(e) => setEditingLibraryFood({...editingLibraryFood, name: e.target.value})}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
              />
              <input
                type="number"
                placeholder="热量 (每100g)"
                value={editingLibraryFood.caloriesPer100g}
                onChange={(e) => setEditingLibraryFood({...editingLibraryFood, caloriesPer100g: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
              />
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="number"
                  placeholder="蛋白"
                  value={editingLibraryFood.proteinPer100g}
                  onChange={(e) => {
                    const newProtein = Number(e.target.value);
                    setEditingLibraryFood({
                      ...editingLibraryFood,
                      proteinPer100g: newProtein,
                      caloriesPer100g: getAutoCalories(newProtein, editingLibraryFood.carbsPer100g, editingLibraryFood.fatPer100g)
                    });
                  }}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                />
                <input
                  type="number"
                  placeholder="碳水"
                  value={editingLibraryFood.carbsPer100g}
                  onChange={(e) => {
                    const newCarbs = Number(e.target.value);
                    setEditingLibraryFood({
                      ...editingLibraryFood,
                      carbsPer100g: newCarbs,
                      caloriesPer100g: getAutoCalories(editingLibraryFood.proteinPer100g, newCarbs, editingLibraryFood.fatPer100g)
                    });
                  }}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                />
                <input
                  type="number"
                  placeholder="脂肪"
                  value={editingLibraryFood.fatPer100g}
                  onChange={(e) => {
                    const newFat = Number(e.target.value);
                    setEditingLibraryFood({
                      ...editingLibraryFood,
                      fatPer100g: newFat,
                      caloriesPer100g: getAutoCalories(editingLibraryFood.proteinPer100g, editingLibraryFood.carbsPer100g, newFat)
                    });
                  }}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                />
              </div>
              <motion.button
                onClick={() => onSave(editingLibraryFood)}
                className="w-full py-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-full font-black shadow-[0_8px_30px_rgba(16,185,129,0.3)] mt-4 active:scale-95 transition-transform touch-manipulation"
              >
                保存修改
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
