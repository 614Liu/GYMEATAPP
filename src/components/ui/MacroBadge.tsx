import { cn } from '../../lib/utils';

export function MacroBadge({ label, value, color }: { label: string, value: number, color: 'purple' | 'blue' | 'orange' }) {
  const colors = {
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };
  return (
    <div className={cn("p-3 rounded-2xl border-2 text-center transition-all hover:scale-105", colors[color])}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
      <div className="text-lg font-black tracking-tighter">{value}g</div>
    </div>
  );
}
