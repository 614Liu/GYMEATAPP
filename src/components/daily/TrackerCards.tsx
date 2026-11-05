import { motion } from 'motion/react';
import { GlassWater, Scale, TrendingUp, Check } from 'lucide-react';
import { WATER_GOAL_ML } from '../../constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { cardVariants } from '../ui/motion';

const cardClass = 'bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 flex flex-col justify-between';

export function WaterCard({ amount, onChange }: { amount: number; onChange: (delta: number) => void }) {
  return (
    <motion.section variants={cardVariants} className={cardClass}>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
              <GlassWater size={16} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-none">饮水量</span>
          </div>
          <TrendingUp size={16} className="text-slate-100" />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">目标 {WATER_GOAL_ML}ml</span>
          {amount >= WATER_GOAL_ML && <Check size={12} className="text-emerald-500" />}
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-black text-slate-900"><AnimatedNumber value={amount} /></span>
        <span className="text-xs font-bold text-slate-300">ml</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(250)}
          className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-black hover:bg-blue-600 transition-all active:scale-95"
        >
          +250ml
        </button>
        <button
          onClick={() => onChange(-250)}
          disabled={amount <= 0}
          aria-label="减少 250ml"
          className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-black hover:bg-slate-100 transition-all disabled:opacity-40"
        >
          -
        </button>
      </div>
    </motion.section>
  );
}

export function WeightCard({ weight, onEdit }: { weight: number | null; onEdit: () => void }) {
  return (
    <motion.section variants={cardVariants} className={cardClass}>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-violet-50 text-violet-500 rounded-lg">
              <Scale size={16} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-none">今日体重</span>
          </div>
          <TrendingUp size={16} className="text-slate-100" />
        </div>
        <div className="px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">追踪变化趋势</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-black text-slate-900">
          {weight ? <AnimatedNumber value={weight} decimals={1} /> : '--'}
        </span>
        <span className="text-xs font-bold text-slate-300">kg</span>
      </div>
      <button
        onClick={onEdit}
        className="w-full py-2 bg-violet-500 text-white rounded-xl text-xs font-black hover:bg-violet-600 transition-all active:scale-95"
      >
        更新体重
      </button>
    </motion.section>
  );
}
