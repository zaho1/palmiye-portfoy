import { useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import type { Property } from '../types';
import { formatPhone, formatPrice, isRent, parsePrice, parseSize } from '../lib/sheets';
import { buildComps, compStats, fmtTL, useComps } from '../lib/comps';
import { useSettings } from '../lib/settings';
import { personOf } from '../lib/people';
import { btnPrimary, btnSecondary } from './Dialog';

interface Props {
  property: Property;
  properties: Property[];
  userName: string;
  currentUser: string;
}

const today = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const digits = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;

// Mal sahibine verilecek piyasa değerlendirmesi. Kâğıt beyaz: sabit renkler.
// Ada/parsel, mal sahibi bilgisi, emsal linkleri ve ofis içi notlar rapora girmez.
export default function ValuationReport({ property: p, properties, userName, currentUser }: Props) {
  const { settings } = useSettings();
  const userPhone = settings.phone || personOf(currentUser)?.phone || '';
  const { comps, sales, state } = useComps();
  const items = useMemo(() => buildComps(p, properties, comps, sales).filter((i) => i.perM2 > 0), [p, properties, comps, sales]);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selectedKeys = picked ?? new Set(items.slice(0, 8).map((i) => i.key));
  const chosen = items.filter((i) => selectedKeys.has(i.key));
  const stats = useMemo(() => compStats(p, chosen, chosen.length || 1), [p, chosen]);
  const rent = isRent(p);
  const size = parseSize(p.size);

  const [ownerName, setOwnerName] = useState('');
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [comment, setComment] = useState('');
  const estLow = digits(low) || stats.estimate?.low || 0;
  const estHigh = digits(high) || stats.estimate?.high || 0;

  const toggle = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
  };

  const place = [p.neighborhood, p.region !== 'Belirtilmemiş' ? p.region : '', 'Yalova'].filter(Boolean).join(', ');
  const facts = [
    ['Kategori', p.category],
    ['Konum', place],
    ['Metrekare', size ? `${size.toLocaleString('tr-TR')} m²` : ''],
    ['Oda sayısı', p.rooms],
    ['Kat', p.floor],
    ['Bina yaşı', p.buildingAge],
    ['Isınma', p.heating],
    ['İmar durumu', p.imarStatus],
    ['TAKS / KAKS', [p.taks, p.kaks].filter(Boolean).join(' / ')],
  ].filter(([, v]) => v) as [string, string][];
  const listPrice = parsePrice(p.price);

  return (
    <div>
      {/* Yazdırılmayan hazırlık alanı */}
      <div className="no-print space-y-4 mb-6 max-w-[800px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href={`#/emsal/${encodeURIComponent(p.id)}`} className={btnSecondary}><ArrowLeft className="w-4 h-4" /> Emsallere dön</a>
          <button onClick={() => window.print()} className={btnPrimary} disabled={!chosen.length && !estLow}><Printer className="w-4 h-4" /> Yazdır / PDF</button>
        </div>
        <div className="bg-surface rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted">Raporu hazırlayın. Yazdır penceresinde "PDF olarak kaydet" ile dosya olarak gönderebilirsiniz.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="r-owner" className="block text-sm font-medium mb-2">Kime (isteğe bağlı)</label>
              <input id="r-owner" placeholder="Ahmet Yılmaz" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="r-low" className="block text-sm font-medium mb-2">Alt değer (TL)</label>
              <input id="r-low" inputMode="numeric" placeholder={stats.estimate ? stats.estimate.low.toLocaleString('tr-TR') : 'Elle girin'} value={low} onChange={(e) => setLow(e.target.value)} className="field num" />
            </div>
            <div>
              <label htmlFor="r-high" className="block text-sm font-medium mb-2">Üst değer (TL)</label>
              <input id="r-high" inputMode="numeric" placeholder={stats.estimate ? stats.estimate.high.toLocaleString('tr-TR') : 'Elle girin'} value={high} onChange={(e) => setHigh(e.target.value)} className="field num" />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="r-comment" className="block text-sm font-medium mb-2">Danışman yorumu (isteğe bağlı)</label>
              <textarea id="r-comment" rows={2} placeholder="Örn. Deniz manzarası ve yeni bina olması değeri üst banda taşıyor." value={comment} onChange={(e) => setComment(e.target.value)} className="field h-auto py-2" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Rapora girecek emsaller ({chosen.length})</p>
            {state === 'loading' && !items.length ? (
              <p className="text-sm text-muted mt-1">Emsaller yükleniyor…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted mt-1">
                Metrekaresi bilinen emsal yok. <a href={`#/emsal/${encodeURIComponent(p.id)}`} className="underline underline-offset-2">Emsal ekleyin</a> ya da değer aralığını elle girin.
              </p>
            ) : (
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {items.slice(0, 20).map((i) => (
                  <li key={i.key}>
                    <label className="flex items-center gap-3 min-h-10 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedKeys.has(i.key)} onChange={() => toggle(i.key)} className="w-4 h-4 accent-current" />
                      <span className="flex-1 min-w-0 truncate">{i.title}</span>
                      <span className="num text-muted">{i.perM2.toLocaleString('tr-TR')} TL/m²</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Rapor */}
      <article className="mx-auto max-w-[800px] bg-white text-[#141513] rounded-xl print:rounded-none p-8 sm:p-10 print:p-0" style={{ colorScheme: 'light' }}>
        <header className="flex items-center justify-between gap-4 pb-5 border-b border-[#e6e6e3]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Palmiye Yatırım" className="h-12 w-auto logo-chip-always" />
            <div>
              <p className="font-semibold">Palmiye Yatırım</p>
              <p className="text-xs text-[#5d605a]">Yalova gayrimenkul</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#5d605a]">{today()}</p>
            <p className="text-xs text-[#5d605a] num">Ref. {p.id}</p>
          </div>
        </header>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-[#5d605a]">Piyasa değerlendirme raporu</p>
          <h1 className="mt-1 text-lg sm:text-2xl font-semibold leading-tight">{p.title}</h1>
          {ownerName.trim() && <p className="mt-2 text-sm">Sayın {ownerName.trim()},</p>}
          <p className="mt-2 text-sm leading-6 text-[#3b3d39]">
            Mülkünüz için bölgedeki benzer {rent ? 'kiralık' : 'satılık'} ilanlar ve gerçekleşen işlemler incelenerek bir piyasa değerlendirmesi hazırlanmıştır.
          </p>
        </div>

        <section className="mt-6 rounded-lg bg-[#f2f5f1] p-5">
          <p className="text-sm text-[#5d605a]">Tahmini {rent ? 'aylık kira' : 'piyasa değeri'} aralığı</p>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold num text-[#047857]">
            {estLow && estHigh ? `${fmtTL(estLow)} – ${fmtTL(estHigh)}` : 'Değerlendirme için emsal gerekli'}
          </p>
          {stats.count > 0 && (
            <p className="mt-2 text-sm text-[#3b3d39]">
              {stats.count} emsalde m² {rent ? 'kirası' : 'fiyatı'} ortalama (medyan) <span className="num font-medium">{fmtTL(stats.median)}</span>
              {size ? <>, {size.toLocaleString('tr-TR')} m² için orta değer <span className="num font-medium">{fmtTL(Math.round((stats.median * size) / 10000) * 10000)}</span></> : null}.
            </p>
          )}
          {listPrice > 0 && <p className="mt-1 text-sm text-[#5d605a]">Mevcut ilan fiyatı: <span className="num">{formatPrice(p.price)}</span></p>}
        </section>

        {comment.trim() && (
          <section className="mt-5">
            <h2 className="font-semibold">Danışman değerlendirmesi</h2>
            <p className="mt-1 text-[15px] leading-6 whitespace-pre-line">{comment.trim()}</p>
          </section>
        )}

        {facts.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold">Mülk bilgileri</h2>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-[#5d605a]">{k}</dt>
                  <dd className="font-medium num">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {chosen.length > 0 && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="font-semibold">Karşılaştırılan emsaller</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5d605a] border-b border-[#e6e6e3]">
                  <th className="py-2 font-normal">Konum</th>
                  <th className="py-2 font-normal">Oda</th>
                  <th className="py-2 font-normal text-right">m²</th>
                  <th className="py-2 font-normal text-right">Fiyat</th>
                  <th className="py-2 font-normal text-right">TL/m²</th>
                  <th className="py-2 font-normal text-right">Durum</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((i) => (
                  <tr key={i.key} className="border-b border-[#efefec]">
                    <td className="py-2">{[i.neighborhood, i.region !== 'Belirtilmemiş' ? i.region : ''].filter(Boolean).join(', ') || 'Yalova'}</td>
                    <td className="py-2">{i.rooms || '—'}</td>
                    <td className="py-2 text-right num">{i.size.toLocaleString('tr-TR')}</td>
                    <td className="py-2 text-right num">{i.price.toLocaleString('tr-TR')}</td>
                    <td className="py-2 text-right num">{i.perM2.toLocaleString('tr-TR')}</td>
                    <td className="py-2 text-right">{i.state === 'Satıldı' ? 'Satıldı' : 'İlanda'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[#5d605a]">İlandaki fiyatlar pazarlık payı içerebilir; satılanlar gerçekleşen işlemleri gösterir.</p>
          </section>
        )}

        <section className="mt-6 text-xs leading-5 text-[#5d605a]">
          <p>
            <span className="font-medium text-[#3b3d39]">Yöntem:</span> Aynı kategori ve bölgedeki benzer mülklerin metrekare fiyatları karşılaştırılmış, alt ve üst değer emsallerin orta yarısına göre hesaplanmıştır.
          </p>
          <p className="mt-1">
            Bu rapor bilgilendirme amaçlı bir piyasa değerlendirmesidir. SPK lisanslı değerleme uzmanınca hazırlanan resmi değerleme (ekspertiz) raporu yerine geçmez; kredi, tapu ve resmi işlemlerde kullanılamaz.
          </p>
        </section>

        <footer className="mt-8 pt-5 border-t border-[#e6e6e3] flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#5d605a]">Hazırlayan</p>
            <p className="font-semibold">{userName}</p>
            {userPhone && <p className="num">{formatPhone(userPhone)}</p>}
          </div>
          <p className="text-sm text-[#5d605a]">{settings.shareSignature}</p>
        </footer>
      </article>
    </div>
  );
}
