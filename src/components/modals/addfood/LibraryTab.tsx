import { motion } from 'motion/react';
import { Pencil, Trash2, Check } from 'lucide-react';
import type { LibraryFood } from '../../../types';
import { cn } from '../../../lib/utils';
import { SCORE_BADGE_STYLES } from '../../../constants';
import { scoreLibraryFood } from '../../../lib/foodScore';

interface LibraryTabProps {
  library: LibraryFood[];
  fitnessGoal: string;
  selectedLibraryFood: LibraryFood | null;
  setSelectedLibraryFood: (food: LibraryFood | null) => void;
  onEditFood: (food: LibraryFood) => void;
  onRemoveFood: (id: string) => void;
  libraryAmount: string;
  setLibraryAmount: (amount: string) => void;
  onAddFromLibrary: () => void;
  onGoToLibrary: () => void;
}

export function LibraryTab({
  library,
  fitnessGoal,
  selectedLibraryFood,
  setSelectedLibraryFood,
  onEditFood,
  onRemoveFood,
  libraryAmount,
  setLibraryAmount,
  onAddFromLibrary,
  onGoToLibrary,
}: LibraryTabProps) {
  return (
    <div className="space-y-6">
      <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {library.length > 0 ? (
          library.map((food) => (
            <div
              key={food.id}
              onClick={() => setSelectedLibraryFood(food)}
              className={cn(
                "w-full p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between group cursor-pointer",
                selectedLibraryFood?.id === food.id
                  ? "bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-500/10"
                  : "bg-slate-50 border-slate-100 hover:border-emerald-200"
              )}
            >
              <div className="text-left flex-1 pr-2">
                <h4 className="font-black text-slate-900 text-sm sm:text-base line-clamp-1">{food.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">每 100g / {food.caloriesPer100g} kcal</p>
                  {(() => {
                    const s = scoreLibraryFood(food, fitnessGoal);
                    return (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[s.grade]}`} title={s.reason}>
                        {s.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditFood(food);
                  }}
                  className="p-2 text-slate-300 hover:text-emerald-500 transition-colors active:scale-95"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFood(food.id);
                  }}
                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
                {selectedLibraryFood?.id === food.id && (
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white ml-1">
                    <Check size={14} strokeWidth={4} />
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center space-y-4">
            <p className="text-slate-400 font-bold">收藏库还是空的</p>
            <button
              onClick={onGoToLibrary}
              className="text-emerald-600 font-black text-sm hover:underline"
            >
              前往管理食物库
            </button>
          </div>
        )}
      </div>

      {selectedLibraryFood && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pt-4 border-t border-slate-100"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">摄入重量 (克)</label>
            <input
              type="number"
              value={libraryAmount}
              onChange={(e) => setLibraryAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none font-black text-xl"
            />
          </div>
          <motion.button
            onClick={onAddFromLibrary}
            className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] active:scale-95 transition-transform touch-manipulation"
          >
            添加到记录
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
