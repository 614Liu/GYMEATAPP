import { useEffect, useRef } from 'react';
import { drawArt } from '../../lib/fx';

/** #072 空状态的线条小图：出现时一笔一笔画出来 */
export function EmptyArt({ kind = 'bowl', size = 64 }: { kind?: 'bowl' | 'search' | 'chart'; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { drawArt(ref.current?.parentElement ?? null); }, []);
  return (
    <svg ref={ref} className="ea" viewBox="0 0 72 72" width={size} height={size} fill="none" stroke="#9aa39f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', flex: 'none' }}>
      {kind === 'search' && (<><circle cx="34" cy="34" r="18" /><path d="M47 47l14 14" /><path d="M26 34h16" /></>)}
      {kind === 'bowl' && (<><path d="M10 34h52c0 15-11.6 26-26 26S10 49 10 34z" /><path d="M22 60h28" /><path d="M28 24c0-5 4-5 4-10M38 26c0-5 4-5 4-10" /></>)}
      {kind === 'chart' && (<><path d="M12 58h48" /><path d="M18 50l12-14 10 8 16-20" /><circle cx="56" cy="24" r="3" /></>)}
    </svg>
  );
}
