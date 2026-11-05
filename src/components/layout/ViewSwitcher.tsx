import { motion } from 'motion/react';
import { Calendar, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ViewTab = 'daily' | 'stats';

const TABS: { key: ViewTab; label: string; Icon: typeof Calendar }[] = [
  { key: 'daily', label: '今日记录', Icon: Calendar },
  { key: 'stats', label: '趋势分析', Icon: TrendingUp },
];

export function ViewSwitcher({ value, onChange }: { value: ViewTab; onChange: (tab: ViewTab) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
    >
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mx-auto shadow-inner" role="tablist">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={value === key}
            onClick={() => onChange(key)}
            className={cn(
              'px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2',
              value === key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
