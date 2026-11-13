import { useMemo, useState, type ReactNode } from 'react';
import { TriangleAlert, Upload, X } from 'lucide-react';
import type { OwnerInfo, Property } from '../types';
import { REGIONS, REGION_CENTERS, YALOVA_CENTER, addListing, compressImage, formatLocation, formatPrice, normalizeAdaParsel, parseLocation, type NewListing } from '../lib/sheets';
import { useSettings } from '../lib/settings';
import { Thumb } from './ui';
import { btnPrimary, btnSecondary } from './Dialog';
import { OwnerFields } from './ListingDetail';
import MapView from './MapView';

interface Props {
  properties: Property[];
  defaultAgentName: string;
  onSaved: (listing: NewListing) => void;
}

const DEALS = ['Satılık', 'Kiralık'];
const KINDS = ['Daire', 'Villa / Müstakil', 'Arsa', 'Tarla / Bahçe', 'Dükkan / İşyeri', 'Bina'];
const ROOMS = ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1 ve üzeri'];
const HEATING = ['Doğalgaz kombi', 'Merkezi', 'Klima', 'Soba', 'Yerden ısıtma', 'Yok'];
const FEATURES = ['Eşyalı', 'Site içinde', 'Otopark', 'Asansör', 'Bahçeli', 'Deniz manzaralı', 'Havuzlu', 'Krediye uygun', 'Takasa uygun', 'Sıfır bina'];
const LAND = ['Arsa', 'Tarla / Bahçe'];
const MAX_IMAGES = 20;
const EMPTY_OWNER: OwnerInfo = { name: '', phone: '', authorization: '', authorizationEnd: '', commission: '', keyLocation: '', note: '' };

type Form = Omit<NewListing, 'images' | 'category' | 'features' | 'location'> & { deal: string; kind: string };

export default function AddListing({ properties, defaultAgentName, onSaved }: Props) {
  const { settings } = useSettings();
  const [location, setLocationPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locText, setLocText] = useState('');
  const [form, setForm] = useState<Form>({
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
    agentPhone: settings.phone,
    whatsappUrl: '',
    region: '',
    neighborhood: '',
    rooms: '',
    floor: '',
    buildingAge: '',
    heating: '',
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [owner, setOwner] = useState<OwnerInfo>(EMPTY_OWNER);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const isLand = LAND.includes(form.kind);
  const toggleFeature = (f: string) => setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  // Aynı ada/parsel portföyde varsa uyar: iki danışman aynı mülkü ayrı girmesin.
  const duplicates = useMemo(() => {
    const key = normalizeAdaParsel(form.adaParsel);
    if (key.length < 3) return [];
    return properties.filter((p) => p.status !== 'Silindi' && p.adaParsel && normalizeAdaParsel(p.adaParsel) === key);
  }, [form.adaParsel, properties]);

  // Doluluk listesi: kaydetmeyi engellemez, danışmana hatırlatır
  const checks: [string, boolean][] = [
    ['Başlık ve fiyat', !!(form.title.trim() && form.price.trim())],
    ['Bölge ve mahalle', !!(form.region && form.neighborhood.trim())],
    ['Haritada konum', !!location],
    ['Ada / parsel', !!form.adaParsel.trim()],
    ['Metrekare', !!form.size.trim()],
    ['En az 5 fotoğraf', images.length >= 5],
    ['Açıklama', !!form.description.trim()],
    ['Mal sahibi', !!owner.name.trim()],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label.toLocaleLowerCase('tr'));
  const fill = Math.round((checks.filter(([, ok]) => ok).length / checks.length) * 100);
  const regionCenter = form.region ? REGION_CENTERS[form.region] : undefined;

  const onLocText = (v: string) => {
    setLocText(v);
    const c = parseLocation(v);
    if (c) setLocationPoint(c);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`En fazla ${MAX_IMAGES} fotoğraf eklenebilir; ${MAX_IMAGES - images.length} yer kaldı.`);
      return;
    }
    setError('');
    setUploading(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error('Görsel yükleme hatası:', err);
      setError('Fotoğraflardan biri okunamadı. JPG, PNG veya WebP seçin.');
    } finally {
      setUploading(false);
    }
  };

  const makeCover = (i: number) => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.price.trim() || !form.agentName.trim() || !form.agentPhone.trim()) {
      setError('Başlık, fiyat, danışman adı ve telefonu zorunlu.');
      return;
    }
    setSubmitting(true);
    setProgress('');
    const { deal, kind, ...rest } = form;
    try {
      const listing: NewListing = { ...rest, category: `${deal} ${kind}`, features, images, rooms: isLand ? '' : form.rooms, location: location ? formatLocation(location.lat, location.lng) : '' };
      await addListing(listing, owner.name || owner.phone ? owner : null, (d, t) => setProgress(`Fotoğraflar yükleniyor ${d}/${t}…`));
      onSaved(listing);
    } catch (err) {
      console.error('İlan eklenirken hata:', err);
      setError(err instanceof Error && err.message.startsWith('Fotoğraflar') ? err.message : 'İlan kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8" noValidate>
      <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Yeni ilan</h1>
        <p className="text-muted mt-1">Kaydedince ilan bütün ofisin portföyünde görünür. Fotoğraf şart değil, sonra “Düzenle” ile eklenebilir.</p>
      </div>

      <Section title="İlan" hint="Başlıkta konum, oda sayısı ve öne çıkan özellik olsun: “Altınova Kaytazdere sıfır 2+1 daire”.">
        <Field label="İlan başlığı" htmlFor="title" note={`${form.title.length} / 80`}>
          <input id="title" required maxLength={80} value={form.title} onChange={set('title')} className="field" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="İşlem" htmlFor="deal">
            <div className="flex h-10 rounded-full bg-ground p-1" role="group" id="deal" aria-label="İşlem">
              {DEALS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, deal: d }))}
                  aria-pressed={form.deal === d}
                  className={`flex-1 rounded-full text-sm transition-colors ${form.deal === d ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Cins" htmlFor="kind">
            <select id="kind" value={form.kind} onChange={set('kind')} className="field">
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label={form.deal === 'Kiralık' ? 'Aylık kira (TL)' : 'Fiyat (TL)'} htmlFor="price" note={form.price ? formatPrice(form.price) : undefined}>
            <input id="price" required inputMode="numeric" placeholder="2.500.000" value={form.price} onChange={set('price')} className="field num" />
          </Field>
          <Field label="Metrekare" htmlFor="size">
            <input id="size" inputMode="numeric" placeholder="120" value={form.size} onChange={set('size')} className="field num" />
          </Field>
        </div>
      </Section>

      <Section title="Konum ve tapu" hint="Bölge listede filtre olarak kullanılır. Ada/parsel yalnızca ofis içinde görünür; sunum modunda ve müşteriye giden metinde gizlenir.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Bölge" htmlFor="region">
            <select id="region" value={form.region} onChange={set('region')} className="field">
              <option value="">Seçin</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Mahalle / köy" htmlFor="hood">
            <input id="hood" placeholder="Kaytazdere" value={form.neighborhood} onChange={set('neighborhood')} className="field" />
          </Field>
          <Field label="Ada / parsel" htmlFor="ada">
            <input id="ada" placeholder="1234/56" value={form.adaParsel} onChange={set('adaParsel')} className="field num" />
          </Field>
          <Field label="İmar durumu" htmlFor="imar">
            <input id="imar" placeholder="Konut, ticari, tarla…" value={form.imarStatus} onChange={set('imarStatus')} className="field" />
          </Field>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
            <span className="text-sm font-medium">Haritada konum</span>
            <span className="text-xs text-faint num">{location ? formatLocation(location.lat, location.lng) : 'Haritaya tıklayın'}</span>
          </div>
          <MapView
            points={[]}
            center={regionCenter ?? YALOVA_CENTER}
            zoom={regionCenter ? 14 : 10}
            pick={location}
            onPick={(lat, lng) => {
              setLocationPoint({ lat, lng });
              setLocText('');
            }}
            label="Konum seçme haritası"
            className="h-[280px]"
          />
          <div className="mt-2 flex gap-2">
            <label htmlFor="loc" className="sr-only">Google Maps linki veya koordinat</label>
            <input id="loc" value={locText} onChange={(e) => onLocText(e.target.value)} placeholder="veya Google Maps linki / “40.69, 29.50” yapıştırın" className="field" />
            {location && (
              <button type="button" onClick={() => { setLocationPoint(null); setLocText(''); }} className={btnSecondary}>Temizle</button>
            )}
          </div>
          <p className="text-xs text-faint mt-1">Bölge seçince harita oraya yakınlaşır. Konum müşteriye giden metne Google Maps linki olarak eklenir.</p>
        </div>
        {duplicates.length > 0 && (
          <div role="alert" className="rounded-lg bg-warning-bg px-4 py-3 text-sm flex gap-3">
            <TriangleAlert className="w-4 h-4 text-warning flex-none mt-0.5" />
            <div>
              <p className="text-warning font-medium">Bu ada/parsel portföyde zaten var.</p>
              <ul className="mt-1 space-y-0.5">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a href={`#/ilan/${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {d.id} · {d.title}
                    </a>{' '}
                    <span className="text-muted">({d.agentName}, {d.status.toLocaleLowerCase('tr')})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-muted">Aynı mülkü ikinci kez girmeden önce ilgili danışmanla konuşun.</p>
            </div>
          </div>
        )}
      </Section>

      <Section title="Özellikler" hint={isLand ? 'Arsa ve tarlada oda, kat ve ısınma sorulmaz.' : 'Müşterinin ilk sorduğu bilgiler. Talepler oda sayısına göre eşleşir.'}>
        {!isLand && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Oda sayısı" htmlFor="rooms">
              <select id="rooms" value={form.rooms} onChange={set('rooms')} className="field">
                <option value="">Seçin</option>
                {ROOMS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Kat" htmlFor="floor">
              <input id="floor" placeholder="2 / 4" value={form.floor} onChange={set('floor')} className="field num" />
            </Field>
            <Field label="Bina yaşı" htmlFor="age">
              <input id="age" inputMode="numeric" placeholder="0" value={form.buildingAge} onChange={set('buildingAge')} className="field num" />
            </Field>
            <Field label="Isınma" htmlFor="heat">
              <select id="heat" value={form.heating} onChange={set('heating')} className="field">
                <option value="">Seçin</option>
                {HEATING.map((h) => <option key={h}>{h}</option>)}
              </select>
            </Field>
          </div>
        )}
        <fieldset>
          <legend className="text-sm font-medium mb-2">Öne çıkanlar</legend>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <label key={f} className={`h-9 px-3 rounded-full border text-sm flex items-center gap-2 cursor-pointer transition-colors ${features.includes(f) ? 'border-ink text-ink' : 'border-control text-muted hover:text-ink'}`}>
                <input type="checkbox" checked={features.includes(f)} onChange={() => toggleFeature(f)} className="sr-only" />
                {f}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Açıklama" hint="Konum, ulaşım, binanın durumu, öne çıkan özellikler. Müşteriye bu metin gider.">
        <label htmlFor="desc" className="sr-only">İlan açıklaması</label>
        <textarea id="desc" rows={7} value={form.description} onChange={set('description')} className="field h-auto py-2.5 leading-6 resize-y" />
      </Section>

      <Section title="Fotoğraflar" hint={`En fazla ${MAX_IMAGES} fotoğraf. Göndermeden önce küçültülür. İlk fotoğraf kapaktır; başka birini kapak yapmak için üstüne tıklayın.`}>
        <input id="images" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleFiles} disabled={uploading || images.length >= MAX_IMAGES} className="sr-only" />
        <label
          htmlFor="images"
          className={`h-24 rounded-lg border border-dashed border-control flex items-center justify-center gap-2 text-sm ${
            uploading || images.length >= MAX_IMAGES ? 'text-faint cursor-not-allowed' : 'text-muted cursor-pointer hover:border-ink hover:text-ink'
          }`}
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Fotoğraflar küçültülüyor…' : images.length >= MAX_IMAGES ? 'Fotoğraf sınırı doldu' : 'Fotoğraf seç veya telefondan çek'}
        </label>
        {images.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {images.map((src, i) => (
              <li key={i} className="relative">
                <button type="button" onClick={() => makeCover(i)} className="block w-full" aria-label={i === 0 ? 'Kapak fotoğrafı' : `Fotoğraf ${i + 1}: kapak yap`}>
                  <Thumb src={src} alt="" className="w-full aspect-[4/3] rounded" />
                </button>
                {i === 0 && <span className="absolute left-1.5 top-1.5 h-5 px-2 rounded-full bg-ink text-ground text-xs font-medium flex items-center">Kapak</span>}
                <button type="button" onClick={() => removeImage(i)} aria-label={`Fotoğraf ${i + 1} kaldır`} className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-faint num">{images.length} / {MAX_IMAGES} fotoğraf</p>
      </Section>

      <Section title="Mal sahibi ve yetki" hint="Yalnızca ofis içinde görünür. İlanlar sayfasına değil, yayınlanmayan “Mal Sahipleri” sayfasına yazılır.">
        <OwnerFields value={owner} onChange={setOwner} />
      </Section>

      <Section title="Danışman ve bağlantılar" hint="Danışman adı giriş yapan hesaptan gelir; ilan başka bir danışmana aitse değiştirin.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Danışman" htmlFor="agent">
            <input id="agent" required value={form.agentName} onChange={set('agentName')} className="field" />
          </Field>
          <Field label="Danışman telefonu" htmlFor="phone">
            <input id="phone" required type="tel" inputMode="tel" placeholder="0555 123 45 67" value={form.agentPhone} onChange={set('agentPhone')} className="field num" />
          </Field>
          <Field label="Sahibinden linki" htmlFor="sahibinden">
            <input id="sahibinden" type="url" placeholder="https://www.sahibinden.com/ilan/…" value={form.sahibindenUrl} onChange={set('sahibindenUrl')} className="field" />
          </Field>
          <Field label="WhatsApp linki (isteğe bağlı)" htmlFor="wa" note="Boşsa telefondan oluşturulur">
            <input id="wa" type="url" placeholder="https://wa.me/905551234567" value={form.whatsappUrl} onChange={set('whatsappUrl')} className="field" />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 lg:mx-0 px-4 lg:px-0 py-4 bg-ground border-t border-rule flex flex-wrap items-center justify-end gap-3">
        {error ? (
          <p role="alert" className="text-sm text-negative mr-auto">{error}</p>
        ) : (
          missing.length > 0 && <p className="text-sm text-muted mr-auto">Eksik: {missing.join(', ')}.</p>
        )}
        <a href="#/" className={btnSecondary}>Vazgeç</a>
        <button type="submit" disabled={submitting || uploading} className={`${btnPrimary} disabled:opacity-60 disabled:cursor-wait`}>
          {submitting ? progress || 'Kaydediliyor…' : 'İlanı kaydet'}
        </button>
      </div>
      </div>

      {/* Canlı önizleme: ilan listede böyle görünecek */}
      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-[14px]">
          <p className="text-sm text-muted">Önizleme</p>
          <div className="bg-surface rounded-xl overflow-hidden">
            <Thumb src={images[0]} alt="" className="w-full aspect-[4/3]" />
            <div className="p-[14px]">
              <p className="text-base font-semibold text-accent num">
                {form.price ? formatPrice(form.price) : 'Fiyat girilmedi'}
                {form.deal === 'Kiralık' && form.price && <span className="text-faint text-sm"> /ay</span>}
              </p>
              <p className="font-medium line-clamp-2">{form.title || 'İlan başlığı'}</p>
              <p className="text-xs text-faint mt-1">
                {[form.region, form.neighborhood].filter(Boolean).join(' ') || 'Bölge'} · {form.deal} {form.kind}
                {form.size ? ` · ${form.size} m²` : ''}
                {!isLand && form.rooms ? ` · ${form.rooms}` : ''}
              </p>
              <p className="text-sm mt-3">{form.agentName}</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-[14px]">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">İlan doluluğu</p>
              <p className="text-sm font-semibold num">%{fill}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-raised overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${fill}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {checks.map(([label, ok]) => (
                <li key={label} className={`flex items-center gap-2 ${ok ? '' : 'text-muted'}`}>
                  <span className={`w-4 h-4 rounded-full flex-none flex items-center justify-center text-[10px] ${ok ? 'bg-positive text-white' : 'border border-control'}`} aria-hidden="true">{ok ? '✓' : ''}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </form>
  );
}

// Ayar düzeni: solda başlık ve açıklama, sağda alanlar
function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4 lg:gap-8 py-8 border-t border-rule first-of-type:border-t-0 first-of-type:pt-0">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted mt-1">{hint}</p>
      </div>
      <div className="bg-surface rounded-xl p-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, note, children }: { label: string; htmlFor: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
        {note && <span className="text-xs text-faint num">{note}</span>}
      </div>
      {children}
    </div>
  );
}
