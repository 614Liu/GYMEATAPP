import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastAction { label: string; run: () => void }
export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
  ms: number;
}

/** 顶部提示条：一次只显示一条；带「撤销」这类按钮时显示得久一点 */
export function useToast(durationMs = 1800) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.ms);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((message: string, type: ToastType = 'info', opts?: { action?: ToastAction; ms?: number }) => {
    seq.current += 1;
    setToast({ id: seq.current, message, type, action: opts?.action, ms: opts?.ms ?? (opts?.action ? 3200 : type === 'error' ? 2800 : durationMs) });
  }, [durationMs]);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}
