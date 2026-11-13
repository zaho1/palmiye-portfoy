import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import type { OwnerInfo, Property } from '../../types';
import {
  REGIONS,
  REGION_CENTERS,
  YALOVA_CENTER,
  addListing,
  compressImage,
  formatLocation,
  formatPrice,
  normalizeAdaParsel,
  type NewListing,
} from '../../lib/sheets';
import { getDirectory } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import { haptic, listingDraftStore } from '../../lib/personal';
import { Thumb } from '../ui';
import { OwnerFields } from '../ListingDetail';
import MapView from '../MapView';
import { Chip, MField, Segmented, btnBig, btnBigSecondary } from './controls';
import { CameraIcon, ChevronLeftIcon, GalleryIcon, LocateIcon } from './icons';

interface Props {
  properties: Property[];
  defaultAgentName: string;
  onSaved: (listing: NewListing) => void;
}

const KINDS = ['Daire', 'Villa / Müstakil', 'Arsa', 'Tarla / Bahçe', 'Dükkan / İşyeri', 'Bina'];
const ROOMS = ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1 ve üzeri'];
const HEATING = ['Doğalgaz kombi', 'Merkezi', 'Klima', 'Soba', 'Yerden ısıtma', 'Yok'];
const FEATURES = ['Eşyalı', 'Site içinde', 'Otopark', 'Asansör', 'Bahçeli', 'Deniz manzaralı', 'Havuzlu', 'Krediye uygun', 'Takasa uygun', 'Sıfır bina'];
const LAND = ['Arsa', 'Tarla / Bahçe'];
const MAX_IMAGES = 20;
const STEPS = ['Fotoğraflar', 'Ne ve nerede', 'Fiyat ve bilgiler', 'Son kontrol'];
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const photoBtn = 'h-16 rounded-2xl flex flex-col items-center justify-center gap-1 text-[15px] font-semibold active:opacity-80 cursor-pointer';
const EMPTY_OWNER: OwnerInfo = { name: '', phone: '', authorization: '', authorizationEnd: '', commission: '', keyLocation: '', note: '' };

type Form = Omit<NewListing, 'images' | 'category' | 'features' | 'location'> & { deal: string; kind: string };

const digits = (s: string) => s.replace(/[^0-9]/g, '');
const grouped = (s: string) => (s ? Number(s).toLocaleString('tr-TR') : '');

// Yeni ilan: adım adım kısa form. Kameradan çek, bulunduğun yeri işaretle.
export default function MobileNewListing({ properties, defaultAgentName, onSaved }: Props) {
  const { settings } = useSettings();
  // Yarım kalan ilan telefonda saklanır; sinyal gitse veya uygulama kapansa kaybolmaz (mal sahibi bilgisi hariç)
  const [restored] = useState(() => {
    const d = listingDraftStore.get();
    return d && Date.now() - d.savedAt < 72 * 3_600_000 ? d : null;
  });
  const [showRestored, setShowRestored] = useState(true);
  const finished = useRef(false);
  const [step, setStep] = useState(restored?.step ?? 0);
  const [images, setImages] = useState<string[]>(restored?.images ?? []);
  const [processing, setProcessing] = useState(false);
  const [features, setFeatures] = useState<string[]>(restored?.features ?? []);
  const [owner, setOwner] = useState<OwnerInfo>(EMPTY_OWNER);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(restored?.location ?? null);
  const [geoCenter, setGeoCenter] = useState<[number, number] | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'busy'>('idle');
  const [geoError, setGeoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const makeForm = (): Form => ({
    title: '',
    price: '',
    deal: 'Satılık',
    kind: 'Daire',
    imarStatus: '',
    size: '',
    description: '',
    sahibindenUrl: '',
    adaParsel: '',
    agentName: defaultAgentName,
    agentPhone: settings.phone || getDirectory().find((u) => u.name === defaultAgentName)?.phone || '',
    whatsappUrl: '',
    region: '',
    neighborhood: '',
    rooms: '',
    floor: '',
    buildingAge: '',
    heating: '',
  });
  const [form, setForm] = useState<Form>(() => ({ ...makeForm(), ...(restored?.form as Partial<Form> | undefined) }));

  const dirty = images.length > 0 || !!form.title.trim() || !!form.price || !!form.neighborhood.trim() || !!form.region;
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (finished.current) return;
      if (!dirty) listingDraftStore.clear();
      else listingDraftStore.set({ savedAt: Date.now(), step, images, features, form: { ...form }, location });
    }, 700);
    return () => window.clearTimeout(t);
  }, [dirty, step, images, features, form, location]);

  const startOver = () => {
    listingDraftStore.clear();
    setImages([]);
    setFeatures([]);
    setLocation(null);
    setForm(makeForm());
    setStep(0);
    setShowRestored(false);
    window.scrollTo(0, 0);
  };

  const patch = (change: Partial<Form>) => {
    setError('');
    setForm((f) => ({ ...f, ...change }));
  };
  const isLand = LAND.includes(form.kind);
  const regionCenter = form.region ? REGION_CENTERS[form.region] : undefined;
  const mapCenter = useMemo(() => geoCenter ?? regionCenter ?? YALOVA_CENTER, [geoCenter, regionCenter]);
  const toggleFeature = (f: string) => setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  // Aynı ada/parsel portföyde varsa uyar
  const duplicates = useMemo(() => {
    const key = normalizeAdaParsel(form.adaParsel);
    if (key.length < 3) return [];
    return properties.filter((p) => p.status !== 'Silindi' && p.adaParsel && normalizeAdaParsel(p.adaParsel) === key);
  }, [form.adaParsel, properties]);

  const suggestion = useMemo(
    () =>
      [form.region, form.neighborhood.trim(), !isLand ? form.rooms.replace(' ve üzeri', '') : '', form.deal.toLocaleLowerCase('tr'), form.kind.split(' / ')[0].toLocaleLowerCase('tr')]
        .filter(Boolean)
        .join(' ')
        .slice(0, 80),
    [form.region, form.neighborhood, form.rooms, form.deal, form.kind, isLand],
  );

  // Fotoğraflar tek tek küçültülür: telefon belleği çok sayıda büyük fotoğrafı aynı anda kaldırmaz
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (files.length > room) {
      setError(`En fazla ${MAX_IMAGES} fotoğraf eklenebilir; ${room} yer kaldı.`);
      if (room <= 0) return;
    } else {
      setError('');
    }
    setProcessing(true);
    try {
      for (const file of files.slice(0, room)) {
        const data = await compressImage(file);
        setImages((prev) => [...prev, data]);
      }
    } catch (err) {
      console.error('Görsel okunamadı:', err);
      setError('Fotoğraflardan biri okunamadı. Tekrar çekin veya galeriden başka birini seçin.');
    } finally {
      setProcessing(false);
    }
  };

  const makeCover = (i: number) => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));

  const locate = () => {
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setGeoError('Bu telefon konum bilgisini vermiyor. Haritaya dokunarak işaretleyin.');
      return;
    }
    setGeoState('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(point);
        setGeoCenter([point.lat, point.lng]);
        setGeoState('idle');
      },
      (err) => {
        setGeoState('idle');
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Konum izni verilmedi. Telefon ayarlarından Safari/Chrome için konuma izin verin veya haritaya dokunun.'
            : 'Konum alınamadı. Açık havada tekrar deneyin veya haritaya dokunun.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const checks: [string, boolean][] = [
    ['bölge ve mahalle', !!(form.region && form.neighborhood.trim())],
    ['haritada konum', !!location],
    ['ada/parsel', !!form.adaParsel.trim()],
    ['metrekare', !!form.size.trim()],
    ['en az 5 fotoğraf', images.length >= 5],
    ['açıklama', !!form.description.trim()],
    ['mal sahibi', !!owner.name.trim()],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);

  const go = (to: number) => {
    setError('');
    setStep(to);
    window.scrollTo(0, 0);
  };

  const next = () => {
    if (step === 2 && (!form.title.trim() || !digits(form.price))) {
      setError('Başlık ve fiyat zorunlu.');
      return;
    }
    go(step + 1);
  };

  // Çıkınca bilgiler silinmez: taslak olarak kalır, ilan ekle'ye dönünce devam edilir
  const leave = () => {
    window.location.hash = '#/bugun';
  };

  const submit = async () => {
    setError('');
    if (!form.agentName.trim() || !form.agentPhone.trim()) {
      setError('Danışman adı ve telefonu zorunlu.');
      return;
    }
    if (!form.title.trim() || !digits(form.price)) {
      setError('Başlık ve fiyat zorunlu. 3. adıma dönün.');
      return;
    }
    setSubmitting(true);
    setProgress('');
    const { deal, kind, ...rest } = form;
    try {
      const listing: NewListing = {
        ...rest,
        price: digits(form.price),
        category: `${deal} ${kind}`,
        features,
        images,
        rooms: isLand ? '' : form.rooms,
        location: location ? formatLocation(location.lat, location.lng) : '',
      };
      await addListing(listing, owner.name || owner.phone ? owner : null, (d, t) => setProgress(`Fotoğraflar yükleniyor ${d}/${t}…`));
      finished.current = true;
      listingDraftStore.clear();
      haptic(20);
      onSaved(listing);
    } catch (err) {
      console.error('İlan eklenirken hata:', err);
      setError(err instanceof Error && err.message.startsWith('Fotoğraflar') ? err.message : 'İlan kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin. Bilgilerin telefonda duruyor.');
      setSubmitting(false);
    }
  };

  const last = step === STEPS.length - 1;
  const busyPhotos = processing;

  return (
    <div className="m-page-bar">
      <header className="m-top sticky top-0 z-30 bg-ground border-b border-rule">
        <div className="h-14 px-2 flex items-center gap-1">
          <button
            onClick={step === 0 ? leave : () => go(step - 1)}
            aria-label={step === 0 ? 'Vazgeç' : 'Önceki adım'}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-surface"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-5 truncate">{STEPS[step]}</h1>
            <p className="text-[13px] text-muted num">Adım {step + 1} / {STEPS.length}</p>
          </div>
          <button onClick={leave} aria-label="Vazgeç" className="w-11 h-11 rounded-full flex items-center justify-center text-muted active:bg-surface">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-1 bg-raised" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </header>

      <div className="px-4 pt-5 space-y-6">
        {restored && showRestored && (
          <div role="status" className="rounded-xl bg-surface px-4 py-3 text-[14px] flex items-center gap-3">
            <p className="flex-1 min-w-0 text-muted">
              Yarım kalan ilanın geri geldi{restored.images.length ? ` (${restored.images.length} fotoğraf)` : ''}.
            </p>
            <button type="button" onClick={startOver} className="min-h-11 px-3 -mr-2 text-ink underline underline-offset-2 shrink-0">
              Baştan başla
            </button>
          </div>
        )}
        {step === 0 && (
          <>
            <p className="text-[15px] text-muted">
              İlk fotoğraf listede kapak olur, en iyisi 5 fotoğraf. Fotoğrafın şu an yoksa "Devam"a bas; ilanı sonra düzenleyip eklersin, 24 saat içinde eklenmezse sana hatırlatırız.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input id="ph-cam" type="file" accept={IMAGE_TYPES} capture="environment" onChange={handleFiles} disabled={busyPhotos || images.length >= MAX_IMAGES} className="sr-only" />
              <label htmlFor="ph-cam" className={`${photoBtn} bg-ink text-ground ${busyPhotos || images.length >= MAX_IMAGES ? 'opacity-60' : ''}`}>
                <CameraIcon className="w-6 h-6" /> Kameradan çek
              </label>
              <input id="ph-gal" type="file" multiple accept={IMAGE_TYPES} onChange={handleFiles} disabled={busyPhotos || images.length >= MAX_IMAGES} className="sr-only" />
              <label htmlFor="ph-gal" className={`${photoBtn} border border-control ${busyPhotos || images.length >= MAX_IMAGES ? 'opacity-60' : ''}`}>
                <GalleryIcon className="w-6 h-6" /> Galeriden seç
              </label>
            </div>
            {busyPhotos && <p className="text-[14px] text-muted" role="status">Fotoğraf hazırlanıyor…</p>}

            {images.length > 0 && (
              <>
                <ul className="grid grid-cols-3 gap-2">
                  {images.map((src, i) => (
                    <li key={i} className="relative">
                      <button type="button" onClick={() => makeCover(i)} className="block w-full" aria-label={i === 0 ? 'Kapak fotoğrafı' : `Fotoğraf ${i + 1}: kapak yap`}>
                        <Thumb src={src} alt="" className="w-full aspect-square rounded-xl" />
                      </button>
                      {i === 0 && <span className="absolute left-1.5 top-1.5 h-6 px-2 rounded-full bg-ink text-ground text-[12px] font-medium flex items-center">Kapak</span>}
                      <button type="button" onClick={() => removeImage(i)} aria-label={`Fotoğraf ${i + 1} kaldır`} className="absolute -right-0.5 -top-0.5 w-11 h-11 flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-4 h-4" /></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-faint num">{images.length} / {MAX_IMAGES} fotoğraf · kapak yapmak için fotoğrafa dokunun</p>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <MField label="İşlem">
              <Segmented label="Satılık veya kiralık" value={form.deal} options={['Satılık', 'Kiralık']} onChange={(v) => patch({ deal: v })} />
            </MField>
            <MField label="Cins">
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <Chip key={k} on={form.kind === k} onClick={() => patch(LAND.includes(k) ? { kind: k, rooms: '', floor: '', buildingAge: '', heating: '' } : { kind: k })}>{k}</Chip>
                ))}
              </div>
            </MField>
            <MField label="Bölge">
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => <Chip key={r} on={form.region === r} onClick={() => patch({ region: r })}>{r}</Chip>)}
              </div>
            </MField>
            <MField label="Mahalle / köy" htmlFor="ml-hood">
              <input id="ml-hood" autoComplete="off" placeholder="Kaytazdere" value={form.neighborhood} onChange={(e) => patch({ neighborhood: e.target.value })} className="field-lg" />
            </MField>

            <div className="space-y-3">
              <MField label="Konum" note={location ? formatLocation(location.lat, location.lng) : undefined}>
                <button type="button" onClick={locate} disabled={geoState === 'busy'} className={`${btnBig} w-full`}>
                  <LocateIcon className="w-5 h-5" /> {geoState === 'busy' ? 'Konum alınıyor…' : location ? 'Bulunduğum yeri yeniden al' : 'Bulunduğum yeri kullan'}
                </button>
              </MField>
              {geoError && <p role="alert" className="text-[14px] text-warning">{geoError}</p>}
              <MapView
                points={[]}
                center={mapCenter}
                zoom={geoCenter ? 17 : regionCenter ? 14 : 10}
                pick={location}
                onPick={(lat, lng) => setLocation({ lat, lng })}
                label="Konum seçme haritası"
                className="h-[260px]"
              />
              <p className="text-[13px] text-faint">Haritaya dokunarak da işaretleyebilirsiniz. Konum, müşteriye giden metne Google Maps linki olarak eklenir.</p>
              {location && (
                <button type="button" onClick={() => { setLocation(null); setGeoCenter(null); }} className="min-h-11 text-[15px] text-muted underline underline-offset-2">Konumu temizle</button>
              )}
            </div>

            <MField label="Ada / parsel" htmlFor="ml-ada" note="ofis içi">
              <input id="ml-ada" autoComplete="off" placeholder="1234/56" value={form.adaParsel} onChange={(e) => patch({ adaParsel: e.target.value })} className="field-lg num" />
            </MField>
            {duplicates.length > 0 && (
              <div role="alert" className="rounded-xl bg-warning-bg px-4 py-3 text-[14px] flex gap-3">
                <TriangleAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-warning font-medium">Bu ada/parsel portföyde zaten var.</p>
                  <ul className="mt-1 space-y-0.5">
                    {duplicates.map((d) => (
                      <li key={d.id}>{d.id} · {d.title} <span className="text-muted">({d.agentName})</span></li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted">Aynı mülkü ikinci kez girmeden önce ilgili danışmanla konuşun.</p>
                </div>
              </div>
            )}
            <MField label="İmar durumu" htmlFor="ml-imar">
              <input id="ml-imar" autoComplete="off" placeholder="Konut, ticari, tarla…" value={form.imarStatus} onChange={(e) => patch({ imarStatus: e.target.value })} className="field-lg" />
            </MField>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MField label={form.deal === 'Kiralık' ? 'Aylık kira (₺)' : 'Fiyat (₺)'} htmlFor="ml-price">
                <input id="ml-price" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="2.500.000" value={grouped(digits(form.price))} onChange={(e) => patch({ price: digits(e.target.value) })} className="field-lg num" />
              </MField>
              <MField label="Metrekare" htmlFor="ml-size">
                <input id="ml-size" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="120" value={form.size} onChange={(e) => patch({ size: digits(e.target.value) })} className="field-lg num" />
              </MField>
            </div>
            {form.price && <p className="-mt-4 text-[13px] text-faint num">{formatPrice(form.price)}</p>}

            <MField label="İlan başlığı" htmlFor="ml-title" note={`${form.title.length} / 80`}>
              <input id="ml-title" maxLength={80} autoComplete="off" placeholder="Altınova Kaytazdere sıfır 2+1 daire" value={form.title} onChange={(e) => patch({ title: e.target.value })} className="field-lg" />
              {suggestion && suggestion !== form.title && (
                <button type="button" onClick={() => patch({ title: suggestion })} className="mt-2 min-h-11 w-full text-left rounded-xl bg-ground px-4 py-2 text-[14px] active:bg-active">
                  <span className="text-faint">Öneri: </span>{suggestion} <span className="underline underline-offset-2">kullan</span>
                </button>
              )}
            </MField>

            {!isLand && (
              <>
                <MField label="Oda sayısı">
                  <div className="flex flex-wrap gap-2">
                    {ROOMS.map((r) => <Chip key={r} on={form.rooms === r} onClick={() => patch({ rooms: form.rooms === r ? '' : r })}>{r}</Chip>)}
                  </div>
                </MField>
                <div className="grid grid-cols-2 gap-3">
                  <MField label="Kat" htmlFor="ml-floor">
                    <input id="ml-floor" autoComplete="off" placeholder="2 / 4" value={form.floor} onChange={(e) => patch({ floor: e.target.value })} className="field-lg num" />
                  </MField>
                  <MField label="Bina yaşı" htmlFor="ml-age">
                    <input id="ml-age" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0" value={form.buildingAge} onChange={(e) => patch({ buildingAge: digits(e.target.value) })} className="field-lg num" />
                  </MField>
                </div>
                <MField label="Isınma">
                  <div className="flex flex-wrap gap-2">
                    {HEATING.map((h) => <Chip key={h} on={form.heating === h} onClick={() => patch({ heating: form.heating === h ? '' : h })}>{h}</Chip>)}
                  </div>
                </MField>
              </>
            )}

            <MField label="Öne çıkanlar">
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((f) => <Chip key={f} on={features.includes(f)} onClick={() => toggleFeature(f)}>{f}</Chip>)}
              </div>
            </MField>

            <MField label="Açıklama" htmlFor="ml-desc">
              <textarea id="ml-desc" rows={5} placeholder="Konum, ulaşım, binanın durumu… Müşteriye bu metin gider." value={form.description} onChange={(e) => patch({ description: e.target.value })} className="field-lg py-3 leading-6" />
            </MField>
          </>
        )}

        {last && (
          <>
            <div className="bg-surface rounded-2xl overflow-hidden">
              <Thumb src={images[0]} alt="" className="w-full aspect-[16/10]" />
              <div className="p-4">
                <p className="text-xl font-semibold text-accent num">
                  {form.price ? formatPrice(form.price) : 'Fiyat girilmedi'}
                  {form.deal === 'Kiralık' && form.price && <span className="text-[15px] text-faint font-normal"> /ay</span>}
                </p>
                <p className="mt-1 text-[17px] font-semibold leading-6">{form.title || 'Başlık girilmedi'}</p>
                <p className="mt-1 text-[14px] text-muted">
                  {[form.region, form.neighborhood].filter(Boolean).join(' ') || 'Bölge seçilmedi'} · {form.deal} {form.kind}
                  {form.size ? ` · ${form.size} m²` : ''}
                  {!isLand && form.rooms ? ` · ${form.rooms}` : ''}
                </p>
                <p className="mt-1 text-[13px] text-faint num">{images.length} fotoğraf{location ? ' · konum işaretli' : ''}</p>
              </div>
            </div>
            {missing.length > 0 && <p className="text-[14px] text-muted">Eksik (kaydı engellemez): {missing.join(', ')}.</p>}

            <MField label="Danışman" htmlFor="ml-agent">
              <input id="ml-agent" autoComplete="off" value={form.agentName} onChange={(e) => patch({ agentName: e.target.value })} className="field-lg" />
            </MField>
            <MField label="Danışman telefonu" htmlFor="ml-phone">
              <input id="ml-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="0555 123 45 67" value={form.agentPhone} onChange={(e) => patch({ agentPhone: e.target.value })} className="field-lg num" />
            </MField>

            <details className="bg-surface rounded-2xl">
              <summary className="min-h-14 px-4 flex items-center text-[15px] font-medium cursor-pointer">Mal sahibi ve ek bilgiler (isteğe bağlı)</summary>
              <div className="px-4 pb-4 space-y-4">
                <p className="text-[13px] text-faint">Mal sahibi yalnızca ofis içinde görünür; ilanlar sayfasına değil “Mal Sahipleri” sayfasına yazılır.</p>
                <OwnerFields value={owner} onChange={setOwner} />
                <MField label="Sahibinden linki" htmlFor="ml-sahibinden">
                  <input id="ml-sahibinden" type="url" inputMode="url" autoComplete="off" placeholder="https://www.sahibinden.com/ilan/…" value={form.sahibindenUrl} onChange={(e) => patch({ sahibindenUrl: e.target.value })} className="field-lg" />
                </MField>
              </div>
            </details>
          </>
        )}
      </div>

      <div className="m-bar">
        {error && <p role="alert" className="text-[14px] text-negative mb-2">{error}</p>}
        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} disabled={submitting} className={`${btnBigSecondary} flex-1`}>Geri</button>
          )}
          {last ? (
            <button type="button" onClick={submit} disabled={submitting || processing} className={`${btnBig} flex-[2]`}>
              {submitting ? progress || 'Kaydediliyor…' : 'İlanı kaydet'}
            </button>
          ) : (
            <button type="button" onClick={next} disabled={processing} className={`${btnBig} flex-[2]`}>
              {processing ? 'Fotoğraf hazırlanıyor…' : 'Devam'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
