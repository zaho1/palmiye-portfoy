import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Telefon ekranlarında ortak kullanılan büyük dokunma alanlı kontroller (en az 44px)

export function Chip({ on, onClick, children, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 px-4 rounded-full border text-[15px] transition-colors active:scale-[0.98] ${
        on ? 'border-ink bg-active text-ink font-medium' : 'border-control text-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex h-12 rounded-xl bg-ground p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`flex-1 rounded-lg text-[15px] transition-colors ${value === o ? 'bg-raised text-ink font-medium' : 'text-muted'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function MField({ label, htmlFor, note, children }: { label: string; htmlFor?: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[15px] font-medium">{label}</label>
        ) : (
          <span className="text-[15px] font-medium">{label}</span>
        )}
        {note && <span className="text-[13px] text-faint num">{note}</span>}
      </div>
      {children}
    </div>
  );
}

export const btnBig = 'h-12 px-5 rounded-full bg-ink text-ground text-base font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-60';
export const btnBigSecondary = 'h-12 px-5 rounded-full border border-control text-base flex items-center justify-center gap-2 active:bg-surface disabled:opacity-60';
export const btnBigDanger = 'h-12 px-5 rounded-full border border-negative text-negative text-base flex items-center justify-center gap-2 active:bg-negative-bg';

// Alttan açılan panel: filtre, "+" seçimi, kurulum adımları
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[88dvh] flex flex-col rounded-t-2xl bg-surface shadow-[0_-12px_28px_rgba(0,0,0,.35)]"
      >
        <div className="h-14 shrink-0 flex items-center justify-between pl-4 pr-2 border-b border-rule">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="w-11 h-11 flex items-center justify-center rounded-full text-muted active:bg-active">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto px-4 pt-4 ${footer ? 'pb-4' : 'm-sheet-body'}`}>{children}</div>
        {footer && <div className="shrink-0 px-4 pt-3 border-t border-rule m-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
