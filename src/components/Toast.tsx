import { useEffect, useRef } from 'react';

export interface ToastState {
  message: string;
  undo?: () => void;
}

export default function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Süre yalnızca yeni bir bildirim geldiğinde baştan başlar
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div
      role="status"
      className="fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-[420px] bg-raised rounded-xl px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,.45)] flex items-center gap-4"
    >
      <p className="text-sm flex-1">{toast.message}</p>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.();
          }}
          className="text-sm font-medium underline underline-offset-2 hover:text-muted"
        >
          Geri al
        </button>
      )}
      <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="Bildirimi kapat">
        Kapat
      </button>
    </div>
  );
}
