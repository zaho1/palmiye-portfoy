import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Menu, MessageCircle, Phone, Search, X } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, ListingStatus, Property } from './types';
import {
  addNote,
  addRequest,
  closeRequest,
  deleteNote,
  fetchActivity,
  fetchProperties,
  fetchRequests,
  formatLocation,
  recordSale,
  setApiUser,
  setLocation,
  touchListing,
  updatePrice,
  updateStatus,
  type NewRequest,
  type SaleRecord,
} from './lib/sheets';
import { matchesFor } from './lib/match';
import { OFFICE_AUTH_CONFIG } from './config/auth';
import Login from './components/Login';
import ListingList, { type ListPreset } from './components/ListingList';
import ListingDetail, { type DetailActions } from './components/ListingDetail';
import AddListing from './components/AddListing';
import Requests from './components/Requests';
import Maps from './components/Maps';
import Settings from './components/Settings';
import Brochure from './components/Brochure';
import Sidebar, { type SyncState } from './components/Sidebar';
import Notifications from './components/Notifications';
import Toast, { type ToastState } from './components/Toast';

type Route =
  | { name: 'list'; preset: ListPreset }
  | { name: 'mine' }
  | { name: 'favorites' }
  | { name: 'new' }
  | { name: 'requests' }
  | { name: 'map' }
  | { name: 'settings' }
  | { name: 'detail'; id: string }
  | { name: 'brochure'; id: string };

// Hash yönlendirme: tarayıcının geri tuşu çalışır, linkler paylaşılabilir.
// Liste filtreleri: #/?bolge=Altınova, #/?filtre=teyitsiz|yeni|eksik|indirim
function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('ilan/')) return { name: 'detail', id: decodeURIComponent(h.slice(5)) };
  if (h.startsWith('brosur/')) return { name: 'brochure', id: decodeURIComponent(h.slice(7)) };
  if (h === 'yeni') return { name: 'new' };
  if (h === 'benim') return { name: 'mine' };
  if (h === 'favoriler') return { name: 'favorites' };
  if (h === 'talepler') return { name: 'requests' };
  if (h === 'harita') return { name: 'map' };
  if (h === 'ayarlar') return { name: 'settings' };
  const q = new URLSearchParams(h.startsWith('?') ? h.slice(1) : '');
  const quick = q.get('filtre');
  return {
    name: 'list',
    preset: {
      region: q.get('bolge') ?? undefined,
      quick: quick === 'teyitsiz' || quick === 'yeni' || quick === 'eksik' || quick === 'indirim' ? quick : undefined,
    },
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
  const route = useMemo(() => parseHash(hash), [hash]);

  const userName = useMemo(
    () => OFFICE_AUTH_CONFIG.allowedUsers.find((u) => u.email === currentUser)?.name ?? currentUser ?? '',
    [currentUser],
  );

  useEffect(() => {
    setApiUser(currentUser ?? '');
  }, [currentUser]);

  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // State yalnızca cevap gelince değişir; "yükleniyor" durumunu çağıran taraf açar.
  const fetchAll = useCallback(() => {
    fetchProperties()
      .then((rows) => {
        setProperties(rows);
        setLoadedAt(new Date());
        setLoadError(false);
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
        setActivity(log);
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
    } catch (error) {
      console.error('Google Sheets güncelleme hatası:', error);
      rollback();
      setToast({ message: `${what} Sheets'e yazılamadı. İnternet bağlantısını kontrol edip tekrar deneyin.` });
    }
  }, []);

  const applyStatus = useCallback(
    (p: Property, status: ListingStatus) => {
      const before = { status: p.status, updatedAt: p.updatedAt };
      patch(p.id, { status, updatedAt: new Date() });
      logLocal(`Durum: ${status}`, p.title);
      write(() => updateStatus(p.title, status), () => patch(p.id, before), p.id);
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
        logLocal('Satıldı / kiralandı', p.title, [sale.price, sale.broughtBy].filter(Boolean).join(' · '));
        setToast({
          message: `${p.id} satış kaydı Sheets'e yazıldı.`,
          undo: () => {
            applyStatus({ ...p, status: 'Satıldı' }, before.status);
            setToast({ message: `${p.id} eski durumuna döndü. Satışlar sayfasındaki kaydı elle silin.` });
          },
        });
        write(() => recordSale(p.title, sale), () => patch(p.id, before), p.id);
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
        logLocal('Fiyat değişti', p.title, `${p.price} → ${price}`);
        setToast({ message: `${p.id} fiyatı güncellendi.` });
        write(() => updatePrice(p.title, price), () => patch(p.id, before), p.id);
      },
      note: (p: Property, text: string) => {
        logLocal('Not', p.title, text);
        write(() => addNote(p.title, text), () => setActivity((prev) => prev.slice(1)), 'Not');
      },
      deleteNote: (p: Property, noteId: string) => {
        setActivity((prev) => prev.filter((a) => !(a.action === 'Not' && a.title === p.title && a.detail === noteId)));
        write(() => deleteNote(p.title, noteId), () => setToast({ message: 'Not silinemedi.' }), 'Not');
      },
      location: (p: Property, lat: number, lng: number) => {
        const before = { lat: p.lat, lng: p.lng };
        patch(p.id, { lat, lng });
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

  const matchedRequestCount = useMemo(
    () => requests.filter((r) => r.status === 'Açık' && matchesFor(r, properties).length > 0).length,
    [requests, properties],
  );

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const sync: SyncState = { loading, error: loadError, v2Ready, loadedAt };
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
          {!v2Ready && route.name === 'requests' && (
            <p className="mb-6 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
              Talepler, hareket geçmişi ve ofis içi bilgiler, ofis yöneticisi Google Sheets'teki Apps Script'in yeni sürümünü yayınlayınca açılır. İlanlar normal çalışıyor.
            </p>
          )}

          {route.name === 'new' ? (
            <AddListing
              properties={properties}
              defaultAgentName={userName}
              onSaved={() => {
                load();
                window.location.hash = '#/';
                setToast({ message: "İlan Sheets'e gönderildi. Listede birkaç saniye içinde görünür; görünmezse Yenile'ye basın." });
              }}
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
                      const agentPhone = properties.find(p => p.agentName === user.name)?.agentPhone || '';
                      return (
                        <div key={user.email} className="bg-surface rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-positive-bg rounded-full flex items-center justify-center">
                              <span className="text-positive font-bold">{user.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{user.name}</p>
                              <p className="text-xs text-muted truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted">Aktif Portföy</span>
                            <span className="text-lg font-bold text-accent">{agentCount}</span>
                          </div>
                          <div className="flex gap-2">
                            {agentPhone && (
                              <>
                                <a href={`tel:${agentPhone.replace(/[^0-9+]/g, '')}`} className="flex-1 h-8 rounded-lg bg-raised flex items-center justify-center gap-2 text-sm text-muted hover:text-ink hover:bg-active transition-colors">
                                  <Phone className="w-4 h-4" /> Ara
                                </a>
                                <a href={`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 h-8 rounded-lg bg-raised flex items-center justify-center gap-2 text-sm text-muted hover:text-ink hover:bg-active transition-colors">
                                  <MessageCircle className="w-4 h-4" /> WhatsApp
                                </a>
                              </>
                            )}
                          </div>
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
