import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Lock, MapPin, MessageCircle, Phone, RotateCcw, Share2, Trash2 } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, ListingStatus, OwnerInfo, Property } from '../types';
import {
  coordsOf,
  customerShareText,
  phoneDigits,
  daysSince,
  fetchOwner,
  formatDateTime,
  formatPhone,
  formatPrice,
  isRent,
  isStale,
  parseSize,
  priceDropped,
  pricePerM2,
  relativeDay,
  saveOwner,
  whatsappUrl,
  type SaleRecord,
} from '../lib/sheets';
import { requestsFor } from '../lib/match';
import { useSettings } from '../lib/settings';
import { StatusPill, Thumb } from './ui';
import Dialog, { btnDanger, btnPrimary, btnSecondary } from './Dialog';
import MapView from './MapView';
import { FavoriteButton } from './ListingList';

export interface DetailActions {
  status: (p: Property, s: ListingStatus) => void;
  sold: (p: Property, sale: SaleRecord) => void;
  touch: (p: Property) => void;
  price: (p: Property, price: string) => void;
  note: (p: Property, text: string) => void;
  deleteNote: (p: Property, noteId: string) => void;
  location: (p: Property, lat: number, lng: number) => void;
}

interface Props {
  property: Property;
  properties: Property[];
  presentMode: boolean;
  requests: CustomerRequest[];
  activity: ActivityEntry[];
  officeKey: string;
  v2Ready: boolean;
  actions: DetailActions;
  userName: string;
}

type Pending = null | 'share' | 'sold' | 'delete' | 'price' | 'owner';

const SALE_SOURCES = ['Sahibinden', 'Instagram', 'Tabela / ofis', 'Tavsiye', 'Portföy paylaşımı', 'Diğer'];
const EMPTY_OWNER: OwnerInfo = { name: '', phone: '', authorization: '', authorizationEnd: '', commission: '', keyLocation: '', note: '' };

export default function ListingDetail({ property: p, properties, presentMode, requests, activity, officeKey, v2Ready, actions, userName }: Props) {
  const images = p.images?.length ? p.images : [];
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [copied, setCopied] = useState(false);
  const [newPrice, setNewPrice] = useState(String(p.price));
  const [sale, setSale] = useState<SaleRecord>({ listPrice: String(p.price), price: String(p.price), broughtBy: p.agentName, source: SALE_SOURCES[0] });
  const [note, setNote] = useState('');
  const canSeeOwner = !!officeKey && v2Ready;
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [ownerState, setOwnerState] = useState<'loading' | 'ready' | 'error'>(canSeeOwner ? 'loading' : 'error');
  const [ownerDraft, setOwnerDraft] = useState<OwnerInfo>(EMPTY_OWNER);
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const { settings } = useSettings();
  const closeDialog = useCallback(() => setPending(null), []);

  const prev = useCallback(() => setIndex((i) => (i === 0 ? images.length - 1 : i - 1)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i === images.length - 1 ? 0 : i + 1)), [images.length]);

  // Galeride klavye okları, ancak bir pencere açık değilken
  useEffect(() => {
    if (pending || images.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, images.length, prev, next]);

  // Mal sahibi bilgisi yayınlanmayan sayfadan, ofis şifresiyle gelir
  useEffect(() => {
    if (!canSeeOwner) return;
    let live = true;
    fetchOwner(p.title, officeKey)
      .then((o) => {
        if (!live) return;
        setOwner(o);
        setOwnerState('ready');
      })
      .catch(() => live && setOwnerState('error'));
    return () => {
      live = false;
    };
  }, [p.title, officeKey, canSeeOwner]);

  const agents = useMemo(() => Array.from(new Set(properties.map((x) => x.agentName))).sort((a, b) => a.localeCompare(b, 'tr')), [properties]);
  const matched = useMemo(() => requestsFor(p, requests), [p, requests]);
  const history = useMemo(() => activity.filter((a) => a.title === p.title).slice(0, 12), [activity, p.title]);

  const wa = whatsappUrl(p);
  const tel = p.agentPhone.replace(/[^0-9+]/g, '');
  const size = parseSize(p.size);
  const perM2 = pricePerM2(p);
  const rent = isRent(p);
  const shareText = customerShareText(p, settings.shareSignature);
  const stale = isStale(p, settings.staleDays);
  const place = [p.neighborhood, p.region !== 'Belirtilmemiş' ? p.region : '', 'Yalova'].filter(Boolean).join(', ');
  const coords = coordsOf(p);
  const mapsUrl = coords && !coords.approx
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(place)}`;
  // Talebi alan danışmanın telefonu: portföydeki ilanlarından bulunur
  const phoneOf = (name: string) => properties.find((x) => x.agentName === name && x.agentPhone)?.agentPhone ?? '';
  const details = [
    ['Oda sayısı', p.rooms],
    ['Kat', p.floor],
    ['Bina yaşı', p.buildingAge],
    ['Isınma', p.heating],
    ['Bölge', p.region !== 'Belirtilmemiş' ? p.region : ''],
    ['Mahalle', p.neighborhood],
  ].filter(([, v]) => v) as [string, string][];

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const submitOwner = () => {
    setOwner(ownerDraft);
    setOwnerState('ready');
    closeDialog();
    saveOwner(p.title, ownerDraft, officeKey).catch(() => setOwnerState('error'));
  };

  return (
    <div className="space-y-[14px]">
      {/* Başlık kartı: ilanın kendisi */}
      <header className="bg-surface rounded-xl p-[14px] flex flex-wrap items-center gap-4">
        <Thumb src={images[0]} alt="" className="w-[62px] h-[62px] rounded-md flex-none" />
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold leading-6">{p.title}</h1>
            {p.status !== 'Aktif' && <StatusPill status={p.status} />}
            <FavoriteButton id={p.id} className="-my-2" />
          </div>
          <p className="text-[13px] text-faint mt-1">
            <span className="num">{p.id}</span> · {p.category}
            {p.region !== 'Belirtilmemiş' ? ` · ${p.region}` : ''}
            {size ? <> · <span className="num">{size.toLocaleString('tr-TR')}</span> m²</> : null}
            {p.updatedAt && (
              <span className={stale ? 'text-warning' : ''}> · Son teyit {relativeDay(p.updatedAt).toLocaleLowerCase('tr')}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPending('share')} className={btnSecondary}>
            <Share2 className="w-4 h-4" /> Müşteriye gönder
          </button>
          <a href={`#/brosur/${encodeURIComponent(p.id)}`} className={btnSecondary}>
            <FileText className="w-4 h-4" /> Broşür
          </a>
          {p.status === 'Aktif' ? (
            <>
              <button onClick={() => actions.touch(p)} className={btnSecondary} title="İlanın fiyatı ve durumu hâlâ doğru">
                <Check className="w-4 h-4" /> Güncel
              </button>
              <button onClick={() => setPending('sold')} className={btnSecondary}>Satıldı / kiralandı</button>
              <button onClick={() => actions.status(p, 'Pasif')} className={btnSecondary}>Pasife al</button>
              <button onClick={() => setPending('delete')} className={btnDanger} aria-label="İlanı sil">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Sil</span>
              </button>
            </>
          ) : (
            <button onClick={() => actions.status(p, 'Aktif')} className={btnSecondary}>
              <RotateCcw className="w-4 h-4" /> Aktife geri al
            </button>
          )}
        </div>
      </header>

      {stale && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
          Bu ilan {daysSince(p.updatedAt)} gündür teyit edilmedi. Mal sahibiyle fiyatı ve durumu konuşup “Güncel”e basın ya da fiyatı değiştirin.
        </p>
      )}

      {/* İki sütun: solda ilan (4/6), sağda iş yapılan kartlar (2/6). Tek boşluk: 14px */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-[14px] lg:items-start">
        <div className="lg:col-span-4 space-y-[14px] min-w-0">
          {/* Galeri */}
          <section aria-label="Fotoğraflar" className="bg-surface rounded-xl overflow-hidden">
            <div className="relative bg-raised">
              <Thumb src={images[index]} alt={`${p.title}, fotoğraf ${index + 1}`} className="w-full aspect-[4/3] max-h-[560px]" />
              {images.length > 1 && (
                <>
                  <button onClick={prev} aria-label="Önceki fotoğraf" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={next} aria-label="Sonraki fotoğraf" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute right-3 bottom-3 rounded-full bg-black/60 text-white px-2.5 h-6 flex items-center text-xs num">
                    {index + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-[14px] overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Fotoğraf ${i + 1}`}
                    aria-current={i === index}
                    className={`flex-none rounded overflow-hidden ring-2 transition ${i === index ? 'ring-ink' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <Thumb src={src} alt="" className="w-20 h-[60px]" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Ana özellikler */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
            <Fact label="Metrekare" value={size ? `${size.toLocaleString('tr-TR')} m²` : '—'} />
            <Fact label="İmar durumu" value={p.imarStatus || '—'} />
            {presentMode ? (
              <Fact label="Oda sayısı" value={p.rooms || '—'} />
            ) : (
              <Fact label="Ada / parsel · ofis içi" value={p.adaParsel?.trim() || '—'} warn={!p.adaParsel?.trim()} />
            )}
          </div>

          {(details.length > 0 || p.features.length > 0) && (
            <section className="bg-surface rounded-xl p-5">
              <h2 className="text-base font-semibold">Özellikler</h2>
              {details.length > 0 && (
                <dl className="mt-3 grid sm:grid-cols-2 gap-x-8 text-sm">
                  {details.map(([k, v]) => <Row key={k} label={k} value={v} />)}
                </dl>
              )}
              {p.features.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="h-7 px-3 rounded-full bg-raised text-sm flex items-center">{f}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="bg-surface rounded-xl p-5">
            <h2 className="text-base font-semibold">İlan açıklaması</h2>
            {p.description ? (
              <p className="mt-3 text-[15px] leading-6 whitespace-pre-line max-w-[75ch]">{p.description}</p>
            ) : (
              <p className="mt-3 text-muted">Açıklama girilmemiş. Sheets'te “Açıklama” sütununa yazılabilir.</p>
            )}
          </section>

          {/* Konum: kesin konum dolu nokta, yoksa ilçe merkezi. Ofis içinde haritaya tıklayıp işaretlenir. */}
          <section className="bg-surface rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Konum</h2>
              <p className="text-sm text-muted">{place}</p>
            </div>
            {coords ? (
              <MapView
                key={`${p.id}-${coords.approx}`}
                points={[{ id: p.id, lat: coords.lat, lng: coords.lng, approx: coords.approx, label: p.title }]}
                center={[coords.lat, coords.lng]}
                zoom={coords.approx ? 13 : 15}
                pick={pick}
                onPick={presentMode ? undefined : (lat, lng) => setPick({ lat, lng })}
                label="İlanın konumu"
                className="mt-3 h-[300px]"
              />
            ) : (
              <p className="mt-3 text-sm text-muted">Bölge belli olmadığı için harita gösterilemiyor. Sheets'te “Bölge” veya “Konum” sütununu doldurun.</p>
            )}
            {!presentMode && coords && (
              <p className="mt-2 text-sm text-muted">
                {pick
                  ? 'Seçilen nokta kaydedilmedi.'
                  : coords.approx
                    ? 'Yaklaşık konum (ilçe merkezi). Gerçek yeri işaretlemek için haritaya tıklayın.'
                    : 'Kesin konum işaretli. Değiştirmek için haritaya tıklayın.'}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {pick && (
                <>
                  <button onClick={() => { actions.location(p, pick.lat, pick.lng); setPick(null); }} className={btnPrimary}>
                    <Check className="w-4 h-4" /> Konumu kaydet
                  </button>
                  <button onClick={() => setPick(null)} className={btnSecondary}>Vazgeç</button>
                </>
              )}
              <a href={mapsUrl} target="_blank" rel="noreferrer" className={btnSecondary}>
                <MapPin className="w-4 h-4" /> {coords && !coords.approx ? 'Yol tarifi' : 'Google Maps’te ara'}
              </a>
              {!presentMode && (
                <a href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer" className={btnSecondary} title={p.adaParsel ? `Ada/parsel: ${p.adaParsel}` : undefined}>
                  TKGM parsel sorgu <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </section>

          {!presentMode && (
            <section className="bg-surface rounded-xl p-5">
              <h2 className="text-base font-semibold">Geçmiş ve notlar</h2>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  actions.note(p, note.trim());
                  setNote('');
                }}
              >
                <label htmlFor="note" className="sr-only">Not ekle</label>
                <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gösterim, müşteri geri bildirimi, mal sahibiyle görüşme…" className="field" />
                <button type="submit" className={`${btnPrimary} disabled:opacity-60`} disabled={!v2Ready}>Ekle</button>
              </form>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {v2Ready ? 'Bu ilan için henüz kayıt yok.' : 'Geçmiş, Apps Script v2 yayınlanınca tutulmaya başlar.'}
                </p>
              ) : (
                <ul className="mt-3">
                  {history.map((a, i) => (
                    <li key={i} className="flex gap-3 py-2 border-t border-rule first:border-t-0 text-sm">
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="font-medium">{a.action}</span>
                          {a.detail && <span className="text-muted"> · {a.detail}</span>}
                        </p>
                        <p className="text-xs text-faint">{a.who}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.noteId && a.who === userName && (
                          <button
                            onClick={() => actions.deleteNote(p, a.noteId!)}
                            className="text-xs text-muted hover:text-negative transition-colors"
                          >
                            Sil
                          </button>
                        )}
                        <span className="text-xs text-faint num whitespace-nowrap">{formatDateTime(a.at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Sağ sütun */}
        <aside className="lg:col-span-2 space-y-[14px] min-w-0">
          <div className="bg-surface rounded-xl p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">{rent ? 'Aylık kira' : 'Satış fiyatı'}</p>
              {p.status === 'Aktif' && (
                <button onClick={() => setPending('price')} className="text-sm text-muted hover:text-ink underline underline-offset-2">Değiştir</button>
              )}
            </div>
            <p className={`text-[30px] leading-9 font-semibold num mt-1 ${p.status === 'Satıldı' ? 'text-muted line-through' : 'text-accent'}`}>
              {formatPrice(p.price)}
            </p>
            {priceDropped(p) && <p className="text-sm text-faint num mt-1"><span className="line-through">{formatPrice(p.oldPrice || '')}</span> idi</p>}
            {perM2 && !rent && <p className="text-sm text-faint num mt-1">{perM2}</p>}
          </div>

          <div className="bg-surface rounded-xl p-5">
            <p className="text-sm text-muted">Sorumlu danışman</p>
            <p className="text-base font-semibold mt-1">{p.agentName}</p>
            <p className="text-sm text-faint num">{p.agentPhone ? formatPhone(p.agentPhone) : 'Telefon girilmemiş'}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {tel ? (
                <a href={`tel:${tel}`} className={`${btnSecondary} justify-center`}><Phone className="w-4 h-4" /> Ara</a>
              ) : (
                <span className={`${btnSecondary} justify-center text-faint cursor-not-allowed`} aria-disabled="true">Telefon yok</span>
              )}
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className={`${btnPrimary} justify-center`}><MessageCircle className="w-4 h-4" /> WhatsApp</a>
              ) : (
                <span className={`${btnSecondary} justify-center text-faint cursor-not-allowed`} aria-disabled="true">WhatsApp yok</span>
              )}
            </div>
            {p.sahibindenUrl && (
              <a href={p.sahibindenUrl} target="_blank" rel="noreferrer" className="mt-3 h-9 flex items-center justify-center gap-2 text-sm text-muted hover:text-ink">
                Sahibinden ilanını aç <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="bg-surface rounded-xl p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Uyan müşteri talepleri</h2>
              <span className="text-sm num text-muted">{matched.length}</span>
            </div>
            {matched.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Açık taleplerden bu ilana uyan yok.</p>
            ) : (
              <ul className="mt-2">
                {matched.slice(0, 4).map((r) => {
                  const phone = phoneDigits(phoneOf(r.agentName));
                  const msg = encodeURIComponent(`Merhaba, müşteri talebine uyan bir ilan var: ${p.title} (${p.id}), ${formatPrice(p.price)}. Danışmanı: ${p.agentName}.`);
                  return (
                    <li key={r.id} className="py-2 border-t border-rule first:border-t-0 text-sm flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{[r.deal, r.kind, r.rooms, r.region].filter(Boolean).join(' · ') || 'Genel talep'}</p>
                        <p className="text-xs text-faint">{r.agentName}{r.maxPrice ? ` · en çok ${formatPrice(r.maxPrice)}` : ''}</p>
                      </div>
                      {phone && r.agentName !== p.agentName && (
                        <a href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2 hover:text-muted whitespace-nowrap">
                          Haber ver
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <a href="#/talepler" className="mt-2 inline-block text-sm text-muted hover:text-ink underline underline-offset-2">Bütün talepler</a>
          </div>

          {!presentMode && (
            <div className="bg-surface rounded-xl p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-muted" /> Ofis içi</h2>
                {ownerState !== 'error' && (
                  <button
                    onClick={() => {
                      setOwnerDraft(owner ?? EMPTY_OWNER);
                      setPending('owner');
                    }}
                    className="text-sm text-muted hover:text-ink underline underline-offset-2"
                  >
                    {owner ? 'Düzenle' : 'Ekle'}
                  </button>
                )}
              </div>
              {ownerState === 'loading' ? (
                <p className="mt-2 text-sm text-muted">Yükleniyor…</p>
              ) : ownerState === 'error' ? (
                <p className="mt-2 text-sm text-muted">
                  {!officeKey ? 'Mal sahibi bilgisini görmek için çıkış yapıp yeniden giriş yapın.' : 'Mal sahibi bilgisi okunamadı (Apps Script v2 yayınlandı mı?).'}
                </p>
              ) : owner ? (
                <dl className="mt-2 text-sm">
                  <Row label="Mal sahibi" value={owner.name || '—'} />
                  <Row label="Telefon" value={owner.phone ? <a href={`tel:${owner.phone.replace(/[^0-9+]/g, '')}`} className="underline underline-offset-2">{formatPhone(owner.phone)}</a> : '—'} />
                  <Row label="Yetki belgesi" value={owner.authorization || '—'} />
                  <Row label="Yetki bitişi" value={owner.authorizationEnd || '—'} />
                  <Row label="Komisyon" value={owner.commission || '—'} />
                  <Row label="Anahtar" value={owner.keyLocation || '—'} />
                  {owner.note && <p className="mt-2 text-muted">{owner.note}</p>}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted">Mal sahibi ve yetki bilgisi girilmemiş. Müşteriye giden linkte ve sunum modunda görünmez.</p>
              )}
            </div>
          )}

          <div className="bg-surface rounded-xl p-5">
            <h2 className="text-sm text-muted">Kayıt</h2>
            <dl className="mt-2 text-sm">
              <Row label="İlan no" value={p.id} />
              <Row label="Durum" value={<StatusPill status={p.status} />} />
              <Row label="Eklenme" value={p.createdAt ? p.createdAt.toLocaleDateString('tr-TR') : '—'} />
              <Row label="Son güncelleme" value={relativeDay(p.updatedAt)} />
              <Row label="Fotoğraf" value={`${images.length}`} />
            </dl>
          </div>
        </aside>
      </div>

      {pending === 'share' && (
        <Dialog
          title="Müşteriye gönder"
          onClose={closeDialog}
          actions={
            <>
              <button onClick={copyShare} className={btnSecondary}>
                <Copy className="w-4 h-4" /> {copied ? 'Kopyalandı' : 'Metni kopyala'}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className={btnPrimary}>
                <MessageCircle className="w-4 h-4" /> WhatsApp'ta seç
              </a>
            </>
          }
        >
          <p>Ada/parsel, mal sahibi ve ofis notları bu metinde yok. WhatsApp'ta müşteriyi seçip fotoğrafları ayrıca ekleyebilirsiniz.</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-ink bg-surface rounded-lg p-3 text-sm">{shareText}</pre>
        </Dialog>
      )}

      {pending === 'price' && (
        <Dialog
          title="Fiyatı değiştir"
          onClose={closeDialog}
          actions={
            <>
              <button onClick={closeDialog} className={btnSecondary}>Vazgeç</button>
              <button
                onClick={() => {
                  closeDialog();
                  if (newPrice.trim() && newPrice.trim() !== String(p.price)) actions.price(p, newPrice.trim());
                }}
                className={btnPrimary}
              >
                Kaydet
              </button>
            </>
          }
        >
          <label htmlFor="newprice" className="block text-sm font-medium text-ink mb-2">Yeni fiyat (TL)</label>
          <input id="newprice" inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="field num" />
          <p className="mt-2">Şimdiki: {formatPrice(p.price)}. Eski fiyat Sheets'te “Eski Fiyat” sütununda tutulur, listede “Fiyat düştü” olarak görünür.</p>
        </Dialog>
      )}

      {pending === 'sold' && (
        <Dialog
          title="Satıldı / kiralandı"
          onClose={closeDialog}
          actions={
            <>
              <button onClick={closeDialog} className={btnSecondary}>Vazgeç</button>
              <button onClick={() => { closeDialog(); actions.sold(p, sale); }} className={btnPrimary}>Kaydet ve ilanı kapat</button>
            </>
          }
        >
          <div className="grid sm:grid-cols-2 gap-3 text-ink">
            <div>
              <label htmlFor="sprice" className="block text-sm font-medium mb-2">Gerçekleşen fiyat</label>
              <input id="sprice" inputMode="numeric" value={sale.price} onChange={(e) => setSale({ ...sale, price: e.target.value })} className="field num" />
            </div>
            <div>
              <label htmlFor="sby" className="block text-sm font-medium mb-2">Alıcıyı / kiracıyı getiren</label>
              <select id="sby" value={sale.broughtBy} onChange={(e) => setSale({ ...sale, broughtBy: e.target.value })} className="field">
                {agents.map((a) => <option key={a}>{a}</option>)}
                <option>Ofis dışı</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ssrc" className="block text-sm font-medium mb-2">Müşteri nereden geldi?</label>
              <select id="ssrc" value={sale.source} onChange={(e) => setSale({ ...sale, source: e.target.value })} className="field">
                {SALE_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-3">İlan Satılan sekmesine geçer; kayıt Sheets'teki “Satışlar” sayfasına yazılır.</p>
        </Dialog>
      )}

      {pending === 'owner' && (
        <Dialog
          title="Ofis içi bilgiler"
          onClose={closeDialog}
          actions={
            <>
              <button onClick={closeDialog} className={btnSecondary}>Vazgeç</button>
              <button onClick={submitOwner} className={btnPrimary}>Kaydet</button>
            </>
          }
        >
          <OwnerFields value={ownerDraft} onChange={setOwnerDraft} />
        </Dialog>
      )}

      {pending === 'delete' && (
        <Dialog
          title={`${p.id} silinsin mi?`}
          onClose={closeDialog}
          actions={
            <>
              <button onClick={closeDialog} className={btnSecondary}>Vazgeç</button>
              <button onClick={() => { closeDialog(); actions.status(p, 'Silindi'); }} className={btnDanger}><Trash2 className="w-4 h-4" /> Sil</button>
            </>
          }
        >
          “{p.title}” portföyden kalkar. Kayıt Sheets'te kalır ve Silinen sekmesinden geri alınabilir.
        </Dialog>
      )}
    </div>
  );
}

export function OwnerFields({ value, onChange }: { value: OwnerInfo; onChange: (o: OwnerInfo) => void }) {
  const set = (k: keyof OwnerInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-ink">
      <div>
        <label htmlFor="o-name" className="block text-sm font-medium mb-2">Mal sahibi</label>
        <input id="o-name" value={value.name} onChange={set('name')} className="field" />
      </div>
      <div>
        <label htmlFor="o-phone" className="block text-sm font-medium mb-2">Telefonu</label>
        <input id="o-phone" type="tel" value={value.phone} onChange={set('phone')} className="field num" />
      </div>
      <div>
        <label htmlFor="o-auth" className="block text-sm font-medium mb-2">Yetki belgesi</label>
        <select id="o-auth" value={value.authorization} onChange={set('authorization')} className="field">
          <option value="">Seçin</option>
          <option>Var, münhasır</option>
          <option>Var, münhasır değil</option>
          <option>Yok (sözlü)</option>
        </select>
      </div>
      <div>
        <label htmlFor="o-end" className="block text-sm font-medium mb-2">Yetki bitişi</label>
        <input id="o-end" type="date" value={value.authorizationEnd} onChange={set('authorizationEnd')} className="field" />
      </div>
      <div>
        <label htmlFor="o-com" className="block text-sm font-medium mb-2">Komisyon</label>
        <input id="o-com" placeholder="%2 + KDV" value={value.commission} onChange={set('commission')} className="field" />
      </div>
      <div>
        <label htmlFor="o-key" className="block text-sm font-medium mb-2">Anahtar nerede?</label>
        <select id="o-key" value={value.keyLocation} onChange={set('keyLocation')} className="field">
          <option value="">Seçin</option>
          <option>Ofiste</option>
          <option>Mal sahibinde</option>
          <option>Danışmanda</option>
          <option>Kapıcı / komşu</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="o-note" className="block text-sm font-medium mb-2">Ofis notu</label>
        <input id="o-note" placeholder="Örn. Akşam 18:00 sonrası gösterim" value={value.note} onChange={set('note')} className="field" />
      </div>
    </div>
  );
}

function Fact({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-surface rounded-xl p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-xl font-semibold mt-1 num ${warn ? 'text-warning' : ''}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-8 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  );
}
