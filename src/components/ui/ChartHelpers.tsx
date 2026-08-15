import { motion } from 'motion/react';

export const CustomCursor = (props: any) => {
  const { points, height, stroke = '#10b981' } = props;
  if (!points || points.length === 0) return null;
  const { x } = points[0];
  return (
    <motion.line
      animate={{ x1: x, x2: x, y1: 0, y2: height }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray="4 4"
      strokeOpacity={0.5}
    />
  );
};

export const CustomActiveDot = (props: any) => {
  const { cx, cy, fill, shadowColor } = props;
  if (!cx || !cy) return null;
  return (
    <motion.circle
      animate={{ cx, cy }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      r={6}
      fill={fill}
      stroke="#fff"
      strokeWidth={3}
      style={{ filter: `drop-shadow(0px 4px 8px ${shadowColor})` }}
    />
  );
};
