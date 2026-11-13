import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, X } from 'lucide-react';
import type { Property } from '../types';
import { REGIONS, compressImage, kindOf, updateListing, uploadImages, type ListingEdit } from '../lib/sheets';
import { canManageListing, isAdmin, isHiddenPerson } from '../lib/admin';
import { useDirectory } from '../lib/people';
import { Thumb } from './ui';
import { btnPrimary, btnSecondary } from './Dialog';

const KINDS = ['Daire', 'Villa / Müstakil', 'Arsa', 'Tarla / Bahçe', 'Dükkan / İşyeri', 'Bina'];
const ROOMS = ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1 ve üzeri'];
const HEATING = ['Doğalgaz kombi', 'Merkezi', 'Klima', 'Soba', 'Yerden ısıtma', 'Yok'];
const FEATURES = ['Eşyalı', 'Site içinde', 'Otopark', 'Asansör', 'Bahçeli', 'Deniz manzaralı', 'Havuzlu', 'Krediye uygun', 'Takasa uygun', 'Sıfır bina'];
const LAND = ['Arsa', 'Tarla / Bahçe'];
const MAX_IMAGES = 20;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const OFFICE = 'Palmiye Yatırım';

interface Props {
  property: Property;
  currentUser: string;
  userName: string;
  onSaved: (id: string, change: Partial<Property>) => void;
}

const digits = (s: string) => s.replace(/[^0-9]/g, '');

// İlanı düzenle: başlık, bilgiler, açıklama, fotoğraflar. Fiyat ilan sayfasındaki "Değiştir" ile değişir (eski fiyat saklansın diye).
export default function EditListing({ property: p, currentUser, userName, onSaved }: Props) {
  const allowed = canManageListing(p.agentName, userName, currentUser);
  const admin = isAdmin(currentUser);
  const directory = useDirectory();
  const deal0 = p.category.toLocaleLowerCase('tr').includes('kiralık') ? 'Kiralık' : 'Satılık';
  const kind0 = kindOf(p.category) || 'Daire';
  const [deal, setDeal] = useState(deal0);
  const [kind, setKind] = useState(kind0);
  const [f, setF] = useState({
    title: p.title,
    size: String(p.size ?? ''),
    description: p.description || '',
    region: p.region !== 'Belirtilmemiş' ? p.region : '',
    neighborhood: p.neighborhood || '',
    rooms: p.rooms || '',
    floor: p.floor || '',
    buildingAge: p.buildingAge || '',
    heating: p.heating || '',
    sahibindenUrl: p.sahibindenUrl || '',
    agentPhone: p.agentPhone || '',
    agentName: p.agentName || '',
  });
  const [features, setFeatures] = useState<string[]>(p.features);
  const [images, setImages] = useState<string[]>(p.images ?? []);
  const [busyPhotos, setBusyPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const isLand = LAND.includes(kind);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  // Yönetici ilanı başka danışmana atayabilir
  const agents = useMemo(() => {
    const names = directory.filter((u) => !isHiddenPerson(u.email)).map((u) => u.name);
    return Array.from(new Set([OFFICE, ...names, p.agentName].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [directory, p.agentName]);

  if (!allowed) {
    return (
      <div className="max-w-[720px] space-y-4">
        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className={btnSecondary}><ArrowLeft className="w-4 h-4" /> İlana dön</a>
        <p className="bg-surface rounded-xl p-5 text-muted">Bu ilanı yalnızca danışmanı ({p.agentName || 'atanmamış'}) ve yöneticiler düzenleyebilir.</p>
      </div>
    );
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return setError(`En fazla ${MAX_IMAGES} fotoğraf eklenebilir.`);
    setError('');
    setBusyPhotos(true);
    try {
      const added: string[] = [];
      for (const file of files.slice(0, room)) added.push(await compressImage(file));
      setImages((prev) => [...prev, ...added]);
    } catch {
      setError('Fotoğraflardan biri okunamadı. Başka bir fotoğraf seçin.');
    } finally {
      setBusyPhotos(false);
    }
  };
  const makeCover = (i: number) => setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));
  const toggleFeature = (x: string) => setFeatures((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]));

  const save = async () => {
    setError('');
    if (!f.title.trim()) return setError('Başlık boş olamaz.');
    setSaving(true);
    setProgress('');
    try {
      const uploaded = await uploadImages(images, (d, t) => setProgress(`Fotoğraflar yükleniyor ${d}/${t}…`));
      setProgress('Kaydediliyor…');
      const edit: ListingEdit = {
        title: f.title.trim(),
        category: `${deal} ${kind}`,
        size: digits(f.size),
        description: f.description.trim(),
        images: uploaded,
        region: f.region,
        neighborhood: f.neighborhood.trim(),
        rooms: isLand ? '' : f.rooms,
        floor: isLand ? '' : f.floor.trim(),
        buildingAge: isLand ? '' : digits(f.buildingAge),
        heating: isLand ? '' : f.heating,
        features,
        sahibindenUrl: f.sahibindenUrl.trim(),
        agentPhone: f.agentPhone.trim(),
        ...(admin && f.agentName !== p.agentName ? { agentName: f.agentName } : {}),
      };
      await updateListing(p.title, edit);
      onSaved(p.id, {
        title: edit.title,
        category: edit.category,
        size: edit.size,
        description: edit.description,
        images: uploaded,
        imageUrl: uploaded[0],
        region: edit.region || p.region,
        neighborhood: edit.neighborhood,
        rooms: edit.rooms,
        floor: edit.floor,
        buildingAge: edit.buildingAge,
        heating: edit.heating,
        features,
        sahibindenUrl: edit.sahibindenUrl,
        agentPhone: edit.agentPhone,
        ...(edit.agentName ? { agentName: edit.agentName } : {}),
        updatedAt: new Date(),
      });
      window.location.hash = `#/ilan/${encodeURIComponent(p.id)}`;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      setSaving(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-[720px] space-y-[14px] pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className={btnSecondary}><ArrowLeft className="w-4 h-4" /> Vazgeç</a>
        <p className="text-sm text-muted">İlanı düzenle · <span className="num">{p.id}</span></p>
      </div>

      {/* Fotoğraflar */}
      <section className="bg-surface rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold">Fotoğraflar</h2>
        <div className="grid grid-cols-2 gap-2 max-w-[420px]">
          <input id="ed-cam" type="file" accept={IMAGE_TYPES} capture="environment" onChange={handleFiles} disabled={busyPhotos || images.length >= MAX_IMAGES} className="sr-only" />
          <label htmlFor="ed-cam" className={`${btnPrimary} justify-center cursor-pointer h-11 ${busyPhotos ? 'opacity-60' : ''}`}><Camera className="w-4 h-4" /> Çek</label>
          <input id="ed-gal" type="file" multiple accept={IMAGE_TYPES} onChange={handleFiles} disabled={busyPhotos || images.length >= MAX_IMAGES} className="sr-only" />
          <label htmlFor="ed-gal" className={`${btnSecondary} justify-center cursor-pointer h-11 ${busyPhotos ? 'opacity-60' : ''}`}><ImagePlus className="w-4 h-4" /> Galeriden</label>
        </div>
        {busyPhotos && <p className="text-sm text-muted" role="status">Fotoğraf hazırlanıyor…</p>}
        {images.length === 0 ? (
          <p className="text-sm text-warning">Bu ilanda fotoğraf yok. Fotoğraflı ilanlar çok daha fazla ilgi görür.</p>
        ) : (
          <>
            <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {images.map((src, i) => (
                <li key={`${i}-${src.slice(-24)}`} className="relative">
                  <button type="button" onClick={() => makeCover(i)} className="block w-full" aria-label={i === 0 ? 'Kapak fotoğrafı' : `Fotoğraf ${i + 1}: kapak yap`}>
                    <Thumb src={src} alt="" className="w-full aspect-square rounded-lg" />
                  </button>
                  {i === 0 && <span className="absolute left-1.5 top-1.5 h-6 px-2 rounded-full bg-ink text-ground text-[12px] font-medium flex items-center">Kapak</span>}
                  <button type="button" onClick={() => removeImage(i)} aria-label={`Fotoğraf ${i + 1} kaldır`} className="absolute -right-1 -top-1 w-10 h-10 flex items-center justify-center">
                    <span className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-4 h-4" /></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-faint num">{images.length} / {MAX_IMAGES} · kapak yapmak için fotoğrafa dokunun</p>
          </>
        )}
      </section>

      {/* Temel bilgiler */}
      <section className="bg-surface rounded-xl p-5 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="ed-title" className="block text-sm font-medium mb-2">İlan başlığı</label>
          <input id="ed-title" maxLength={80} value={f.title} onChange={set('title')} className="field" />
        </div>
        <div>
          <label htmlFor="ed-deal" className="block text-sm font-medium mb-2">İşlem</label>
          <select id="ed-deal" value={deal} onChange={(e) => setDeal(e.target.value)} className="field">
            <option>Satılık</option>
            <option>Kiralık</option>
          </select>
        </div>
        <div>
          <label htmlFor="ed-kind" className="block text-sm font-medium mb-2">Cins</label>
          <select id="ed-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field">
            {Array.from(new Set([...KINDS, kind])).map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ed-region" className="block text-sm font-medium mb-2">İlçe</label>
          <select id="ed-region" value={f.region} onChange={set('region')} className="field">
            <option value="">Seçin</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ed-nb" className="block text-sm font-medium mb-2">Mahalle / köy</label>
          <input id="ed-nb" value={f.neighborhood} onChange={set('neighborhood')} className="field" />
        </div>
        <div>
          <label htmlFor="ed-size" className="block text-sm font-medium mb-2">Metrekare</label>
          <input id="ed-size" inputMode="numeric" value={f.size} onChange={set('size')} className="field num" />
        </div>
        {!isLand && (
          <>
            <div>
              <label htmlFor="ed-rooms" className="block text-sm font-medium mb-2">Oda sayısı</label>
              <select id="ed-rooms" value={f.rooms} onChange={set('rooms')} className="field">
                <option value="">Seçin</option>
                {Array.from(new Set([...ROOMS, f.rooms].filter(Boolean))).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ed-floor" className="block text-sm font-medium mb-2">Kat</label>
              <input id="ed-floor" placeholder="2 / 4" value={f.floor} onChange={set('floor')} className="field num" />
            </div>
            <div>
              <label htmlFor="ed-age" className="block text-sm font-medium mb-2">Bina yaşı</label>
              <input id="ed-age" inputMode="numeric" value={f.buildingAge} onChange={set('buildingAge')} className="field num" />
            </div>
            <div>
              <label htmlFor="ed-heat" className="block text-sm font-medium mb-2">Isınma</label>
              <select id="ed-heat" value={f.heating} onChange={set('heating')} className="field">
                <option value="">Seçin</option>
                {Array.from(new Set([...HEATING, f.heating].filter(Boolean))).map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
          </>
        )}
      </section>

      {/* Öne çıkanlar ve açıklama */}
      <section className="bg-surface rounded-xl p-5 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Öne çıkanlar</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...FEATURES, ...features])).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => toggleFeature(x)}
                aria-pressed={features.includes(x)}
                className={`h-9 px-3 rounded-full text-sm border ${features.includes(x) ? 'bg-ink text-ground border-ink' : 'border-control text-muted'}`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="ed-desc" className="block text-sm font-medium mb-2">Açıklama</label>
          <textarea id="ed-desc" rows={7} value={f.description} onChange={set('description')} placeholder="Konum, ulaşım, binanın durumu… Müşteriye bu metin gider." className="field h-auto py-2 leading-6" />
        </div>
      </section>

      {/* Danışman ve bağlantılar */}
      <section className="bg-surface rounded-xl p-5 grid sm:grid-cols-2 gap-4">
        {admin ? (
          <div>
            <label htmlFor="ed-agent" className="block text-sm font-medium mb-2">Danışman (yönetici değiştirebilir)</label>
            <select id="ed-agent" value={f.agentName} onChange={set('agentName')} className="field">
              {agents.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">Danışman</p>
            <p className="h-10 px-3 rounded-lg bg-raised flex items-center text-sm">{p.agentName}</p>
          </div>
        )}
        <div>
          <label htmlFor="ed-phone" className="block text-sm font-medium mb-2">Danışman telefonu</label>
          <input id="ed-phone" type="tel" inputMode="tel" value={f.agentPhone} onChange={set('agentPhone')} className="field num" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ed-sah" className="block text-sm font-medium mb-2">Sahibinden linki</label>
          <input id="ed-sah" type="url" inputMode="url" placeholder="https://www.sahibinden.com/ilan/…" value={f.sahibindenUrl} onChange={set('sahibindenUrl')} className="field" />
        </div>
        <p className="sm:col-span-2 text-xs text-faint">Fiyatı ilan sayfasındaki "Değiştir" ile güncelleyin; eski fiyat saklanır ve talebi uyan müşterilere haber gider. Ada/parsel ve imar bilgisi "Parsel ve imar" kartından düzenlenir.</p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-negative-bg px-4 py-3 text-sm text-negative">{error}</p>}

      <div className="sticky bottom-20 lg:bottom-4 z-20 flex gap-2 justify-end">
        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className={`${btnSecondary} bg-ground h-11`}>Vazgeç</a>
        <button onClick={save} disabled={saving || busyPhotos} className={`${btnPrimary} h-11 px-6 disabled:opacity-60`}>
          {saving ? progress || 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
