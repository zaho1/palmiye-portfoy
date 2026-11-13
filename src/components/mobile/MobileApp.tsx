import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ActivityEntry, CustomerRequest, Property } from '../../types';
import type { NewListing, NewRequest, RequestFollowUp } from '../../lib/sheets';
import { matchesFor } from '../../lib/match';
import { parseHash, type Route } from '../../lib/route';
import ListingDetail, { type DetailActions } from '../ListingDetail';
import type { ListPreset } from '../ListingList';
import Maps from '../Maps';
import Settings from '../Settings';
import Brochure from '../Brochure';
import CompsPage from '../CompsPage';
import ValuationReport from '../ValuationReport';
import EditListing from '../EditListing';
import OfflineBanner from '../OfflineBanner';
import { useUpdateReady } from '../../lib/pwa';
import { rememberView, seenMatchesStore, useStore } from '../../lib/personal';
import type { SyncState } from '../Sidebar';
import BottomNav, { type NavTab } from './BottomNav';
import AddSheet from './AddSheet';
import MobileListings from './MobileListings';
import MobileRequests from './MobileRequests';
import MobileNewRequest from './MobileNewRequest';
import MobileNewListing from './MobileNewListing';
import MobileMe from './MobileMe';
import MobileToday from './MobileToday';
import MobileTeam from './MobileTeam';
import PullToRefresh from './PullToRefresh';
import { ChevronLeftIcon } from './icons';

export interface MobileAppProps {
  route: Route;
  hash: string;
  properties: Property[];
  requests: CustomerRequest[];
  activity: ActivityEntry[];
  loading: boolean;
  loadError: boolean;
  v2Ready: boolean;
  sync: SyncState;
  staleAt: number | null;
  userName: string;
  currentUser: string;
  officeKey: string;
  presentMode: boolean;
  onTogglePresent: () => void;
  actions: DetailActions;
  onRefresh: () => void;
  onLogout: () => void;
  onCreateRequest: (r: NewRequest) => void;
  onCloseRequest: (r: CustomerRequest) => void;
  onFollowUp: (r: CustomerRequest, f: RequestFollowUp) => void;
  onClearFeed?: () => void; // yalnızca yöneticide dolu
  onListingSaved: (l: NewListing) => void;
  onListingEdited: (id: string, change: Partial<Property>) => void;
  notify: (message: string) => void;
}

// Kaydırma konumu hatırlanan ekranlar: ilandan geri dönünce liste kaldığı yerden açılır
const keepsScroll = (r: Route) => r.name === 'list' || r.name === 'requests';
const scrollKey = (r: Route) => (r.name === 'list' ? 'list' : r.name === 'requests' ? 'requests' : r.name);

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

function BackBar({ title }: { title: string }) {
  return (
    <header className="m-top sticky top-0 z-30 bg-ground border-b border-rule">
      <div className="h-14 px-2 flex items-center gap-1">
        <button onClick={goBack} aria-label="Geri" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-surface">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
    </header>
  );
}

// Telefon kabuğu: altta sabit menü, büyük kartlar, tek elle kullanım
export default function MobileApp(p: MobileAppProps) {
  const { route, hash } = p;
  const [addOpen, setAddOpen] = useState(false);

  // İlanlar ekranı süzgeçleri ve kaydırması, ilan açılıp kapanınca bozulmasın diye hep açık tutulur (gizlenir).
  // Yalnızca adresteki süzgeç değişince (#/?filtre=…) sıfırlanır.
  const [lastPreset, setLastPreset] = useState<ListPreset>({});
  if (
    route.name === 'list' &&
    (route.preset.region !== lastPreset.region || route.preset.quick !== lastPreset.quick || route.preset.nearby !== lastPreset.nearby || route.preset.saved !== lastPreset.saved)
  ) {
    setLastPreset(route.preset);
  }

  const positions = useRef<Record<string, number>>({});
  useEffect(() => {
    let key = scrollKey(parseHash(window.location.hash));
    const onHash = () => {
      positions.current[key] = window.scrollY;
      key = scrollKey(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useLayoutEffect(() => {
    window.scrollTo(0, keepsScroll(route) ? positions.current[scrollKey(route)] ?? 0 : 0);
    // yalnızca adres değişince
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // Son baktığım ilanlar
  const viewedId = route.name === 'detail' ? route.id : null;
  useEffect(() => {
    if (viewedId) rememberView(viewedId);
  }, [viewedId]);

  // Talebe uyan ilanlardan hangileri görüldü: ilk görüşte mevcut olanlar "görülmüş" sayılır (gürültü olmasın),
  // sonradan uyanlar "yeni" olur; Talepler ekranı açılınca hepsi görülmüş olur.
  const seen = useStore(seenMatchesStore);
  const onRequests = route.name === 'requests';
  useEffect(() => {
    if (!p.properties.length || !p.v2Ready) return;
    const next = { ...seen };
    let changed = false;
    for (const r of p.requests) {
      if (r.status !== 'Açık') continue;
      if (next[r.id] && !onRequests) continue;
      const ids = matchesFor(r, p.properties).map((x) => x.id);
      if (!next[r.id] || next[r.id].length !== ids.length || ids.some((id) => !next[r.id].includes(id))) {
        next[r.id] = ids;
        changed = true;
      }
    }
    if (changed) seenMatchesStore.set(next);
  }, [p.requests, p.properties, p.v2Ready, seen, onRequests]);

  const mineKey = p.userName.toLocaleLowerCase('tr');
  const freshMatches = useMemo(() => {
    let n = 0;
    for (const r of p.requests) {
      if (r.status !== 'Açık' || !mineKey || !r.agentName.toLocaleLowerCase('tr').includes(mineKey) || !seen[r.id]) continue;
      n += matchesFor(r, p.properties).filter((x) => !seen[r.id].includes(x.id)).length;
    }
    return n;
  }, [p.requests, p.properties, seen, mineKey]);

  const updateReady = useUpdateReady();

  const matchedRequests = useMemo(
    () => p.requests.filter((r) => r.status === 'Açık' && matchesFor(r, p.properties).length > 0).length,
    [p.requests, p.properties],
  );

  const active: NavTab =
    route.name === 'today' ? 'today'
    : route.name === 'list' || route.name === 'detail' || route.name === 'map' || route.name === 'comps' || route.name === 'report' || route.name === 'edit' ? 'list'
    : route.name === 'requests' || route.name === 'newRequest' ? 'requests'
    : route.name === 'me' || route.name === 'mine' || route.name === 'favorites' || route.name === 'settings' || route.name === 'team' || route.name === 'agent' ? 'me'
    : null;
  const hideNav = route.name === 'new' || route.name === 'newRequest' || route.name === 'brochure' || route.name === 'report';

  const objectId = route.name === 'detail' || route.name === 'brochure' || route.name === 'comps' || route.name === 'report' || route.name === 'edit' ? route.id : null;
  const selected = objectId ? p.properties.find((x) => x.id === objectId) : undefined;
  const notFound = (
    <div className="mx-4 mt-4 rounded-2xl border border-dashed border-control px-4 py-4 text-muted">
      {objectId} numaralı ilan bulunamadı. Sheets'te satır silinmiş ya da sırası değişmiş olabilir.{' '}
      <a href="#/" className="text-ink underline underline-offset-2">İlanlara dön</a>
    </div>
  );

  const updateBanner = updateReady && (
    <div className="px-4 pt-3">
      <div role="status" className="rounded-xl bg-positive-bg text-positive px-4 py-3 text-sm flex items-center gap-3">
        <p className="flex-1">Uygulamanın yeni sürümü hazır.</p>
        <button onClick={() => window.location.reload()} className="h-10 px-4 rounded-full bg-positive text-ground font-semibold shrink-0">
          Yenile
        </button>
      </div>
    </div>
  );

  const offline = (
    <div className="px-4 pt-3 empty:hidden">
      <OfflineBanner staleAt={p.staleAt} />
    </div>
  );

  return (
    <div className={`min-h-dvh bg-ground ${hideNav ? '' : 'm-page'}`}>
      {updateBanner}
      {offline}
      <PullToRefresh onRefresh={p.onRefresh} busy={p.loading} />

      {route.name === 'today' && (
        <MobileToday properties={p.properties} requests={p.requests} activity={p.activity} userName={p.userName} loading={p.loading} actions={p.actions} onRefresh={p.onRefresh} onFollowUp={p.onFollowUp} onClearFeed={p.onClearFeed} />
      )}

      <div className={route.name === 'list' ? '' : 'hidden'}>
        <MobileListings
          key={`${lastPreset.region ?? ''}|${lastPreset.quick ?? ''}|${lastPreset.nearby ? 'y' : ''}|${lastPreset.saved ?? ''}`}
          properties={p.properties}
          requests={p.requests}
          scope="all"
          preset={lastPreset}
          userName={p.userName}
          presentMode={p.presentMode}
          onTogglePresent={p.onTogglePresent}
          loading={p.loading}
          loadError={p.loadError}
          onRefresh={p.onRefresh}
        />
      </div>

      <div className={route.name === 'requests' ? '' : 'hidden'}>
        <MobileRequests requests={p.requests} properties={p.properties} userName={p.userName} ready={p.v2Ready} onClose={p.onCloseRequest} onFollowUp={p.onFollowUp} />
      </div>

      {route.name === 'mine' && (
        <MobileListings properties={p.properties} requests={p.requests} scope="mine" preset={{}} userName={p.userName} presentMode={p.presentMode} onTogglePresent={p.onTogglePresent} loading={p.loading} loadError={p.loadError} onRefresh={p.onRefresh} />
      )}
      {route.name === 'favorites' && (
        <MobileListings properties={p.properties} requests={p.requests} scope="favorites" preset={{}} userName={p.userName} presentMode={p.presentMode} onTogglePresent={p.onTogglePresent} loading={p.loading} loadError={p.loadError} onRefresh={p.onRefresh} />
      )}

      {route.name === 'team' && <MobileTeam properties={p.properties} userEmail={p.currentUser} />}
      {route.name === 'agent' && (
        <MobileListings key={route.agent} properties={p.properties} requests={p.requests} scope="agent" agentName={route.agent} preset={{}} userName={p.userName} presentMode={p.presentMode} onTogglePresent={p.onTogglePresent} loading={p.loading} loadError={p.loadError} onRefresh={p.onRefresh} />
      )}

      {route.name === 'newRequest' && (
        <MobileNewRequest
          properties={p.properties}
          defaultAgentName={p.userName}
          ready={p.v2Ready}
          onCreate={p.onCreateRequest}
          onDone={() => {
            p.notify('Talep kaydedildi.');
            window.location.hash = '#/talepler';
          }}
        />
      )}

      {route.name === 'new' && <MobileNewListing properties={p.properties} defaultAgentName={p.userName} onSaved={p.onListingSaved} />}

      {route.name === 'detail' && (
        <>
          <BackBar title={selected?.id ?? 'İlan'} />
          <div className="px-4 pt-4">
            {selected ? (
              <ListingDetail
                key={selected.id}
                property={selected}
                properties={p.properties}
                presentMode={p.presentMode}
                requests={p.requests}
                activity={p.activity}
                officeKey={p.officeKey}
                v2Ready={p.v2Ready}
                actions={p.actions}
                userName={p.userName}
                currentUser={p.currentUser}
              />
            ) : p.loading ? (
              <p className="text-muted">İlan yükleniyor…</p>
            ) : (
              notFound
            )}
          </div>
        </>
      )}

      {route.name === 'brochure' && (
        <>
          <div className="no-print">
            <BackBar title="Broşür" />
          </div>
          <div className="px-4 pt-4">{selected ? <Brochure property={selected} /> : p.loading ? <p className="text-muted">İlan yükleniyor…</p> : notFound}</div>
        </>
      )}

      {route.name === 'comps' && (
        <>
          <BackBar title="Emsal bak" />
          <div className="px-4 pt-4 pb-24">
            {selected ? (
              <CompsPage property={selected} properties={p.properties} currentUser={p.currentUser} userName={p.userName} notify={p.notify} />
            ) : p.loading ? <p className="text-muted">İlan yükleniyor…</p> : notFound}
          </div>
        </>
      )}

      {route.name === 'edit' && (
        <>
          <BackBar title="İlanı düzenle" />
          <div className="px-4 pt-4">
            {selected ? (
              <EditListing key={selected.id} property={selected} currentUser={p.currentUser} userName={p.userName} onSaved={p.onListingEdited} />
            ) : p.loading ? <p className="text-muted">İlan yükleniyor…</p> : notFound}
          </div>
        </>
      )}

      {route.name === 'report' && (
        <>
          <div className="no-print">
            <BackBar title="Değerleme raporu" />
          </div>
          <div className="px-4 pt-4">
            {selected ? (
              <ValuationReport property={selected} properties={p.properties} userName={p.userName} currentUser={p.currentUser} />
            ) : p.loading ? <p className="text-muted">İlan yükleniyor…</p> : notFound}
          </div>
        </>
      )}

      {route.name === 'map' && (
        <div className="m-top px-4 pt-4">
          <Maps properties={p.properties} />
        </div>
      )}

      {route.name === 'me' && (
        <MobileMe
          properties={p.properties}
          userName={p.userName}
          userEmail={p.currentUser}
          sync={p.sync}
          presentMode={p.presentMode}
          onTogglePresent={p.onTogglePresent}
          onRefresh={p.onRefresh}
          onLogout={p.onLogout}
        />
      )}

      {route.name === 'settings' && (
        <>
          <BackBar title="Ayarlar" />
          <div className="px-4 pt-4">
            <Settings userName={p.userName} userEmail={p.currentUser} sync={p.sync} onRefresh={p.onRefresh} onLogout={p.onLogout} />
          </div>
        </>
      )}

      {!hideNav && <BottomNav active={active} requestBadge={matchedRequests} todayBadge={freshMatches} onAdd={() => setAddOpen(true)} />}
      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
    </div>
  );
}
