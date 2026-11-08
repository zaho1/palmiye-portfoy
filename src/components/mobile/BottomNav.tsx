import type { ReactNode } from 'react';
import { House, Plus, UserRound, Users } from 'lucide-react';
import { CalendarCheckIcon } from './icons';

export type NavTab = 'today' | 'list' | 'requests' | 'me' | null;

interface Props {
  active: NavTab;
  requestBadge: number;
  todayBadge?: number;
  onAdd: () => void;
}

function Item({ href, label, icon, on, badge }: { href: string; label: string; icon: ReactNode; on: boolean; badge?: number }) {
  return (
    <a
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 active:bg-surface ${on ? 'text-ink font-semibold' : 'text-nav'}`}
    >
      <span className="relative [&_svg]:w-6 [&_svg]:h-6">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-positive text-ground text-[11px] font-semibold flex items-center justify-center num">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-[12px] leading-4">{label}</span>
      {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
    </a>
  );
}

// Altta sabit menü: Bugün · İlanlar · (+) · Talepler · Ben (Harita, İlanlar ve Bugün ekranından açılır)
export default function BottomNav({ active, requestBadge, todayBadge, onAdd }: Props) {
  return (
    <nav aria-label="Ana menü" className="m-nav lg:hidden no-print">
      <div className="h-16 flex items-stretch">
        <Item href="#/bugun" label="Bugün" icon={<CalendarCheckIcon />} on={active === 'today'} badge={todayBadge} />
        <Item href="#/" label="İlanlar" icon={<House />} on={active === 'list'} />
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <button
            onClick={onAdd}
            aria-label="Yeni ekle: ilan veya talep"
            className="-mt-5 w-14 h-14 rounded-full bg-ink text-ground flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,.4)] active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
        <Item href="#/talepler" label="Talepler" icon={<Users />} on={active === 'requests'} badge={requestBadge} />
        <Item href="#/ben" label="Ben" icon={<UserRound />} on={active === 'me'} />
      </div>
    </nav>
  );
}
