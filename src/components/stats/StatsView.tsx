import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Scale, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyLog, WeightLog } from '../../types';
import { parseLocalDate } from '../../lib/utils';
import { CustomCursor, CustomActiveDot } from '../ui/ChartHelpers';
import { cardVariants, chartTooltipStyle, isSubmitEnter, staggerContainer } from '../ui/motion';

interface StatsViewProps {
  logs: DailyLog[];
  weightLogs: WeightLog[];
  /** 返回是否保存成功（数值不合理时不保存） */
  onSaveWeight: (weight: number) => boolean;
}

const axisTick = { fontSize: 10, fontWeight: 700, fill: '#94a3b8' };
const cardClass = 'bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50';

export function StatsView({ logs, weightLogs, onSaveWeight }: StatsViewProps) {
  const [weightDraft, setWeightDraft] = useState('');

  const weightChartData = useMemo(() => (
    [...weightLogs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((l) => ({ date: format(parseLocalDate(l.date), 'MM/dd'), weight: l.weight }))
  ), [weightLogs]);

  const calorieHistory = useMemo(() => {
    const byDate = new Map(logs.map((l) => [l.date, l]));
    return Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')).map((date) => {
      const foods = byDate.get(date)?.foods ?? [];
      return {
        date: format(parseLocalDate(date), 'MM/dd'),
        calories: Math.round(foods.reduce((sum, f) => sum + (f.calories || 0), 0)),
      };
    });
  }, [logs]);

  const submitWeight = () => {
    if (onSaveWeight(Number(weightDraft))) setWeightDraft('');
  };

  return (
    <motion.div key="stats" initial="hidden" animate="visible" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.section variants={cardVariants} className={cardClass}>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900">
            <Scale size={22} className="text-blue-500" />
            体重变化趋势
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="录入体重"
              aria-label="录入体重"
              value={weightDraft}
              onChange={(e) => setWeightDraft(e.target.value)}
              onKeyDown={(e) => { if (isSubmitEnter(e)) submitWeight(); }}
              className="w-24 p-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            />
            <span className="text-xs font-black text-slate-400">kg</span>
          </div>
        </div>
        <div className="h-64 w-full">
          {weightChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisTick} dy={10} />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  cursor={<CustomCursor stroke="#3b82f6" />}
                  isAnimationActive
                  animationDuration={300}
                  animationEasing="ease-out"
                  contentStyle={chartTooltipStyle}
                  labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}
                  itemStyle={{ fontWeight: 700, color: '#3b82f6' }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  name="体重"
                  stroke="#3b82f6"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorWeight)"
                  activeDot={<CustomActiveDot fill="#3b82f6" shadowColor="rgba(59,130,246,0.5)" />}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 italic text-sm font-bold">
              需要至少两天的体重数据来生成图表
            </div>
          )}
        </div>
      </motion.section>

      <motion.section variants={cardVariants} className={cardClass}>
        <h3 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900 mb-8">
          <TrendingUp size={22} className="text-emerald-500" />
          近 7 日热量摄入
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={calorieHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisTick} dy={10} />
              <YAxis hide />
              <Tooltip
                cursor={<CustomCursor stroke="#10b981" />}
                isAnimationActive
                animationDuration={300}
                animationEasing="ease-out"
                contentStyle={chartTooltipStyle}
                labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}
                itemStyle={{ fontWeight: 700, color: '#10b981' }}
              />
              <Area
                type="monotone"
                dataKey="calories"
                name="热量"
                stroke="#10b981"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorCalories)"
                activeDot={<CustomActiveDot fill="#10b981" shadowColor="rgba(16,185,129,0.5)" />}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.section>
    </motion.div>
  );
}
