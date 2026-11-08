import { useMemo, useState, type ReactNode } from 'react';
import { Heart, Map as MapIcon, RefreshCw, UserPlus, Users } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, Property } from '../../types';
import { daysSince, formatPrice, isRecent, isStale, relativeDay, type RequestFollowUp } from '../../lib/sheets';
import { TONE_CLASS, callLabel, isDue } from '../../lib/followup';
import { matchesFor } from '../../lib/match';
import { firstName, greeting, recentsStore, savedFiltersStore, seenMatchesStore, useStore } from '../../lib/personal';
import { nameOf } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import type { DetailActions } from '../ListingDetail';
import { Thumb } from '../ui';
import { CameraIcon, CheckIcon, ChevronRightIcon, NavigationIcon } from './icons';
import FollowUpSheet, { requestLabel } from './FollowUpSheet';
import { PushBanner } from './NotificationsCard';

interface Props {
  properties: Property[];
  requests: CustomerRequest[];
  activity: ActivityEntry[];
  userName: string;
  loading: boolean;
  actions: DetailActions;
  onRefresh: () => void;
  onFollowUp: (r: CustomerRequest, f: RequestFollowUp) => void;
  onClearFeed?: () => void; // yalnızca yöneticide verilir
}

// Ofiste görünmesi anlamlı hareketler (not, konum gibi küçük işler listeyi doldurmasın)
const FEED_ACTIONS = ['İlan eklendi', 'Satıldı / kiralandı', 'Fiyat değişti', 'Müşteri talebi eklendi', 'Müşteri talebi kapandı'];

function when(d: Date | null) {
  if (!d) return '';
  return daysSince(d) === 0 ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : relativeDay(d);
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2 px-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action ?? (hint && <span className="text-[13px] text-faint">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}

const tile = 'h-[72px] rounded-2xl bg-surface px-4 flex items-center gap-3 text-[15px] font-medium active:bg-active';

// Yönetici: akışı sıfırla. Yanlışlıkla basılmasın diye iki aşamalı (Sıfırla -> Emin misin?).
function ClearFeedButton({ onClear }: { onClear: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="min-h-9 px-3 -my-1 rounded-full text-[13px] text-muted active:bg-active">
        Sıfırla
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 -my-1">
      <span className="text-[13px] text-muted">Akış boşalsın mı?</span>
      <button type="button" onClick={() => { setAsking(false); onClear(); }} className="min-h-9 px-3 rounded-full text-[13px] font-medium bg-negative-bg text-negative">
        Evet
      </button>
      <button type="button" onClick={() => setAsking(false)} className="min-h-9 px-3 rounded-full text-[13px] bg-raised">
        Vazgeç
      </button>
    </span>
  );
}

// Açılış ekranı: bugün ne yapmalıyım, benim için ne değişti, ofiste neler oluyor
export default function MobileToday({ properties, requests, activity, userName, loading, actions, onRefresh, onFollowUp, onClearFeed }: Props) {
  const [following, setFollowing] = useState<CustomerRequest | null>(null);
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

  // Bugün (veya daha önce) aranması gereken müşteriler: en gecikmiş önce
  const calls = useMemo(
    () => myRequests.map((x) => x.r).filter((r) => isDue(r.nextCall)).sort((a, b) => (a.nextCall ?? '').localeCompare(b.nextCall ?? '')),
    [myRequests],
  );

  const byRequest = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  // Hareketin alt satırı: ilan başlığı ya da talebin kısa tarifi; iç kodlar (T-…) gösterilmez
  const feedLine = (a: ActivityEntry) => {
    if (a.title) return a.title;
    const r = byRequest.get(a.detail.trim());
    if (r) return [r.deal, r.kind, r.region !== 'Belirtilmemiş' ? r.region : ''].filter(Boolean).join(' · ');
    return /^[A-Z]{1,3}-[A-Z0-9]+$/.test(a.detail.trim()) ? '' : a.detail;
  };
  const feed = useMemo(() => activity.filter((a) => FEED_ACTIONS.includes(a.action)).slice(0, 8), [activity]);
  const recentProps = useMemo(() => recents.map((id) => byId.get(id)).filter((p): p is Property => !!p).slice(0, 10), [recents, byId]);

  const stats = [
    { label: 'Benim aktif ilanım', value: mine.length, href: '#/benim' },
    { label: 'Açık taleplerim', value: myRequests.length, href: '#/talepler' },
    { label: 'Ofiste aktif ilan', value: properties.filter((p) => p.status === 'Aktif').length, href: '#/' },
    { label: 'Bu hafta eklenen', value: properties.filter((p) => p.status === 'Aktif' && isRecent(p)).length, href: '#/?filtre=yeni' },
  ];

  const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const quiet = !stale.length && !calls.length && !myRequests.some((x) => x.fresh.length);

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
        <a href="#/danismanlar" className={tile}>
          <Users className="w-6 h-6 text-muted shrink-0" />
          Danışmanlar
        </a>
        <a href="#/favoriler" className={tile}>
          <Heart className="w-6 h-6 text-muted shrink-0" />
          Favorilerim
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

      <PushBanner />

      {calls.length > 0 && (
        <Section title="Bugün aranacak müşteriler" hint={`${calls.length} kişi`}>
          <div className="bg-surface rounded-2xl divide-y divide-rule overflow-hidden">
            {calls.slice(0, 5).map((r) => {
              const label = callLabel(r.nextCall);
              return (
                <div key={r.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">{r.customer || requestLabel(r)}</p>
                    <p className="text-[13px] text-muted truncate">{r.customer ? requestLabel(r) : r.contactNote || 'Not yok'}</p>
                    {label && <span className={`mt-1 h-5 px-2 rounded-full text-[12px] font-medium inline-flex items-center ${TONE_CLASS[label.tone]}`}>{label.text}</span>}
                  </div>
                  <button onClick={() => setFollowing(r)} className="h-11 px-4 rounded-full bg-ink text-ground text-[14px] font-medium shrink-0 active:opacity-80">
                    Görüşme yaz
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

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
                  {r.customer && <p className="text-[13px] text-muted truncate">{r.customer}</p>}
                  <p className="text-[16px] font-semibold truncate">{requestLabel(r)}</p>
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
        <Section title="Ofiste son hareketler" action={onClearFeed ? <ClearFeedButton onClear={onClearFeed} /> : undefined}>
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
                    {feedLine(a) && <p className="text-[13px] text-faint truncate">{feedLine(a)}</p>}
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

      {following && <FollowUpSheet request={following} onSave={(f) => onFollowUp(following, f)} onClose={() => setFollowing(null)} />}
    </div>
  );
}
