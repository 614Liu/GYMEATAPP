import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

interface DateNavProps {
  selectedDate: Date;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNav({ selectedDate, isToday, onPrev, onNext, onToday }: DateNavProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-center gap-4 bg-white p-2.5 rounded-[1.5rem] shadow-sm border border-slate-100 w-fit mx-auto">
        <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-100">
          <button
            onClick={onPrev}
            className="p-1.5 hover:bg-white rounded-md text-slate-400 hover:text-emerald-600 transition-all active:scale-90 shadow-none hover:shadow-sm"
            title="前一天"
            aria-label="前一天"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="px-3 text-center min-w-[100px]">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none mb-0.5">
              {format(selectedDate, 'yyyy年')}
            </p>
            <p className="text-xs font-black text-slate-900 tracking-tight">
              {format(selectedDate, 'MM月dd日')}
            </p>
          </div>
          <button
            onClick={onNext}
            disabled={isToday}
            className={cn(
              'p-1.5 rounded-md transition-all active:scale-90 shadow-none',
              isToday ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:bg-white hover:text-emerald-600 hover:shadow-sm'
            )}
            title="后一天"
            aria-label="后一天"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={onToday}
          disabled={isToday}
          className={cn(
            'px-4 py-2 text-[10px] font-black rounded-lg transition-all shadow-sm active:scale-95',
            isToday
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
              : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100'
          )}
        >
          回到今天
        </button>
      </div>
    </motion.div>
  );
}
