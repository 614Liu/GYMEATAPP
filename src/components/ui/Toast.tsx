import { useEffect, useRef, useState } from 'react';
import { RM } from '../../lib/fx';
import type { ToastMessage } from '../../hooks/useToast';

/** 顶部落下的提示条；底沿一条细线在显示时长内缩完（#056），能看出还剩多久可以撤销 */
export function Toast({ toast, onHide }: { toast: ToastMessage | null; onHide: () => void }) {
  const [shown, setShown] = useState<ToastMessage | null>(toast);
  const line = useRef<HTMLElement>(null);
  useEffect(() => { if (toast) setShown(toast); }, [toast]);
  useEffect(() => {
    if (!toast || !line.current || RM) return;
    const a = line.current.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: toast.ms, easing: 'linear', fill: 'forwards' });
    return () => a.cancel();
  }, [toast]);

  return (
    <div className={`toast ${toast ? 'show' : ''} ${shown?.type === 'error' ? 'err' : ''}`} role="status" aria-live="polite">
      <span>{shown?.message}</span>
      {shown?.action && (
        <button type="button" onClick={() => { shown.action!.run(); onHide(); }}>{shown.action.label}</button>
      )}
      <i ref={line} className="tl" />
    </div>
  );
}
