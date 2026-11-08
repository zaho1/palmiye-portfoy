import { useMemo, type ReactNode } from 'react';
import { Map as MapIcon, RefreshCw, UserPlus } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, Property } from '../../types';
import { daysSince, formatPrice, isRecent, isStale, relativeDay } from '../../lib/sheets';
import { matchesFor } from '../../lib/match';
import { firstName, greeting, recentsStore, savedFiltersStore, seenMatchesStore, useStore } from '../../lib/personal';
import { nameOf } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import type { DetailActions } from '../ListingDetail';
import { Thumb } from '../ui';
import { CameraIcon, CheckIcon, ChevronRightIcon, NavigationIcon } from './icons';

interface Props {
  properties: Property[];
  requests: CustomerRequest[];
  activity: ActivityEntry[];
  userName: string;
  loading: boolean;
  actions: DetailActions;
  onRefresh: () => void;
}

// Ofiste görünmesi anlamlı hareketler (not, konum gibi küçük işler listeyi doldurmasın)
const FEED_ACTIONS = ['İlan eklendi', 'Satıldı / kiralandı', 'Fiyat değişti', 'Müşteri talebi eklendi', 'Müşteri talebi kapandı'];

const requestTitle = (r: CustomerRequest) => `${[r.deal, r.kind, r.rooms].filter(Boolean).join(' ') || 'Talep'}${r.region ? `, ${r.region}` : ''}`;

function when(d: Date | null) {
  if (!d) return '';
  return daysSince(d) === 0 ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : relativeDay(d);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <span className="text-[13px] text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

const tile = 'h-[72px] rounded-2xl bg-surface px-4 flex items-center gap-3 text-[15px] font-medium active:bg-active';

// Açılış ekranı: bugün ne yapmalıyım, benim için ne değişti, ofiste neler oluyor
export default function MobileToday({ properties, requests, activity, userName, loading, actions, onRefresh }: Props) {
  const { settings } = useSettings();
  const seen = useStore(seenMatchesStore);
  const recents = useStore(recentsStore);
  const saved = useStore(savedFiltersStore);
  const mineKey = userName.toLocaleLowerCase('tr');
  const isMine = (name: string) => !!mineKey && name.toLocaleLowerCase('tr').includes(mineKey);

  const byTitle = useMemo(() => new Map(properties.map((p) => [p.title.trim(), p])), [properties]);
  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const mine = useMemo(() => properties.filter((p) => p.status === 'Aktif' && isMine(p.agentName)), [properties, mineKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stale = useMemo(
    () => mine.filter((p) => isStale(p, settings.staleDays)).sort((a, b) => (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0)),
    [mine, settings.staleDays],
  );

  const myRequests = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'Açık' && isMine(r.agentName))
        .map((r) => {
          const matches = matchesFor(r, properties);
          const known = seen[r.id];
          const fresh = known ? matches.filter((p) => !known.includes(p.id)) : [];
          return { r, matches, fresh };
        })
        .sort((a, b) => b.fresh.length - a.fresh.length || b.matches.length - a.matches.length),
    [requests, properties, seen, mineKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const feed = useMemo(() => activity.filter((a) => FEED_ACTIONS.includes(a.action)).slice(0, 8), [activity]);
  const recentProps = useMemo(() => recents.map((id) => byId.get(id)).filter((p): p is Property => !!p).slice(0, 10), [recents, byId]);

  const stats = [
    { label: 'Benim aktif ilanım', value: mine.length, href: '#/benim' },
    { label: 'Açık taleplerim', value: myRequests.length, href: '#/talepler' },
    { label: 'Ofiste aktif ilan', value: properties.filter((p) => p.status === 'Aktif').length, href: '#/' },
    { label: 'Bu hafta eklenen', value: properties.filter((p) => p.status === 'Aktif' && isRecent(p)).length, href: '#/?filtre=yeni' },
  ];

  const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const quiet = !stale.length && !myRequests.some((x) => x.fresh.length);

  return (
    <div className="m-top px-4 pt-4 pb-4 space-y-6">
      <header className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-muted">{date}</p>
          <h1 className="text-2xl font-semibold truncate">
            {greeting()}, {firstName(userName) || 'hoş geldin'}
          </h1>
        </div>
        <button onClick={onRefresh} aria-label="Yenile" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-muted active:bg-surface">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <a href="#/talep/yeni" className={tile}>
          <UserPlus className="w-6 h-6 text-muted shrink-0" />
          Yeni talep
        </a>
        <a href="#/yeni" className={tile}>
          <CameraIcon className="w-6 h-6 text-muted shrink-0" />
          Yeni ilan
        </a>
        <a href="#/?yakin=1" className={tile}>
          <NavigationIcon className="w-6 h-6 text-muted shrink-0" />
          Yakınımdakiler
        </a>
        <a href="#/harita" className={tile}>
          <MapIcon className="w-6 h-6 text-muted shrink-0" />
          Harita
        </a>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {stats.map((s) => (
          <a key={s.label} href={s.href} className="min-h-11 px-1 flex items-baseline gap-2 active:opacity-60">
            <span className="text-xl font-semibold num">{s.value}</span>
            <span className="text-[13px] text-muted">{s.label}</span>
          </a>
        ))}
      </div>

      {stale.length > 0 && (
        <Section title="Teyit bekleyen ilanlarım" hint={`${stale.length} ilan`}>
          <div className="bg-surface rounded-2xl divide-y divide-rule overflow-hidden">
            {stale.slice(0, 4).map((p) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <a href={`#/ilan/${encodeURIComponent(p.id)}`} className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">{p.title}</p>
                  <p className="text-[13px] text-warning num">{daysSince(p.updatedAt)} gündür teyitsiz · {formatPrice(p.price)}</p>
                </a>
                <button
                  onClick={() => actions.touch(p)}
                  className="h-11 px-4 rounded-full bg-positive-bg text-positive text-[14px] font-medium flex items-center gap-1.5 shrink-0 active:opacity-70"
                >
                  <CheckIcon className="w-4 h-4" /> Hâlâ geçerli
                </button>
              </div>
            ))}
          </div>
          {stale.length > 4 && (
            <a href="#/benim" className="block min-h-11 px-1 pt-2 text-[14px] text-muted underline underline-offset-2">
              Diğer {stale.length - 4} ilanı da gör
            </a>
          )}
        </Section>
      )}

      {myRequests.length > 0 && (
        <Section title="Taleplerim" hint="Müşterine uyan ilanlar">
          <div className="space-y-2">
            {myRequests.slice(0, 4).map(({ r, matches, fresh }) => (
              <a key={r.id} href="#/talepler" className="bg-surface rounded-2xl p-4 flex items-center gap-3 active:bg-active">
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold truncate">{requestTitle(r)}</p>
                  <p className="text-[13px] text-muted mt-0.5 num">
                    {r.maxPrice ? `En çok ${formatPrice(r.maxPrice)}` : 'Bütçe belirtilmemiş'}
                    {r.createdAt ? ` · ${relativeDay(r.createdAt)} açıldı` : ''}
                  </p>
                </div>
                {fresh.length > 0 ? (
                  <span className="h-8 px-3 rounded-full bg-positive text-ground text-[14px] font-semibold flex items-center shrink-0 num">{fresh.length} yeni</span>
                ) : (
                  <span className={`h-8 px-3 rounded-full text-[14px] flex items-center shrink-0 num ${matches.length ? 'bg-positive-bg text-positive' : 'bg-raised text-muted'}`}>
                    {matches.length ? `${matches.length} uyuyor` : 'Uyan yok'}
                  </span>
                )}
                <ChevronRightIcon className="w-5 h-5 text-faint shrink-0" />
              </a>
            ))}
          </div>
        </Section>
      )}

      {quiet && !loading && (
        <p className="rounded-2xl border border-dashed border-control px-4 py-5 text-center text-muted">
          Bekleyen bir iş yok. Yeni bir müşteri veya ilan geldiğinde + düğmesinden ekleyebilirsin.
        </p>
      )}

      {saved.length > 0 && (
        <Section title="Kayıtlı filtrelerim">
          <div className="flex flex-wrap gap-2">
            {saved.map((f) => (
              <a key={f.id} href={`#/?kf=${f.id}`} className="min-h-11 px-4 rounded-full border border-control text-[15px] flex items-center active:bg-surface">
                {f.name}
              </a>
            ))}
          </div>
        </Section>
      )}

      {recentProps.length > 0 && (
        <Section title="Son baktıklarım">
          <div className="m-hscroll -mx-4 px-4 flex gap-3 overflow-x-auto pb-1">
            {recentProps.map((p) => (
              <a key={p.id} href={`#/ilan/${encodeURIComponent(p.id)}`} className="w-40 shrink-0 bg-surface rounded-2xl overflow-hidden active:opacity-80">
                <Thumb src={p.imageUrl} alt="" className="w-full aspect-[4/3]" />
                <div className="p-2.5">
                  <p className="text-[14px] font-semibold num text-accent truncate">{formatPrice(p.price)}</p>
                  <p className="text-[13px] text-muted truncate">{p.title}</p>
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {feed.length > 0 && (
        <Section title="Ofiste son hareketler">
          <div className="bg-surface rounded-2xl divide-y divide-rule overflow-hidden">
            {feed.map((a, i) => {
              const p = byTitle.get(a.title.trim());
              const row = (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] truncate">
                      <span className="font-medium">{isMine(nameOf(a.who)) ? 'Sen' : firstName(nameOf(a.who))}</span>{' '}
                      <span className="text-muted">{a.action.toLocaleLowerCase('tr')}</span>
                    </p>
                    <p className="text-[13px] text-faint truncate">{a.title || a.detail || '—'}</p>
                  </div>
                  <span className="text-[12px] text-faint num shrink-0">{when(a.at)}</span>
                </>
              );
              const cls = 'min-h-14 px-4 py-2 flex items-center gap-3';
              return p ? (
                <a key={i} href={`#/ilan/${encodeURIComponent(p.id)}`} className={`${cls} active:bg-active`}>{row}</a>
              ) : (
                <div key={i} className={cls}>{row}</div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
