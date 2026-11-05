import type { KeyboardEvent } from 'react';
import type { Variants } from 'motion/react';

/** 页面容器：子元素依次入场 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

/** 卡片入场：上移淡入 */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

/** 图表 Tooltip 的统一样式 */
export const chartTooltipStyle = {
  borderRadius: '20px',
  border: '1px solid rgba(255,255,255,0.5)',
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  padding: '12px 16px',
  outline: 'none',
} as const;

/** 输入法正在选字时的回车不算提交（中文拼音输入时按回车是确认候选词） */
export function isSubmitEnter(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229;
}
