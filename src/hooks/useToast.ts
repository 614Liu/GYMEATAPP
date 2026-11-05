import { useCallback, useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage {
  message: string;
  type: ToastType;
}

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  const show = useCallback((message: string, type: ToastType = 'info') => setToast({ message, type }), []);
  return { toast, show };
}
