import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Menu, MessageCircle, Phone, Search, X } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, ListingStatus, Property } from './types';
import {
  addNote,
  addRequest,
  cacheInfo,
  closeRequest,
  deleteNote,
  fetchActivity,
  fetchProperties,
  fetchRequests,
  formatLocation,
  formatPhone,
  phoneDigits,
  recordSale,
  setApiUser,
  setLocation,
  touchListing,
  updatePrice,
  updateStatus,
  type NewListing,
  type NewRequest,
  type SaleRecord,
} from './lib/sheets';
import { cleanActivity, forgetPatch, mergeProperties, rememberAdd, rememberDeletedNote, rememberPatch } from './lib/pending';
import { matchesFor } from './lib/match';
import { OFFICE_AUTH_CONFIG } from './config/auth';
import { parseHash, type Route } from './lib/route';
import { clearOfflineData, isMobileViewport, useIsMobile } from './lib/pwa';
import { clearPersonal } from './lib/personal';
import Login from './components/Login';
import ListingList from './components/ListingList';
import ListingDetail, { type DetailActions } from './components/ListingDetail';
import AddListing from './components/AddListing';
import Requests from './components/Requests';
import Maps from './components/Maps';
import Settings from './components/Settings';
import Brochure from './components/Brochure';
import Sidebar, { type SyncState } from './components/Sidebar';
import Notifications from './components/Notifications';
import Toast, { type ToastState } from './components/Toast';
import OfflineBanner from './components/OfflineBanner';
import MobileApp from './components/mobile/MobileApp';

// Yeni eklenen ilan Sheets'ten dönmeden listede hemen görünsün diye geçici kayıt
function listingToProperty(l: NewListing, fallbackAgent: string): Property {
  const loc = l.location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return {
    id: `YENİ-${Date.now().toString(36).toUpperCase()}`,
    title: l.title.trim() || 'Başlıksız ilan',
    price: l.price,
    category: l.category,
    imarStatus: l.imarStatus,
    size: l.size,
    description: l.description,
    imageUrl: l.images[0],
    images: l.images,
    sahibindenUrl: l.sahibindenUrl,
    adaParsel: l.adaParsel,
    agentName: l.agentName || fallbackAgent,
    agentPhone: l.agentPhone,
    whatsappUrl: l.whatsappUrl,
    status: 'Aktif',
    region: l.region || 'Belirtilmemiş',
    neighborhood: l.neighborhood,
    rooms: l.rooms,
    floor: l.floor,
    buildingAge: l.buildingAge,
    heating: l.heating,
    features: l.features,
    oldPrice: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(loc ? { lat: parseFloat(loc[1]), lng: parseFloat(loc[2]) } : {}),
  };
}

const STATUS_DONE: Record<ListingStatus, string> = {
  Aktif: 'aktife alındı',
  Pasif: 'pasife alındı',
  Satıldı: 'satıldı / kiralandı olarak işaretlendi',
  Silindi: 'silindi',
};

// "Beni hatırla" seçiliyse localStorage, değilse yalnızca bu sekme (sessionStorage)
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => readStored('palmiye_user'));
  const [officeKey, setOfficeKey] = useState(() => readStored('palmiye_key') ?? '');
  const [properties, setProperties] = useState<Property[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [v2Ready, setV2Ready] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const [searchTerm, setSearchTerm] = useState('');
  const [presentMode, setPresentMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const rawRoute = useMemo(() => parseHash(hash), [hash]);
  // #/talep/yeni ve #/ben yalnızca telefon ekranlarıdır; masaüstünde karşılığı olan sayfaya düşer
  const route = useMemo<Route>(
    () =>
      isMobile
        ? rawRoute
        : rawRoute.name === 'newRequest'
          ? { name: 'requests' }
          : rawRoute.name === 'me'
            ? { name: 'settings' }
            : rawRoute.name === 'today'
              ? { name: 'list', preset: {} }
              : rawRoute,
    [isMobile, rawRoute],
  );

  const userName = useMemo(
    () => OFFICE_AUTH_CONFIG.allowedUsers.find((u) => u.email === currentUser)?.name ?? currentUser ?? '',
    [currentUser],
  );

  useEffect(() => {
    setApiUser(currentUser ?? '');
  }, [currentUser]);

  // Telefonda uygulama ilk açıldığında (adres boşken) Bugün ekranı gelir
  useEffect(() => {
    if (currentUser && isMobileViewport() && (window.location.hash === '' || window.location.hash === '#')) {
      window.history.replaceState(null, '', '#/bugun');
      setHash('#/bugun');
    }
  }, [currentUser]);

  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setMenuOpen(false);
      // Telefon kabuğu kaydırmayı kendisi yönetir (listeye dönünce kaldığı yerden açılır)
      if (!isMobileViewport()) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // State yalnızca cevap gelince değişir; "yükleniyor" durumunu çağıran taraf açar.
  const fetchAll = useCallback(() => {
    fetchProperties()
      .then((rows) => {
        // Sheets henüz işlemediyse cihazda bekleyen değişiklikler üstüne uygulanır (gidip gelme olmaz)
        setProperties(mergeProperties(rows));
        setLoadedAt(new Date());
        setLoadError(false);
        setStaleAt(cacheInfo.listingsAt);
      })
      .catch((err) => {
        console.error('Google Sheets yüklenirken hata oluştu:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
    // Talepler ve hareketler v2 Apps Script ile gelir; yoksa panel yine çalışır.
    Promise.all([fetchRequests(), fetchActivity()])
      .then(([reqs, log]) => {
        setRequests(reqs);
        setActivity(cleanActivity(log));
        setV2Ready(true);
      })
      .catch((err) => {
        console.warn('Talepler / hareketler okunamadı (Apps Script v2 yayınlandı mı?):', err);
        setV2Ready(false);
      });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (currentUser) fetchAll();
  }, [currentUser, fetchAll]);

  // Diğer danışmanların değişiklikleri de gelsin: sekmeye dönünce ve 2 dakikada bir sessizce yenile
  useEffect(() => {
    if (!currentUser) return;
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(onFocus, 120_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(timer);
    };
  }, [currentUser, fetchAll]);

  const handleLoginSuccess = (email: string, password: string, remember: boolean) => {
    try {
      const store = remember ? localStorage : sessionStorage;
      store.setItem('palmiye_user', email);
      store.setItem('palmiye_key', password);
    } catch {
      /* depolama kapalıysa oturum yalnızca bu sekmede açık kalır */
    }
    setOfficeKey(password);
    setLoading(true);
    setCurrentUser(email);
  };

  const handleLogout = () => {
    ['palmiye_user', 'palmiye_key'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    clearOfflineData();
    clearPersonal();
    setCurrentUser(null);
    setOfficeKey('');
    window.location.hash = '';
  };

  const logLocal = useCallback(
    (action: string, title: string, detail = '') =>
      setActivity((prev) => [{ at: new Date(), who: currentUser ?? '', action, title, detail }, ...prev]),
    [currentUser],
  );

  const patch = useCallback((id: string, change: Partial<Property>) => {
    setProperties((prev) => prev.map((x) => (x.id === id ? { ...x, ...change } : x)));
  }, []);

  // Önce ekranda güncellenir, sonra Sheets'e yazılır; yazılamazsa eski hâline döner.
  const write = useCallback(async (call: () => Promise<void>, rollback: () => void, what: string) => {
    try {
      await call();
      // Sheets'e işlendikten sonra gerçek veriyle eşitle
      window.setTimeout(fetchAll, 4000);
    } catch (error) {
      console.error('Google Sheets güncelleme hatası:', error);
      rollback();
      setToast({ message: `${what} Sheets'e yazılamadı. İnternet bağlantısını kontrol edip tekrar deneyin.` });
    }
  }, [fetchAll]);

  const applyStatus = useCallback(
    (p: Property, status: ListingStatus) => {
      const before = { status: p.status, updatedAt: p.updatedAt };
      patch(p.id, { status, updatedAt: new Date() });
      rememberPatch(p.title, { status });
      logLocal(`Durum: ${status}`, p.title);
      write(
        () => updateStatus(p.title, status),
        () => {
          forgetPatch(p.title);
          patch(p.id, before);
        },
        p.id,
      );
    },
    [patch, logLocal, write],
  );

  const changeStatus = useCallback(
    (p: Property, status: ListingStatus) => {
      const previous = p.status;
      setToast({
        message: `${p.id} ${STATUS_DONE[status]}.`,
        undo: () => {
          applyStatus({ ...p, status }, previous);
          setToast({ message: `${p.id} eski durumuna (${previous}) döndü.` });
        },
      });
      applyStatus(p, status);
    },
    [applyStatus],
  );

  const actions = useMemo<DetailActions>(
    () => ({
      status: changeStatus,
      sold: (p: Property, sale: SaleRecord) => {
        const before = { status: p.status, updatedAt: p.updatedAt };
        patch(p.id, { status: 'Satıldı', updatedAt: new Date() });
        rememberPatch(p.title, { status: 'Satıldı' });
        logLocal('Satıldı / kiralandı', p.title, [sale.price, sale.broughtBy].filter(Boolean).join(' · '));
        setToast({
          message: `${p.id} satış kaydı Sheets'e yazıldı.`,
          undo: () => {
            applyStatus({ ...p, status: 'Satıldı' }, before.status);
            setToast({ message: `${p.id} eski durumuna döndü. Satışlar sayfasındaki kaydı elle silin.` });
          },
        });
        write(() => recordSale(p.title, sale), () => { forgetPatch(p.title); patch(p.id, before); }, p.id);
      },
      touch: (p: Property) => {
        const before = { updatedAt: p.updatedAt };
        patch(p.id, { updatedAt: new Date() });
        logLocal('Güncel olduğu teyit edildi', p.title);
        setToast({ message: `${p.id} güncel olarak işaretlendi.` });
        write(() => touchListing(p.title), () => patch(p.id, before), p.id);
      },
      price: (p: Property, price: string) => {
        const before = { price: p.price, oldPrice: p.oldPrice, updatedAt: p.updatedAt };
        patch(p.id, { price, oldPrice: String(p.price), updatedAt: new Date() });
        rememberPatch(p.title, { price });
        logLocal('Fiyat değişti', p.title, `${p.price} → ${price}`);
        setToast({ message: `${p.id} fiyatı güncellendi.` });
        write(() => updatePrice(p.title, price), () => patch(p.id, before), p.id);
      },
      note: (p: Property, text: string) => {
        logLocal('Not', p.title, text);
        write(() => addNote(p.title, text), () => setActivity((prev) => prev.slice(1)), 'Not');
      },
      deleteNote: (p: Property, entry: ActivityEntry) => {
        const key = entry.noteId || entry.detail;
        rememberDeletedNote(p.title, key);
        if (entry.detail) rememberDeletedNote(p.title, entry.detail);
        setActivity((prev) => prev.filter((a) => a !== entry && !(a.action === 'Not' && a.title === p.title && (a.noteId ? a.noteId === entry.noteId : a.detail === entry.detail))));
        setToast({ message: 'Not silindi.' });
        write(() => deleteNote(p.title, key), () => setToast({ message: 'Not silinemedi.' }), 'Not');
      },
      location: (p: Property, lat: number, lng: number) => {
        const before = { lat: p.lat, lng: p.lng };
        patch(p.id, { lat, lng });
        rememberPatch(p.title, { lat, lng });
        logLocal('Konum işaretlendi', p.title, formatLocation(lat, lng));
        setToast({ message: `${p.id} konumu kaydedildi.` });
        write(() => setLocation(p.title, formatLocation(lat, lng)), () => patch(p.id, before), p.id);
      },
    }),
    [changeStatus, patch, logLocal, write, applyStatus],
  );

  const createRequest = useCallback(
    (r: NewRequest) => {
      const local: CustomerRequest = {
        id: `yeni-${Date.now()}`,
        createdAt: new Date(),
        status: 'Açık',
        agentName: r.agentName,
        deal: r.deal,
        kind: r.kind,
        region: r.region,
        rooms: r.rooms,
        maxPrice: parseInt(r.maxPrice.replace(/[^0-9]/g, '') || '0', 10),
        minSize: parseInt(r.minSize.replace(/[^0-9]/g, '') || '0', 10),
        note: r.note,
      };
      setRequests((prev) => [local, ...prev]);
      logLocal('Müşteri talebi eklendi', '', r.note);
      write(() => addRequest(r), () => setRequests((prev) => prev.filter((x) => x.id !== local.id)), 'Talep');
    },
    [logLocal, write],
  );

  const finishRequest = useCallback(
    (r: CustomerRequest) => {
      setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'Kapandı' } : x)));
      setToast({ message: 'Talep kapatıldı.' });
      write(() => closeRequest(r.id), () => setRequests((prev) => prev.map((x) => (x.id === r.id ? r : x))), 'Talep');
    },
    [write],
  );

  // Yeni ilan Sheets'e gönderildikten sonra: listede hemen görünsün, cihazda "bekleyen" olarak tutulsun
  const handleListingSaved = useCallback(
    (l: NewListing) => {
      const local = listingToProperty(l, userName);
      rememberAdd(local);
      setProperties((prev) => [...prev.filter((x) => x.title.trim() !== local.title.trim()), local]);
      logLocal('İlan eklendi', local.title, String(local.price));
      window.location.hash = '#/';
      setToast({ message: 'İlan eklendi.' });
      window.setTimeout(fetchAll, 4000);
    },
    [userName, logLocal, fetchAll],
  );

  const matchedRequestCount = useMemo(
    () => requests.filter((r) => r.status === 'Açık' && matchesFor(r, properties).length > 0).length,
    [requests, properties],
  );

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const sync: SyncState = { loading, error: loadError, v2Ready, loadedAt };

  if (isMobile) {
    return (
      <>
        <MobileApp
          route={route}
          hash={hash}
          properties={properties}
          requests={requests}
          activity={activity}
          loading={loading}
          loadError={loadError}
          v2Ready={v2Ready}
          sync={sync}
          staleAt={staleAt}
          userName={userName}
          currentUser={currentUser}
          officeKey={officeKey}
          presentMode={presentMode}
          onTogglePresent={() => setPresentMode((v) => !v)}
          actions={actions}
          onRefresh={load}
          onLogout={handleLogout}
          onCreateRequest={createRequest}
          onCloseRequest={finishRequest}
          onListingSaved={handleListingSaved}
          notify={(message) => setToast({ message })}
        />
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </>
    );
  }
  const isList = route.name === 'list' || route.name === 'mine' || route.name === 'favorites';
  const objectId = route.name === 'detail' || route.name === 'brochure' ? route.id : null;
  const selected = objectId ? properties.find((p) => p.id === objectId) : undefined;
  const pageName: Record<string, string> = {
    requests: 'Müşteri talepleri',
    map: 'Harita',
    settings: 'Ayarlar',
  };

  const sidebar = (
    <Sidebar
      hash={hash}
      properties={properties}
      userName={userName}
      userEmail={currentUser}
      matchedRequests={matchedRequestCount}
      sync={sync}
      onRefresh={load}
      onLogout={handleLogout}
    />
  );

  const searchInput = (id: string, cls: string) => (
    <div className={`relative ${cls}`}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">İlan ara</label>
      <input
        id={id}
        type="search"
        placeholder="Başlık, mahalle, ada/parsel, danışman, ilan no"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="field h-9 pl-9 bg-surface border-transparent"
      />
    </div>
  );

  const notFound = (
    <div className="rounded-lg border border-dashed border-control px-4 py-3 text-muted">
      {objectId} numaralı ilan bulunamadı. Sheets'te satır silinmiş ya da sırası değişmiş olabilir.{' '}
      <a href="#/" className="text-ink underline underline-offset-2">Portföye dön</a>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Kenar menü: zeminle aynı renk, yalnızca 1px çizgiyle ayrılır */}
      <aside className="no-print hidden lg:block sticky top-0 h-screen border-r border-rule">{sidebar}</aside>

      <div className="min-w-0">
        {/* Üst çubuk */}
        <header className="no-print sticky top-0 z-30 bg-ground h-14 lg:h-16 border-b border-rule flex items-center gap-3 px-4 lg:px-[29px]">
          <a href="#/" className="lg:hidden flex items-center gap-2 shrink-0" aria-label="Palmiye Yatırım portföy">
            <img src="/logo.png" alt="" className="h-7 w-auto logo-chip" />
          </a>

          {objectId || route.name === 'new' ? (
            <a href="#/" className="flex items-center gap-2 text-sm text-muted hover:text-ink min-w-0">
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="truncate">Portföye dön</span>
            </a>
          ) : isList ? (
            searchInput('search', 'flex-1 max-w-[420px] hidden sm:block')
          ) : (
            <span className="text-sm text-muted">{pageName[route.name]}</span>
          )}

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
            <Notifications properties={properties} requests={requests} userName={userName} />
            <button
              onClick={() => setPresentMode((v) => !v)}
              aria-pressed={presentMode}
              title="Müşteri yanındayken ada/parsel ve ofis içi bilgileri gizler"
              className={`h-9 px-3 rounded-full border text-sm flex items-center gap-2 transition-colors ${
                presentMode ? 'border-ink text-ink' : 'border-control text-muted hover:text-ink'
              }`}
            >
              {presentMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{presentMode ? 'Sunum modu açık' : 'Sunum modu'}</span>
            </button>
            <button onClick={() => setMenuOpen(true)} aria-label="Menüyü aç" className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Telefon: arama üst çubuğa sığmadığı için içerikte */}
        {isList && <div className="no-print sm:hidden px-4 pt-4">{searchInput('search-m', '')}</div>}

        <main className="px-4 lg:px-[29px] pt-6 pb-16 print:p-0">
          <OfflineBanner staleAt={staleAt} />
          {!v2Ready && route.name === 'requests' && (
            <p className="mb-6 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
              Talepler, hareket geçmişi ve ofis içi bilgiler, ofis yöneticisi Google Sheets'teki Apps Script'in yeni sürümünü yayınlayınca açılır. İlanlar normal çalışıyor.
            </p>
          )}

          {route.name === 'new' ? (
            <AddListing
              properties={properties}
              defaultAgentName={userName}
              onSaved={handleListingSaved}
            />
          ) : route.name === 'requests' ? (
            <Requests requests={requests} properties={properties} defaultAgentName={userName} ready={v2Ready} onCreate={createRequest} onClose={finishRequest} />
          ) : route.name === 'map' ? (
            <Maps properties={properties} />
          ) : route.name === 'settings' ? (
            <Settings userName={userName} userEmail={currentUser} sync={sync} onRefresh={load} onLogout={handleLogout} />
          ) : route.name === 'brochure' ? (
            selected ? <Brochure property={selected} /> : loading ? <p className="text-muted">İlan yükleniyor…</p> : notFound
          ) : route.name === 'detail' ? (
            selected ? (
              <ListingDetail
                key={selected.id}
                property={selected}
                properties={properties}
                presentMode={presentMode}
                requests={requests}
                activity={activity}
                officeKey={officeKey}
                v2Ready={v2Ready}
                actions={actions}
                userName={userName}
                currentUser={currentUser ?? ''}
              />
            ) : loading ? (
              <p className="text-muted">İlan yükleniyor…</p>
            ) : (
              notFound
            )
          ) : (
            <>
              <ListingList
                key={hash}
                properties={properties}
                requests={requests}
                activity={activity}
                scope={route.name === 'mine' ? 'mine' : route.name === 'favorites' ? 'favorites' : 'all'}
                preset={route.name === 'list' ? route.preset : {}}
                userName={userName}
                searchTerm={searchTerm}
                presentMode={presentMode}
                loading={loading}
                loadError={loadError}
                onRetry={load}
              />

              {/* Danışman Paneli - Ana Sayfa Altında */}
              {route.name === 'list' && (
                <div className="mt-8 border-t border-rule pt-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="text-lg font-bold">Danışman Paneli</h3>
                    <input
                      type="text"
                      placeholder="Danışman ara..."
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      className="field h-8 !w-48 !text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {OFFICE_AUTH_CONFIG.allowedUsers
                      .filter((user) => !agentSearch.trim() || user.name.toLocaleLowerCase('tr').includes(agentSearch.toLocaleLowerCase('tr')))
                      .map((user) => {
                      const agentCount = properties.filter(p => p.agentName === user.name && p.status === 'Aktif').length;
                      const agentPhone = user.phone || properties.find(p => p.agentName === user.name && p.agentPhone)?.agentPhone || '';
                      const digits = phoneDigits(agentPhone);
                      const btn = 'flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors';
                      return (
                        <div key={user.email} className="bg-surface rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-positive-bg rounded-full flex items-center justify-center shrink-0">
                              <span className="text-positive font-bold">{user.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{user.name}</p>
                              <p className="text-xs text-muted truncate">{agentPhone ? formatPhone(agentPhone) : 'Telefon eklenmemiş'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-accent leading-none num">{agentCount}</p>
                              <p className="text-[11px] text-muted mt-1">aktif ilan</p>
                            </div>
                          </div>
                          {digits ? (
                            <div className="flex gap-2">
                              <a href={`tel:+${digits}`} className={`${btn} bg-raised text-muted hover:text-ink hover:bg-active`}>
                                <Phone className="w-4 h-4" /> Ara
                              </a>
                              <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={`${btn} bg-positive-bg text-positive hover:opacity-90`}>
                                <MessageCircle className="w-4 h-4" /> WhatsApp
                              </a>
                            </div>
                          ) : (
                            <div className="flex gap-2" title="Numara src/config/auth.ts içine eklenince açılır">
                              <span className={`${btn} bg-raised text-faint cursor-not-allowed`}><Phone className="w-4 h-4" /> Ara</span>
                              <span className={`${btn} bg-raised text-faint cursor-not-allowed`}><MessageCircle className="w-4 h-4" /> WhatsApp</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Telefon menüsü: sol panelin aynısı, tam ekran */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ground lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <button onClick={() => setMenuOpen(false)} aria-label="Menüyü kapat" className="absolute right-3 top-3 z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface">
            <X className="w-5 h-5" />
          </button>
          {sidebar}
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
