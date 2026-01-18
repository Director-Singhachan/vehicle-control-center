// useToast Hook - Beautiful toast notifications
import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '../components/ui/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const toast: Toast = {
        id,
        type,
        message,
        duration,
      };

      setToasts((prev) => [...prev, toast]);
      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      return showToast('success', message, duration);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      return showToast('error', message, duration);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      return showToast('warning', message, duration);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      return showToast('info', message, duration);
    },
    [showToast]
  );

  return {
    toasts,
    showToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
}
