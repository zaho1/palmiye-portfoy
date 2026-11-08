import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, EyeOff, Heart, Lock, LogOut, RefreshCw, Settings as SettingsIcon, UserRound, Users } from 'lucide-react';
import type { Property } from '../../types';
import { changePassword, fetchAdminStats, formatPhone, formatPrice, getApiToken, type AdminStats, type MonthRow } from '../../lib/sheets';
import { personOf, useDirectory } from '../../lib/people';
import { useSettings, type ThemeChoice } from '../../lib/settings';
import type { SyncState } from '../Sidebar';
import { InstallCard } from './InstallApp';
import { PushSettings } from './NotificationsCard';
import { MField, Segmented, Sheet, btnBig, btnBigDanger, btnBigSecondary } from './controls';
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

// Yönetici hesapları: "Ben" sekmesinde portföy ve satış özeti görürler (sunucu da aynı listeyi kontrol eder)
const ADMIN_EMAILS = ['ilbey@palmiyeyatirim.com', 'zahit@palmiyeyatirim.com', 'omer@palmiyeyatirim.com'];

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
  const directory = useDirectory();
  const { settings, update, favorites } = useSettings();
  const [pwOpen, setPwOpen] = useState(false);
  const key = userName.toLocaleLowerCase('tr');
  const counts = useMemo(
    () => ({
      mine: key ? properties.filter((p) => p.status === 'Aktif' && p.agentName.toLocaleLowerCase('tr').includes(key)).length : 0,
      favorites: properties.filter((p) => favorites.includes(p.id) && p.status !== 'Silindi').length,
    }),
    [properties, key, favorites],
  );
  const isAdmin = ADMIN_EMAILS.includes(userEmail.trim().toLowerCase());
  const phone = settings.phone || personOf(userEmail)?.phone || '';
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

      {isAdmin && <AdminSummary />}

      <InstallCard />
      <PushSettings />

      <section className="bg-surface rounded-2xl overflow-hidden">
        <Row href="#/benim" icon={<UserRound />} label="Benim ilanlarım" value={String(counts.mine)} />
        <Row href="#/favoriler" icon={<Heart />} label="Favorilerim" value={String(counts.favorites)} />
        <Row href="#/danismanlar" icon={<Users />} label="Danışmanlar" value={String(directory.length)} />
        <Row href="#/ayarlar" icon={<SettingsIcon />} label="Ayarlar" />
        {getApiToken() && <Row onClick={() => setPwOpen(true)} icon={<Lock />} label="Şifremi değiştir" />}
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

      {pwOpen && <PasswordSheet onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function AdminSummary() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    fetchAdminStats()
      .then((s) => { setStats(s); setFailed(!s); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const monthName = stats ? new Date(`${stats.month}-01T00:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : '';
  return (
    <section className="bg-surface rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">Yönetici özeti</h2>
        <button onClick={load} aria-label="Özeti yenile" className="w-9 h-9 rounded-full flex items-center justify-center text-muted active:bg-active">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {!stats ? (
        <p className="text-[14px] text-muted">{failed ? 'Özet alınamadı. Apps Script güncellemesi yapılmış olmalı.' : 'Yükleniyor…'}</p>
      ) : (
        <>
          <div>
            <p className="text-[13px] text-faint mb-2">Portföy</p>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Satılık ilan" value={String(stats.portfolio.satilik.count)} sub={formatPrice(stats.portfolio.satilik.value)} />
              <Tile label="Kiralık ilan" value={String(stats.portfolio.kiralik.count)} sub={formatPrice(stats.portfolio.kiralik.value)} />
            </div>
          </div>
          <div>
            <p className="text-[13px] text-faint mb-2">Bu ay ({monthName})</p>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Satılık satış" value={String(stats.current.satilikCount)} sub={stats.current.satilikValue ? formatPrice(stats.current.satilikValue) : undefined} />
              <Tile label="Kiralık satış" value={String(stats.current.kiralikCount)} sub={stats.current.kiralikValue ? formatPrice(stats.current.kiralikValue) : undefined} />
            </div>
            <p className="text-[12px] text-faint mt-2 num">Toplam: {stats.soldTotal.satilik} satılık · {stats.soldTotal.kiralik} kiralık</p>
          </div>

          <div>
            <p className="text-[13px] text-faint mb-1">Son 12 ay</p>
            <TrendChart rows={stats.monthly} />
          </div>

          {stats.byAdvisor.length > 0 && (
            <div>
              <p className="text-[13px] text-faint mb-1">Bu ay danışmanlara göre</p>
              <ul className="space-y-1">
                {stats.byAdvisor.map((a) => (
                  <li key={a.name} className="flex justify-between text-[15px]">
                    <span className="truncate">{a.name}</span>
                    <span className="num text-muted">{a.count} satış{a.value ? ` · ${formatPrice(a.value)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stats.monthSales.length > 0 && (
            <div>
              <p className="text-[13px] text-faint mb-1">Bu ayki satışlar</p>
              <ul className="space-y-2">
                {stats.monthSales.map((s, i) => (
                  <li key={i} className="text-[15px]">
                    <p className="truncate">{s.title} <span className="text-[12px] text-faint">· {s.kiralik ? 'Kiralık' : 'Satılık'}</span></p>
                    <p className="text-[13px] text-faint num">{s.date}{s.broughtBy ? ` · ${s.broughtBy}` : ''}{s.price ? ` · ${formatPrice(s.price)}` : ''}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Basit çizgi grafiği: satılık ve kiralık satış adedi, son 12 ay
function TrendChart({ rows }: { rows: MonthRow[] }) {
  const W = 320;
  const H = 130;
  const padL = 18;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const max = Math.max(1, ...rows.flatMap((r) => [r.satilikCount, r.kiralikCount]));
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, rows.length - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = (key: 'satilikCount' | 'kiralikCount') => rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ');
  const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('tr-TR', { month: 'short' });
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Son 12 ay satış grafiği">
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="stroke-rule" strokeWidth="1" />
        <line x1={padL} x2={W - padR} y1={y(max)} y2={y(max)} className="stroke-rule" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padL - 4} y={y(max) + 4} textAnchor="end" className="fill-faint" fontSize="9">{max}</text>
        <path d={line('satilikCount')} fill="none" className="stroke-ink" strokeWidth="2" strokeLinejoin="round" />
        <path d={line('kiralikCount')} fill="none" className="stroke-muted" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        {rows.map((r, i) => (
          <text key={r.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-faint" fontSize="9">{(rows.length - 1 - i) % 2 === 0 ? label(r.month) : ''}</text>
        ))}
      </svg>
      <div className="flex gap-4 text-[12px] text-muted mt-1">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-ink inline-block" /> Satılık</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-muted inline-block" /> Kiralık</span>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-raised rounded-xl p-3 min-w-0">
      <p className="text-[12px] text-faint leading-tight">{label}</p>
      <p className="text-[18px] font-semibold num mt-1 truncate">{value}</p>
      {sub && <p className="text-[12px] text-muted num truncate">{sub}</p>}
    </div>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError('');
    if (!current) return setError('Mevcut şifrenizi yazın.');
    if (next.length < 8) return setError('Yeni şifre en az 8 karakter olmalı.');
    if (next !== again) return setError('Yeni şifreler aynı değil.');
    setBusy(true);
    try {
      const res = await changePassword(current, next);
      if (res.success) setDone(true);
      else setError(res.message || 'Şifre değiştirilemedi.');
    } catch {
      setError('Sunucuya ulaşılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Şifremi değiştir"
      onClose={onClose}
      footer={
        done ? (
          <button onClick={onClose} className={`${btnBig} w-full`}>Tamam</button>
        ) : (
          <div className="flex gap-3">
            <button onClick={onClose} className={`${btnBigSecondary} flex-1`}>Vazgeç</button>
            <button onClick={submit} disabled={busy} className={`${btnBig} flex-[2]`}>{busy ? 'Kaydediliyor…' : 'Değiştir'}</button>
          </div>
        )
      }
    >
      {done ? (
        <p className="text-[15px]">Şifreniz değiştirildi. Bu telefonda oturumunuz açık kalır.</p>
      ) : (
        <div className="space-y-4">
          <MField label="Mevcut şifre" htmlFor="pw-cur"><input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="field-lg" /></MField>
          <MField label="Yeni şifre (en az 8 karakter)" htmlFor="pw-new"><input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="field-lg" /></MField>
          <MField label="Yeni şifre (tekrar)" htmlFor="pw-again"><input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="field-lg" /></MField>
          {error && <p role="alert" className="text-[14px] text-negative">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
