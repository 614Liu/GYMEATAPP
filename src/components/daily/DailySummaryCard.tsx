import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Beef, Wheat, Droplets } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { MacroGoals } from '../../types';
import { COLORS, MACRO_LABELS } from '../../constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { MacroStat } from '../ui/MacroStat';
import { cardVariants, chartTooltipStyle } from '../ui/motion';

type Totals = { calories: number; protein: number; carbs: number; fat: number };
type MacroKey = 'protein' | 'carbs' | 'fat';

const GRADIENTS: Record<MacroKey, [string, string, string]> = {
  protein: ['#c084fc', '#a855f7', '#7e22ce'],
  carbs: ['#60a5fa', '#3b82f6', '#1d4ed8'],
  fat: ['#fb923c', '#f97316', '#c2410c'],
};

/** 圆环中间的「剩余热量」 */
function RemainingBadge({ remaining }: { remaining: number }) {
  return (
    <div
      className="w-[130px] h-[130px] rounded-full flex flex-col items-center justify-center relative"
      style={{
        background: 'conic-gradient(from 90deg at 50% 50%, #f8fafc, #e2e8f0, #f8fafc, #e2e8f0, #f8fafc)',
        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.8), 0 10px 20px rgba(0,0,0,0.1), 0 2px 5px rgba(0,0,0,0.05)',
        border: '1px solid rgba(255,255,255,0.6)',
      }}
    >
      <span className="text-4xl font-black tracking-tighter text-slate-800 drop-shadow-sm">
        <AnimatedNumber value={remaining} />
      </span>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剩余热量</span>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">KCAL</span>
      </div>
    </div>
  );
}

export function DailySummaryCard({ totals, goals }: { totals: Totals; goals: MacroGoals }) {
  const percent = goals.calories > 0 ? (totals.calories / goals.calories) * 100 : 0;

  const chartData = useMemo(() => ([
    { name: 'protein' as MacroKey, value: Math.round(totals.protein * 4) },
    { name: 'carbs' as MacroKey, value: Math.round(totals.carbs * 4) },
    { name: 'fat' as MacroKey, value: Math.round(totals.fat * 9) },
  ].filter((d) => d.value > 0)), [totals]);

  return (
    <motion.section
      variants={cardVariants}
      className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />

      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">今日热量摄入</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                {Math.round(percent)}%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-slate-900">
                <AnimatedNumber value={totals.calories} />
              </span>
              <span className="text-slate-300 text-xl font-bold italic">/ {goals.calories}</span>
            </div>
            <div className="mt-4 w-full h-3 bg-slate-200/50 rounded-full overflow-hidden p-0.5 shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percent, 100)}%` }}
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <MacroStat label="蛋白质" current={totals.protein} target={goals.protein} color={COLORS.protein} icon={<Beef size={14} />} />
            <MacroStat label="碳水" current={totals.carbs} target={goals.carbs} color={COLORS.carbs} icon={<Wheat size={14} />} />
            <MacroStat label="脂肪" current={totals.fat} target={goals.fat} color={COLORS.fat} icon={<Droplets size={14} />} />
          </div>
        </div>

        <div className="h-56 relative flex items-center justify-center outline-none">
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%" className="outline-none">
                <PieChart style={{ outline: 'none', border: 'none' }} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    {(Object.keys(GRADIENTS) as MacroKey[]).map((key) => (
                      <linearGradient key={key} id={`grad-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={GRADIENTS[key][0]} />
                        <stop offset="50%" stopColor={GRADIENTS[key][1]} />
                        <stop offset="100%" stopColor={GRADIENTS[key][2]} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={chartData}
                    innerRadius={75}
                    outerRadius={95}
                    paddingAngle={6}
                    dataKey="value"
                    strokeWidth={0}
                    cornerRadius={16}
                    isAnimationActive
                    cx="50%"
                    cy="50%"
                    style={{ outline: 'none', border: 'none', filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.1))' }}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={`url(#grad-${entry.name})`} style={{ outline: 'none', border: 'none' }} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 100 }}
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name) => [
                      `${Math.round(Number(value))} kcal`,
                      MACRO_LABELS[String(name) as MacroKey] ?? String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <RemainingBadge remaining={goals.calories - totals.calories} />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-3">
              <RemainingBadge remaining={goals.calories - totals.calories} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">等待开启今日计划</span>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
