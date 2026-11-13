import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Calculator, FileText, Home, Lightbulb, Plus, Search, Share2, Smartphone, Users, X } from 'lucide-react';
import { usePush } from '../lib/push';
import { detectPlatform, isStandalone } from '../lib/pwa';

/**
 * İlk açılışta (ve Ben › Nasıl kullanılır'dan) gösterilen kısa tanıtım.
 * Bir kez kapatılınca bu cihazda tekrar açılmaz.
 */

const SEEN_KEY = 'palmiye_onboarded_v1';
const OPEN_EVENT = 'palmiye:onboarding';

export const openOnboarding = () => window.dispatchEvent(new Event(OPEN_EVENT));

const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* önemsiz */
  }
};

interface Step {
  icon: ReactNode;
  title: string;
  points: ReactNode[];
}

function steps(isIphoneBrowser: boolean): Step[] {
  const list: Step[] = [
    {
      icon: <Home className="w-6 h-6" />,
      title: 'Palmiye Portföy\'e hoş geldin',
      points: [
        'Ofisin bütün ilanları, müşteri talepleri ve ekip tek yerde. Bilgiler canlıdır: biri ilan ekleyince herkeste görünür.',
        'Alttaki menü: Bugün (yapılacaklar ve ofiste olanlar), İlanlar, ortadaki + (ekle), Talepler ve Ben.',
        'Aşağı çekerek ekranı yenileyebilirsin.',
      ],
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: 'İlan bulmak',
      points: [
        'Arama kutusuna başlık, mahalle ya da ilan no (PLM-…) yaz.',
        'Filtrelerle satılık/kiralık, cins, ilçe ve fiyat aralığı seç; sık kullandığın filtreyi kaydedebilirsin.',
        '"Bana en yakın" ile bulunduğun yere yakın ilanlar sıralanır. Yıldızla favorilerine eklersin.',
      ],
    },
    {
      icon: <Plus className="w-6 h-6" />,
      title: 'İlan eklemek ve güncel tutmak',
      points: [
        'Ortadaki + düğmesi › İlan. Fotoğraf şart değil; eklemezsen 24 saat sonra sana hatırlatma gelir.',
        'Yarım kalan ilan telefonda saklanır, sinyal gitse de kaybolmaz.',
        'Kendi ilanında "Düzenle", fiyat, "Satıldı", "Pasife al" ve "Sil" sende. Başkasının ilanında bunları yalnızca o danışman ve yöneticiler yapabilir.',
        'Mal sahibiyle konuştukça "Güncel"e bas. Uzun süre teyit edilmeyen ilanlar sarıyla işaretlenir.',
      ],
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: 'Müşteriyle paylaşmak',
      points: [
        '"Müşteriye gönder" hazır bir WhatsApp metni oluşturur. Ada/parsel, mal sahibi ve ofis içi bilgiler bu metne asla girmez.',
        '"Broşür" yazdırılabilir, PDF olarak gönderilebilir.',
        'Müşteri yanındayken Ben › "Sunum modu"nu aç: ofis içi bilgiler ekrandan gizlenir.',
      ],
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Müşteri talepleri',
      points: [
        '+ › Talep ile müşterinin ne aradığını gir: satılık/kiralık, cins, bölge, bütçe.',
        'Ofise uyan bir ilan eklenince ya da fiyatı düşünce sana bildirim gelir.',
        'Takip tarihi verirsen "Bugün" ekranında aranacaklar listesine düşer.',
      ],
    },
    {
      icon: <Calculator className="w-6 h-6" />,
      title: 'Emsal ve değerleme',
      points: [
        'İlanda "Emsal bak": benzer ilanlar, bölgenin m² ortalaması ve sahibinden\'de hazır filtreli arama.',
        'Sahibinden\'de iyi bir emsal görünce "Emsal ekle" ile kaydet; herkesin analizine katkı olur.',
        '"Değerleme raporu" mal sahibine verilecek, emsalli bir rapor hazırlar (resmi ekspertiz değildir).',
        '"Parsel ve imar" kartına ada/parsel ve imar bilgisini gir; TKGM ve belediyeye tek tuşla gidersin.',
      ],
    },
  ];
  if (isIphoneBrowser) {
    list.push({
      icon: <Smartphone className="w-6 h-6" />,
      title: 'Uygulamayı ana ekrana ekle',
      points: [
        'Safari\'de alttaki Paylaş simgesine (kare ve yukarı ok) bas, "Ana Ekrana Ekle"yi seç.',
        'Bildirimler iPhone\'da yalnızca ana ekrandan açılan uygulamada çalışır. Ekledikten sonra uygulamayı oradan aç.',
      ],
    });
  }
  return list;
}

export default function Onboarding() {
  const [open, setOpen] = useState(() => !seen());
  const [i, setI] = useState(0);
  const push = usePush();
  const isIphoneBrowser = detectPlatform() === 'ios' && !isStandalone();
  const all = steps(isIphoneBrowser);
  const total = all.length + 1; // son adım: bildirimler
  const last = i === total - 1;

  useEffect(() => {
    const show = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  if (!open) return null;
  const close = () => {
    markSeen();
    setOpen(false);
  };
  const step = all[i];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label="Nasıl kullanılır">
      <div className="w-full sm:max-w-[520px] bg-ground sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-[13px] text-faint num">{i + 1} / {total}</p>
          <button onClick={close} aria-label="Kapat" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-2 overflow-y-auto">
          {!last ? (
            <>
              <span className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">{step.icon}</span>
              <h2 className="mt-3 text-xl font-semibold leading-7">{step.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {step.points.map((t, k) => (
                  <li key={k} className="flex gap-2.5 text-[15px] leading-6">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <span className="w-12 h-12 rounded-full bg-surface flex items-center justify-center"><Bell className="w-6 h-6" /></span>
              <h2 className="mt-3 text-xl font-semibold leading-7">Bildirimleri aç</h2>
              <ul className="mt-3 space-y-2.5 text-[15px] leading-6">
                <li>Müşterine uyan yeni ilan, fiyatı düşen ilan, aranacak müşterilerin ve ofisteki yeni ilan ve satışlar telefonuna gelir.</li>
                <li className="text-muted">Telefon izin isteyecek, "İzin Ver"e bas. İstersen sonra Ben sekmesinden kapatabilirsin.</li>
              </ul>
              <div className="mt-4">
                {push.state === 'on' ? (
                  <p className="text-positive font-medium">Bildirimler bu cihazda açık.</p>
                ) : push.state === 'needs-install' ? (
                  <p className="text-[14px] text-warning">iPhone'da önce uygulamayı ana ekrana ekle, sonra ana ekrandan açıp Ben sekmesinden bildirimleri aç.</p>
                ) : push.state === 'denied' ? (
                  <p className="text-[14px] text-warning">Bildirim izni kapalı. Telefon Ayarları'nda bu uygulama için bildirimlere izin ver.</p>
                ) : push.state === 'unsupported' ? (
                  <p className="text-[14px] text-muted">Bu tarayıcı bildirim desteklemiyor.</p>
                ) : (
                  <button onClick={push.enable} disabled={push.busy} className="w-full h-12 rounded-full bg-ink text-ground font-semibold disabled:opacity-60">
                    {push.busy ? 'Açılıyor…' : 'Bildirimleri aç'}
                  </button>
                )}
                {push.error && <p className="mt-2 text-[14px] text-negative">{push.error}</p>}
              </div>
              <p className="mt-5 text-[14px] text-muted flex gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                Bir sorun ya da fikrin olursa Ben › "Geri bildirim yaz". Bu tanıtımı Ben › "Nasıl kullanılır"dan tekrar açabilirsin.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-rule mt-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="h-11 px-5 rounded-full border border-control text-[15px]">Geri</button>
          )}
          <span className="flex-1" />
          {!last ? (
            <>
              {i === 0 && <button onClick={close} className="h-11 px-4 text-[15px] text-muted">Atla</button>}
              <button onClick={() => setI(i + 1)} className="h-11 px-6 rounded-full bg-ink text-ground text-[15px] font-semibold">İleri</button>
            </>
          ) : (
            <button onClick={close} className="h-11 px-6 rounded-full bg-ink text-ground text-[15px] font-semibold">Başla</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Ben / Ayarlar'da tekrar açmak için
export function OnboardingLink({ className = '' }: { className?: string }) {
  return (
    <button type="button" onClick={openOnboarding} className={className}>
      <FileText className="w-4 h-4" /> Nasıl kullanılır
    </button>
  );
}
