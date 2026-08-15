import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Camera, Image as ImageIcon, Loader2, History, Pencil, Trash2, Leaf } from 'lucide-react';
import type { LibraryFood } from '../../types';
import { SCORE_BADGE_STYLES } from '../../constants';
import { scoreLibraryFood } from '../../lib/foodScore';
import { getAutoCalories } from '../../lib/nutrition';

/** 新增常用食物表单的草稿状态（全部按字符串存，提交时再转数字） */
export interface LibraryEntryDraft {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  amount: string;
}

interface FoodLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryEntry: LibraryEntryDraft;
  setLibraryEntry: (entry: LibraryEntryDraft) => void;
  error: string | null;
  isEstimating: boolean;
  onImageSelect: (file: File) => void;
  onAddToLibrary: () => void;
  library: LibraryFood[];
  fitnessGoal: string;
  onEditFood: (food: LibraryFood) => void;
  onRemoveFood: (id: string) => void;
}

export function FoodLibraryModal({
  isOpen,
  onClose,
  libraryEntry,
  setLibraryEntry,
  error,
  isEstimating,
  onImageSelect,
  onAddToLibrary,
  library,
  fitnessGoal,
  onEditFood,
  onRemoveFood,
}: FoodLibraryModalProps) {
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
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              mass: 0.8
            }}
            className="relative w-full max-w-2xl bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-100"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-3xl font-black tracking-tighter text-slate-900">专属食物库</h2>
              <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* Add to Library Form */}
              <section className="space-y-6">
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2 shrink-0">
                    <Plus size={20} className="text-emerald-500" />
                    新增常用食物 <span className="text-slate-400 text-xs font-bold">(每 100g)</span>
                  </h3>
                  <div className="flex gap-3 w-full">
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all text-sm font-black whitespace-nowrap">
                      <ImageIcon size={18} />
                      相册识别
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImageSelect(file);
                      }} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all text-sm font-black whitespace-nowrap">
                      <Camera size={18} />
                      拍照识别
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImageSelect(file);
                      }} />
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl flex items-center gap-3 border border-rose-100">
                    <X size={18} />
                    {error}
                  </div>
                )}

                {isEstimating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-emerald-600 font-black border border-emerald-100/50 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm relative">
                      <Loader2 size={24} className="animate-spin text-emerald-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                    </div>
                    <span className="tracking-widest">AI 正在努力识别中...</span>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="食物名称 (如：乳清蛋白粉)"
                    value={libraryEntry.name}
                    onChange={(e) => setLibraryEntry({...libraryEntry, name: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold sm:col-span-1"
                  />
                  <input
                    type="number"
                    placeholder="热量 (kcal)"
                    value={libraryEntry.calories}
                    onChange={(e) => setLibraryEntry({...libraryEntry, calories: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="份量"
                      value={libraryEntry.amount}
                      onChange={(e) => setLibraryEntry({...libraryEntry, amount: e.target.value})}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">g</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <input
                    type="number"
                    placeholder="蛋白(g)"
                    value={libraryEntry.protein}
                    onChange={(e) => {
                      const newProtein = e.target.value;
                      setLibraryEntry({
                        ...libraryEntry,
                        protein: newProtein,
                        calories: getAutoCalories(newProtein, libraryEntry.carbs, libraryEntry.fat).toString()
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold text-sm sm:text-base"
                  />
                  <input
                    type="number"
                    placeholder="碳水(g)"
                    value={libraryEntry.carbs}
                    onChange={(e) => {
                      const newCarbs = e.target.value;
                      setLibraryEntry({
                        ...libraryEntry,
                        carbs: newCarbs,
                        calories: getAutoCalories(libraryEntry.protein, newCarbs, libraryEntry.fat).toString()
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold text-sm sm:text-base"
                  />
                  <input
                    type="number"
                    placeholder="脂肪(g)"
                    value={libraryEntry.fat}
                    onChange={(e) => {
                      const newFat = e.target.value;
                      setLibraryEntry({
                        ...libraryEntry,
                        fat: newFat,
                        calories: getAutoCalories(libraryEntry.protein, libraryEntry.carbs, newFat).toString()
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
                <motion.button
                  onClick={onAddToLibrary}
                  disabled={!libraryEntry.name || !libraryEntry.calories}
                  className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
                >
                  存入库中
                </motion.button>
              </section>

              {/* Library List */}
              <section className="space-y-6">
                <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <History size={20} className="text-emerald-500" />
                  已保存的食物
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {library.length > 0 ? (
                    library.map((food) => (
                      <div key={food.id} className="p-4 sm:p-5 bg-white/60 backdrop-blur-md rounded-[2rem] border border-white/50 flex items-center justify-between group transition-all shadow-[0_4px_15px_rgb(0,0,0,0.02)]">
                        <div className="flex-1 pr-2">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base line-clamp-1">{food.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                              {food.caloriesPer100g} kcal / 100g
                            </p>
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
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onEditFood(food)}
                            className="p-2 text-slate-300 hover:text-emerald-500 transition-colors active:scale-95"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => onRemoveFood(food.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors active:scale-95"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center space-y-4 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                      <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-slate-200 shadow-sm">
                        <Leaf size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-900 font-black text-base tracking-tight">食物库空空如也</p>
                        <p className="text-xs text-slate-400 font-bold">将常用食物存入库中，方便快速添加</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
