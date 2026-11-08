import { House, UserPlus } from 'lucide-react';
import { Sheet } from './controls';
import { ChevronRightIcon } from './icons';

// Ortadaki "+" düğmesi: Yeni ilan / Yeni talep seçimi
export default function AddSheet({ onClose }: { onClose: () => void }) {
  const row = 'w-full flex items-center gap-4 rounded-2xl bg-ground px-4 min-h-[72px] text-left active:bg-active';
  return (
    <Sheet title="Ne eklemek istiyorsunuz?" onClose={onClose}>
      <div className="space-y-3">
        <a href="#/talep/yeni" onClick={onClose} className={row}>
          <span className="w-12 h-12 rounded-full bg-positive-bg text-positive flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-semibold">Yeni talep</span>
            <span className="block text-[14px] text-muted">Müşterinin aradığını girin, uyan ilanlar eşleşsin</span>
          </span>
          <ChevronRightIcon className="w-5 h-5 text-faint shrink-0" />
        </a>
        <a href="#/yeni" onClick={onClose} className={row}>
          <span className="w-12 h-12 rounded-full bg-ink text-ground flex items-center justify-center shrink-0">
            <House className="w-6 h-6" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-semibold">Yeni ilan</span>
            <span className="block text-[14px] text-muted">Fotoğrafı çekin, konumu ve fiyatı girin</span>
          </span>
          <ChevronRightIcon className="w-5 h-5 text-faint shrink-0" />
        </a>
      </div>
    </Sheet>
  );
}
