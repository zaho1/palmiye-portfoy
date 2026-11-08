import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ActivityEntry, CustomerRequest, Property } from '../../types';
import type { NewListing, NewRequest } from '../../lib/sheets';
import { matchesFor } from '../../lib/match';
import { parseHash, type Route } from '../../lib/route';
import ListingDetail, { type DetailActions } from '../ListingDetail';
import type { ListPreset } from '../ListingList';
import Maps from '../Maps';
import Settings from '../Settings';
import Brochure from '../Brochure';
import OfflineBanner from '../OfflineBanner';
import type { SyncState } from '../Sidebar';
import BottomNav, { type NavTab } from './BottomNav';
import AddSheet from './AddSheet';
import MobileListings from './MobileListings';
import MobileRequests from './MobileRequests';
import MobileNewRequest from './MobileNewRequest';
import MobileNewListing from './MobileNewListing';
import MobileMe from './MobileMe';
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
  onListingSaved: (l: NewListing) => void;
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
  if (route.name === 'list' && (route.preset.region !== lastPreset.region || route.preset.quick !== lastPreset.quick)) {
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

  const matchedRequests = useMemo(
    () => p.requests.filter((r) => r.status === 'Açık' && matchesFor(r, p.properties).length > 0).length,
    [p.requests, p.properties],
  );

  const active: NavTab =
    route.name === 'list' || route.name === 'detail' ? 'list'
    : route.name === 'requests' || route.name === 'newRequest' ? 'requests'
    : route.name === 'map' ? 'map'
    : route.name === 'me' || route.name === 'mine' || route.name === 'favorites' || route.name === 'settings' ? 'me'
    : null;
  const hideNav = route.name === 'new' || route.name === 'newRequest' || route.name === 'brochure';

  const objectId = route.name === 'detail' || route.name === 'brochure' ? route.id : null;
  const selected = objectId ? p.properties.find((x) => x.id === objectId) : undefined;
  const notFound = (
    <div className="mx-4 mt-4 rounded-2xl border border-dashed border-control px-4 py-4 text-muted">
      {objectId} numaralı ilan bulunamadı. Sheets'te satır silinmiş ya da sırası değişmiş olabilir.{' '}
      <a href="#/" className="text-ink underline underline-offset-2">İlanlara dön</a>
    </div>
  );

  const offline = (
    <div className="px-4 pt-3 empty:hidden">
      <OfflineBanner staleAt={p.staleAt} />
    </div>
  );

  return (
    <div className={`min-h-dvh bg-ground ${hideNav ? '' : 'm-page'}`}>
      {offline}

      <div className={route.name === 'list' ? '' : 'hidden'}>
        <MobileListings
          key={`${lastPreset.region ?? ''}|${lastPreset.quick ?? ''}`}
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
        <MobileRequests requests={p.requests} properties={p.properties} userName={p.userName} ready={p.v2Ready} onClose={p.onCloseRequest} />
      </div>

      {route.name === 'mine' && (
        <MobileListings properties={p.properties} requests={p.requests} scope="mine" preset={{}} userName={p.userName} presentMode={p.presentMode} onTogglePresent={p.onTogglePresent} loading={p.loading} loadError={p.loadError} onRefresh={p.onRefresh} />
      )}
      {route.name === 'favorites' && (
        <MobileListings properties={p.properties} requests={p.requests} scope="favorites" preset={{}} userName={p.userName} presentMode={p.presentMode} onTogglePresent={p.onTogglePresent} loading={p.loading} loadError={p.loadError} onRefresh={p.onRefresh} />
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

      {!hideNav && <BottomNav active={active} requestBadge={matchedRequests} onAdd={() => setAddOpen(true)} />}
      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
    </div>
  );
}
