import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}

// Tek gölge yüzeyi: havada duran pencere. Esc ve dışarı tıklama kapatır.
export default function Dialog({ title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, a, input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-raised rounded-xl p-5 shadow-[0_12px_28px_rgba(0,0,0,.45)]"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

export const btnSecondary = 'h-9 px-4 rounded-full border border-control text-sm hover:border-ink transition-colors flex items-center gap-2';
export const btnPrimary = 'h-9 px-4 rounded-full bg-ink text-ground text-sm font-semibold hover:bg-muted transition-colors flex items-center gap-2';
export const btnDanger = 'h-9 px-4 rounded-full border border-negative text-negative text-sm hover:bg-negative-bg transition-colors flex items-center gap-2';
