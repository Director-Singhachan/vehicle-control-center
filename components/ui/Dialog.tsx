// Modal dialog (shadcn-like API) — Tailwind only, no Radix
import React, { useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange: _onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return <>{children}</>;
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** ถ้าเรียก preventDefault() จะไม่ปิด — implementation นี้ไม่ปิดจาก backdrop อยู่แล้ว */
  onInteractOutside?: (event: Event) => void;
  onEscapeKeyDown?: (event: Event) => void;
}

export function DialogContent({
  className = '',
  children,
  onInteractOutside,
  onEscapeKeyDown,
  ...rest
}: DialogContentProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onEscapeKeyDown?.(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscapeKeyDown]);

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onInteractOutside?.(e.nativeEvent);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm dark:bg-black/60"
      role="dialog"
      aria-modal="true"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        className={`relative w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-charcoal-900 ${className}`}
        onPointerDown={(e) => e.stopPropagation()}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-2 border-b border-slate-200 p-6 pb-4 dark:border-slate-700 ${className}`}
      {...props}
    />
  );
}

export function DialogTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-lg font-semibold leading-none text-slate-900 dark:text-white ${className}`}
      {...props}
    />
  );
}

export function DialogDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-slate-600 dark:text-slate-400 ${className}`} {...props} />
  );
}
