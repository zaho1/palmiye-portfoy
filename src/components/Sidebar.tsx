import { useMemo, type ReactNode } from 'react';
import { Globe, Heart, House, LogOut, Map as MapIcon, Moon, Plus, RefreshCw, Settings as SettingsIcon, Sun, UserRound, Users } from 'lucide-react';
import type { Property } from '../types';
import { isIncomplete, isRecent, isStale, priceDropped } from '../lib/sheets';
import { useSettings } from '../lib/settings';
import { isAdmin } from '../lib/admin';

export interface SyncState {
  loading: boolean;
  error: boolean;
  v2Ready: boolean;
  loadedAt: Date | null;
}

interface Props {
  hash: string;
  properties: Property[];
  userName: string;
  userEmail: string;
  matchedRequests: number;
  sync: SyncState;
  onRefresh: () => void;
  onLogout: () => void;
}

export default function Sidebar({ hash, properties, userName, userEmail, matchedRequests, sync, onRefresh, onLogout }: Props) {
  const { settings, update, resolvedTheme, favorites } = useSettings();
  const current = hash.replace(/^#\/?/, '');

  const c = useMemo(() => {
    const active = properties.filter((p) => p.status === 'Aktif');
    const key = userName.toLocaleLowerCase('tr');
    const regions: Record<string, number> = {};
    active.forEach((p) => (regions[p.region] = (regions[p.region] ?? 0) + 1));
    return {
      active: active.length,
      mine: key ? properties.filter((p) => p.status === 'Aktif' && p.agentName.toLocaleLowerCase('tr').includes(key)).length : 0,
      favorites: properties.filter((p) => favorites.includes(p.id) && p.status !== 'Silindi').length,
      stale: active.filter((p) => isStale(p, settings.staleDays)).length,
      recent: active.filter(isRecent).length,
      incomplete: active.filter(isIncomplete).length,
      dropped: active.filter(priceDropped).length,
      regions,
    };
  }, [properties, userName, favorites, settings.staleDays]);

  const loadedText = sync.loadedAt ? sync.loadedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const status = sync.error
    ? { dot: 'bg-negative', text: 'Sheets okunamadı' }
    : !sync.v2Ready
      ? { dot: 'bg-warning', text: 'İlanlar bağlı · Apps Script v2 bekleniyor' }
      : { dot: 'bg-positive', text: 'Google Sheets bağlı' };

  return (
    <div className="flex flex-col h-full">
      <a href="#/" className="h-16 flex items-center gap-3 px-5 border-b border-rule shrink-0">
        <img src="/logo.png" alt="" className="h-8 w-auto logo-chip" />
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Palmiye Yatırım</span>
          <span className="block text-xs text-muted">Portföy paneli</span>
        </span>
      </a>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        <a href="#/yeni" className="mx-1 h-9 rounded-full bg-ink text-ground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted transition-colors">
          <Plus className="w-4 h-4" /> Yeni ilan
        </a>

        <Group label="Portföy">
          <Item href="#/" icon={<House />} active={current === '' || current.startsWith('ilan/')} label="Bütün ilanlar" count={c.active} />
          <Item href="#/benim" icon={<UserRound />} active={current === 'benim'} label="Benim ilanlarım" count={c.mine} />
          <Item href="#/favoriler" icon={<Heart />} active={current === 'favoriler'} label="Favorilerim" count={c.favorites} />
          <Item href="#/harita" icon={<MapIcon />} active={current === 'harita'} label="Harita" />
          <Item href="#/talepler" icon={<Users />} active={current === 'talepler'} label="Müşteri talepleri" badge={matchedRequests > 0 ? `${matchedRequests} eşleşme` : undefined} />
        </Group>

        <Group label="Hızlı filtre">
          <Item href="#/?filtre=teyitsiz" active={current === '?filtre=teyitsiz'} label={`${settings.staleDays}+ gün teyitsiz`} count={c.stale} warn={c.stale > 0} />
          <Item href="#/?filtre=yeni" active={current === '?filtre=yeni'} label="Son 7 günde eklenen" count={c.recent} />
          <Item href="#/?filtre=eksik" active={current === '?filtre=eksik'} label="Bilgisi eksik" count={c.incomplete} />
          <Item href="#/?filtre=indirim" active={current === '?filtre=indirim'} label="Fiyatı düşen" count={c.dropped} />
        </Group>

        <Group label="Bağlantılar">
          <a href="https://palmiyeyatirim.com/tr" target="_blank" rel="noreferrer" className="h-[34px] flex items-center gap-2.5 px-3 rounded-md text-sm text-nav hover:text-ink [&_svg]:w-4 [&_svg]:h-4">
            <Globe /> Resmi web sitesi
          </a>
        </Group>
      </div>

      <div className="border-t border-rule px-2 py-3 space-y-3">
        {isAdmin(userEmail) ? (
        <div className="mx-1 rounded-lg bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-none ${status.dot}`} aria-hidden="true" />
            <span className="flex-1 truncate">{status.text}</span>
            <button onClick={onRefresh} aria-label="Şimdi eşitle" title="Şimdi eşitle" className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-active">
              <RefreshCw className={`w-3.5 h-3.5 ${sync.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-faint num mt-0.5">Son eşitleme {loadedText}</p>
        </div>
        ) : (
          <button onClick={onRefresh} className="mx-1 w-[calc(100%-0.5rem)] h-9 rounded-lg bg-surface text-sm flex items-center justify-center gap-2 text-muted hover:text-ink">
            <RefreshCw className={`w-3.5 h-3.5 ${sync.loading ? 'animate-spin' : ''}`} /> Verileri yenile
          </button>
        )}

        <div className="flex items-center gap-1 px-1">
          <a href="#/ayarlar" aria-current={current === 'ayarlar' ? 'page' : undefined} className={`flex-1 h-9 px-2 rounded-md flex items-center gap-2 text-sm hover:text-ink hover:bg-surface ${current === 'ayarlar' ? 'text-ink font-medium' : 'text-nav'}`}>
            <SettingsIcon className="w-4 h-4" /> Ayarlar
          </a>
          <button
            onClick={() => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
            aria-label={resolvedTheme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
            title={resolvedTheme === 'dark' ? 'Açık tema' : 'Koyu tema'}
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted hover:text-ink hover:bg-surface"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3 px-3">
          <span className="w-8 h-8 rounded-full bg-raised flex items-center justify-center text-xs font-medium shrink-0" aria-hidden="true">
            {userName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-faint truncate">{userEmail}</p>
          </div>
          <button onClick={onLogout} aria-label="Oturumu kapat" title="Oturumu kapat" className="w-9 h-9 flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-surface">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label}>
      <p className="px-3 mb-1 text-xs text-faint">{label}</p>
      <div className="flex flex-col">{children}</div>
    </nav>
  );
}

function Item({ href, label, active, icon, count, badge, warn }: {
  href: string;
  label: string;
  active: boolean;
  icon?: ReactNode;
  count?: number;
  badge?: string;
  warn?: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`h-[34px] flex items-center gap-2.5 px-3 rounded-md text-sm transition-colors hover:text-ink hover:bg-surface [&_svg]:w-4 [&_svg]:h-4 [&_svg]:flex-none ${
        active ? 'text-ink font-medium bg-active' : 'text-nav'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto h-5 px-2 rounded-full bg-positive-bg text-positive text-xs font-medium flex items-center num whitespace-nowrap">{badge}</span>
      ) : count !== undefined ? (
        <span className={`ml-auto text-xs num ${warn ? 'text-warning font-medium' : 'text-faint'}`}>{count}</span>
      ) : null}
    </a>
  );
}
