import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { AnimatedNumber } from './AnimatedNumber';

export function MacroStat({ label, current, target, color, icon }: { label: string, current: number, target: number, color: string, icon: ReactNode }) {
  const percentage = Math.min((current / target) * 100, 100);
  const diff = current - target;

  return (
    <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-3 sm:p-4 rounded-[1.5rem] border border-white/50 shadow-[0_4px_15px_rgb(0,0,0,0.02)] gap-4">
      <div className="flex items-center gap-2 w-20 shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <span className="text-xs font-black text-slate-600 whitespace-nowrap">{label}</span>
      </div>

      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="flex flex-col items-start shrink-0 w-20 sm:w-24">
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-black text-slate-900 tabular-nums"><AnimatedNumber value={current} /></span>
          <span className="text-[10px] text-slate-400 font-bold tabular-nums">/{target}g</span>
        </div>
        <span className={cn("text-[9px] font-bold tracking-wider", diff > 0 ? "text-rose-400" : "text-slate-400")}>
          {diff > 0 ? `超 ${Math.round(diff)}g` : `差 ${Math.round(-diff)}g`}
        </span>
      </div>
    </div>
  );
}
