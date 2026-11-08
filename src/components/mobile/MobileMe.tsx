import { useMemo, type ReactNode } from 'react';
import { Eye, EyeOff, Heart, LogOut, RefreshCw, Settings as SettingsIcon, UserRound } from 'lucide-react';
import type { Property } from '../../types';
import { formatPhone } from '../../lib/sheets';
import { OFFICE_AUTH_CONFIG } from '../../config/auth';
import { useSettings, type ThemeChoice } from '../../lib/settings';
import type { SyncState } from '../Sidebar';
import { InstallCard } from './InstallApp';
import { MField, Segmented, btnBigDanger } from './controls';
import { ChevronRightIcon } from './icons';

interface Props {
  properties: Property[];
  userName: string;
  userEmail: string;
  sync: SyncState;
  presentMode: boolean;
  onTogglePresent: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

const THEME_LABEL: Record<ThemeChoice, string> = { dark: 'Koyu', light: 'Açık', system: 'Cihaza göre' };
const THEME_BY_LABEL: Record<string, ThemeChoice> = { Koyu: 'dark', Açık: 'light', 'Cihaza göre': 'system' };

function Row({ href, onClick, icon, label, value }: { href?: string; onClick?: () => void; icon: ReactNode; label: string; value?: string }) {
  const cls = 'w-full min-h-14 px-4 flex items-center gap-3 text-left active:bg-active border-t border-rule first:border-t-0';
  const body = (
    <>
      <span className="w-6 h-6 text-muted shrink-0 [&_svg]:w-6 [&_svg]:h-6">{icon}</span>
      <span className="flex-1 min-w-0 text-[16px]">{label}</span>
      {value && <span className="text-[15px] text-muted num">{value}</span>}
      {href && <ChevronRightIcon className="w-5 h-5 text-faint shrink-0" />}
    </>
  );
  return href ? (
    <a href={href} className={cls}>{body}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  );
}

// "Ben" sekmesi: profil, uygulamayı yükle, kısayollar, tema, çıkış
export default function MobileMe({ properties, userName, userEmail, sync, presentMode, onTogglePresent, onRefresh, onLogout }: Props) {
  const { settings, update, favorites } = useSettings();
  const key = userName.toLocaleLowerCase('tr');
  const counts = useMemo(
    () => ({
      mine: key ? properties.filter((p) => p.status === 'Aktif' && p.agentName.toLocaleLowerCase('tr').includes(key)).length : 0,
      favorites: properties.filter((p) => favorites.includes(p.id) && p.status !== 'Silindi').length,
    }),
    [properties, key, favorites],
  );
  const phone = settings.phone || OFFICE_AUTH_CONFIG.allowedUsers.find((u) => u.email === userEmail)?.phone || '';
  const loadedText = sync.loadedAt ? sync.loadedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const status = sync.error ? 'Sheets okunamadı' : !sync.v2Ready ? 'İlanlar bağlı · Apps Script v2 bekleniyor' : 'Google Sheets bağlı';

  return (
    <div className="m-top px-4 pt-4 space-y-4">
      <h1 className="text-2xl font-semibold">Ben</h1>

      <section className="bg-surface rounded-2xl p-4 flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-raised flex items-center justify-center text-lg font-semibold shrink-0" aria-hidden="true">
          {userName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold truncate">{userName}</p>
          <p className="text-[14px] text-muted truncate">{userEmail}</p>
          {phone && <p className="text-[14px] text-faint num">{formatPhone(phone)}</p>}
        </div>
      </section>

      <InstallCard />

      <section className="bg-surface rounded-2xl overflow-hidden">
        <Row href="#/benim" icon={<UserRound />} label="Benim ilanlarım" value={String(counts.mine)} />
        <Row href="#/favoriler" icon={<Heart />} label="Favorilerim" value={String(counts.favorites)} />
        <Row href="#/ayarlar" icon={<SettingsIcon />} label="Ayarlar" />
      </section>

      <section className="bg-surface rounded-2xl p-4 space-y-5">
        <MField label="Tema">
          <Segmented
            label="Tema"
            value={THEME_LABEL[settings.theme]}
            options={Object.values(THEME_LABEL)}
            onChange={(v) => update({ theme: THEME_BY_LABEL[v] })}
          />
        </MField>
        <div>
          <button
            type="button"
            onClick={onTogglePresent}
            aria-pressed={presentMode}
            className="w-full min-h-12 flex items-center gap-3 text-left"
          >
            <span className="text-muted">{presentMode ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</span>
            <span className="flex-1 text-[16px]">Sunum modu</span>
            <span className={`h-8 px-3 rounded-full text-[14px] font-medium flex items-center ${presentMode ? 'bg-ink text-ground' : 'bg-raised text-muted'}`}>
              {presentMode ? 'Açık' : 'Kapalı'}
            </span>
          </button>
          <p className="text-[13px] text-faint mt-1">Müşteri yanındayken ada/parsel ve ofis içi bilgileri gizler.</p>
        </div>
      </section>

      <section className="bg-surface rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sync.error ? 'bg-negative' : !sync.v2Ready ? 'bg-warning' : 'bg-positive'}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px]">{status}</p>
            <p className="text-[13px] text-faint num">Son eşitleme {loadedText}</p>
          </div>
          <button onClick={onRefresh} aria-label="Şimdi eşitle" className="w-11 h-11 rounded-full flex items-center justify-center text-muted active:bg-active">
            <RefreshCw className={`w-5 h-5 ${sync.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      <button onClick={onLogout} className={`${btnBigDanger} w-full`}>
        <LogOut className="w-5 h-5" /> Oturumu kapat
      </button>
    </div>
  );
}
