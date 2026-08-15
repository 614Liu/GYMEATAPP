import React from 'react';
import { motion } from 'motion/react';
import { X, Camera, Image as ImageIcon, Loader2, ChevronRight, Check, Plus } from 'lucide-react';
import type { FoodItem } from '../../../types';
import type { NutritionResult } from '../../../lib/gemini';
import { SCORE_BADGE_STYLES } from '../../../constants';
import { scoreFood } from '../../../lib/foodScore';
import { MacroBadge } from '../../ui/MacroBadge';

type NewFood = Omit<FoodItem, 'id' | 'timestamp' | 'mealType' | 'amountValue' | 'baseNutrition'>;

interface AiTabProps {
  selectedImage: string | null;
  setSelectedImage: (img: string | null) => void;
  aiQuery: string;
  setAiQuery: (q: string) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEstimate: () => void;
  isEstimating: boolean;
  error: string | null;
  estimatedResult: NutritionResult | null;
  portionMult: number;
  setPortionMult: (m: number) => void;
  fitnessGoal: string;
  onAddFood: (food: NewFood) => void;
  onSaveToLibrary: (result: NutritionResult) => void;
}

export function AiTab({
  selectedImage,
  setSelectedImage,
  aiQuery,
  setAiQuery,
  onImageChange,
  onEstimate,
  isEstimating,
  error,
  estimatedResult,
  portionMult,
  setPortionMult,
  fitnessGoal,
  onAddFood,
  onSaveToLibrary,
}: AiTabProps) {
  return (
    <div className="space-y-6">
      <div className="relative group">
        {selectedImage ? (
          <div className="relative w-full aspect-video rounded-[2rem] overflow-hidden border-2 border-emerald-100 mb-4">
            <img src={selectedImage} alt="Selected food" className="w-full h-full object-cover" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-4 mb-4">
            <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all group/upload">
              <ImageIcon size={32} className="text-slate-300 group-hover/upload:text-emerald-500 transition-colors" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">选择照片</span>
              <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
            </label>
            <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all group/camera">
              <Camera size={32} className="text-slate-300 group-hover/camera:text-emerald-500 transition-colors" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">拍照识别</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onImageChange} />
            </label>
          </div>
        )}

        <textarea
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          placeholder={selectedImage ? "补充描述（可选）" : "例如：200克煎鸡胸肉和一碗糙米饭"}
          className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none text-base font-medium placeholder:text-slate-300"
        />
        <motion.button
          disabled={isEstimating || (!aiQuery.trim() && !selectedImage)}
          onClick={onEstimate}
          className="absolute bottom-6 right-6 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white p-4 rounded-full shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
        >
          {isEstimating ? <Loader2 size={24} className="animate-spin" /> : <ChevronRight size={24} />}
        </motion.button>
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

      {estimatedResult && !isEstimating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-emerald-50/50 rounded-[2rem] border-2 border-emerald-100 space-y-6"
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-black text-emerald-900 text-xl tracking-tight">{estimatedResult.name || "未命名食物"}</h4>
              <p className="text-xs text-emerald-600 font-black uppercase tracking-widest mt-1">{estimatedResult.amount || "未知份量"}{portionMult !== 1 ? ` ×${portionMult}` : ''}</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-emerald-900 tracking-tighter">{Math.round((estimatedResult.calories || 0) * portionMult)}</span>
              <span className="text-xs font-black text-emerald-600 uppercase ml-1">kcal</span>
            </div>
          </div>

          {/* 份量微调 */}
          <div className="bg-white/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">份量微调</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={portionMult}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v) && v > 0) setPortionMult(v);
                  }}
                  className="w-16 px-2 py-1 bg-emerald-50 border-2 border-emerald-100 rounded-lg text-center font-black text-emerald-900 outline-none focus:border-emerald-400"
                />
                <span className="text-sm font-black text-emerald-700">倍</span>
              </div>
            </div>
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={Math.min(Math.max(portionMult, 0.25), 3)}
              onChange={(e) => setPortionMult(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2].map((m) => (
                <button
                  key={m}
                  onClick={() => setPortionMult(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-colors ${portionMult === m ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  ×{m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MacroBadge label="蛋白质" value={Number(((estimatedResult.protein || 0) * portionMult).toFixed(1))} color="purple" />
            <MacroBadge label="碳水" value={Number(((estimatedResult.carbs || 0) * portionMult).toFixed(1))} color="blue" />
            <MacroBadge label="脂肪" value={Number(((estimatedResult.fat || 0) * portionMult).toFixed(1))} color="orange" />
          </div>
          {(() => {
            const s = scoreFood({
              calories: estimatedResult.calories || 0,
              protein: estimatedResult.protein || 0,
              carbs: estimatedResult.carbs || 0,
              fat: estimatedResult.fat || 0,
            }, fitnessGoal);
            return (
              <div className="flex items-center gap-2 px-1">
                <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${SCORE_BADGE_STYLES[s.grade]}`}>
                  {s.label}
                </span>
                <span className="text-xs text-emerald-700/70 font-medium">{s.reason}</span>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => onAddFood({
                ...estimatedResult,
                calories: Math.round((estimatedResult.calories || 0) * portionMult),
                protein: Number(((estimatedResult.protein || 0) * portionMult).toFixed(1)),
                carbs: Number(((estimatedResult.carbs || 0) * portionMult).toFixed(1)),
                fat: Number(((estimatedResult.fat || 0) * portionMult).toFixed(1)),
              } as NewFood)}
              className="flex-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-sm shadow-[0_8px_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation"
            >
              <Check size={20} />
              记录今日
            </motion.button>
            <button
              onClick={() => onSaveToLibrary(estimatedResult)}
              className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all hover:-translate-y-1"
            >
              <Plus size={20} />
              存入库中
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
