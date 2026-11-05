import { ArrowLeft, Printer } from 'lucide-react';
import type { Property } from '../types';
import { formatPhone, formatPrice, isRent, parseSize, pricePerM2 } from '../lib/sheets';
import { useSettings } from '../lib/settings';
import { btnPrimary, btnSecondary } from './Dialog';

// Müşteriye verilecek broşür. Kâğıt beyaz olduğu için tema renkleri değil sabit renkler kullanılır.
// Ada/parsel, mal sahibi ve ofis notları bilerek yok.
export default function Brochure({ property: p }: { property: Property }) {
  const { settings } = useSettings();
  const images = p.images ?? [];
  const size = parseSize(p.size);
  const facts = [
    ['Kategori', p.category],
    ['Metrekare', size ? `${size.toLocaleString('tr-TR')} m²` : ''],
    ['Oda sayısı', p.rooms],
    ['Kat', p.floor],
    ['Bina yaşı', p.buildingAge],
    ['Isınma', p.heating],
    ['İmar durumu', p.imarStatus],
    ['m² fiyatı', !isRent(p) ? pricePerM2(p) ?? '' : ''],
  ].filter(([, v]) => v) as [string, string][];
  const place = [p.neighborhood, p.region !== 'Belirtilmemiş' ? p.region : '', 'Yalova'].filter(Boolean).join(', ');

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className={btnSecondary}><ArrowLeft className="w-4 h-4" /> İlana dön</a>
        <p className="text-sm text-muted flex-1 min-w-[200px]">Yazdır penceresinde “PDF olarak kaydet” seçerek dosya olarak gönderebilirsiniz.</p>
        <button onClick={() => window.print()} className={btnPrimary}><Printer className="w-4 h-4" /> Yazdır / PDF</button>
      </div>

      <article className="mx-auto max-w-[800px] bg-white text-[#141513] rounded-xl print:rounded-none p-8 sm:p-10 print:p-0" style={{ colorScheme: 'light' }}>
        <header className="flex items-center justify-between gap-4 pb-5 border-b border-[#e6e6e3]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Palmiye Yatırım" className="h-12 w-auto logo-chip-always" />
            <div>
              <p className="font-semibold">Palmiye Yatırım</p>
              <p className="text-xs text-[#5d605a]">Yalova gayrimenkul</p>
            </div>
          </div>
          <p className="text-xs text-[#5d605a] num">İlan no {p.id}</p>
        </header>

        <div className="mt-6">
          <h1 className="text-lg sm:text-2xl font-semibold leading-tight">{p.title}</h1>
          <p className="mt-1 text-[#5d605a]">{place}</p>
          <p className="mt-3 text-3xl font-semibold num text-[#047857]">
            {formatPrice(p.price)}
            {isRent(p) && <span className="text-base text-[#5d605a] font-normal"> / ay</span>}
          </p>
        </div>

        {images.length > 0 && (
          <div className="mt-6 grid grid-cols-4 gap-2">
            <img src={images[0]} alt="" className="col-span-4 w-full aspect-[16/9] object-cover rounded-lg" />
            {images.slice(1, 5).map((src, i) => (
              <img key={i} src={src} alt="" className="w-full aspect-[4/3] object-cover rounded" />
            ))}
          </div>
        )}

        {facts.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[#5d605a]">{k}</dt>
                <dd className="font-medium num">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {p.features.length > 0 && <p className="mt-5 text-sm"><span className="font-medium">Öne çıkanlar:</span> {p.features.join(', ')}</p>}

        {p.description && <p className="mt-5 text-[15px] leading-6 whitespace-pre-line">{p.description}</p>}

        <footer className="mt-8 pt-5 border-t border-[#e6e6e3] flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#5d605a]">Bilgi ve gösterim için</p>
            <p className="font-semibold">{p.agentName}</p>
            {p.agentPhone && <p className="num">{formatPhone(p.agentPhone)}</p>}
          </div>
          <p className="text-sm text-[#5d605a]">{settings.shareSignature}</p>
        </footer>
      </article>
    </div>
  );
}
