import { useState } from 'react';
import { usePush } from '../../lib/push';
import { postRead } from '../../lib/sheets';
import { btnBig, btnBigSecondary } from './controls';
import { CheckIcon } from './icons';

const DISMISS_KEY = 'palmiye_push_dismissed';
const dismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

// Bugün ekranında: bildirim henüz açılmadıysa bir kez önerilir
export function PushBanner() {
  const { state, busy, enable, error } = usePush();
  const [hidden, setHidden] = useState(dismissed);
  if (state !== 'off' || hidden) return null;
  return (
    <section className="bg-surface rounded-2xl p-4">
      <h2 className="text-[16px] font-semibold">Bildirimleri aç</h2>
      <p className="mt-1 text-[14px] text-muted leading-5">Müşterine uyan yeni ilan geldiğinde ve aranacak müşterin olduğunda telefonuna haber verelim.</p>
      {error && <p role="alert" className="mt-2 text-[13px] text-negative">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button onClick={enable} disabled={busy} className={`${btnBig} flex-1`}>{busy ? 'Açılıyor…' : 'Bildirimleri aç'}</button>
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              /* önemsiz */
            }
            setHidden(true);
          }}
          className={`${btnBigSecondary} px-4`}
        >
          Sonra
        </button>
      </div>
    </section>
  );
}

// Ben sekmesinde: açma/kapama, ofis haberleri, deneme
export function PushSettings() {
  const { state, news, busy, error, enable, disable, setNews } = usePush();
  const [tested, setTested] = useState(false);

  const body =
    state === 'unsupported' ? (
      <p className="text-[14px] text-muted">Bu tarayıcı bildirim desteklemiyor. iPhone'da Safari, Android'de Chrome kullanın.</p>
    ) : state === 'needs-install' ? (
      <p className="text-[14px] text-muted leading-5">iPhone'da bildirimler yalnızca ana ekrana eklenmiş uygulamada çalışır. Önce yukarıdaki "Uygulamayı telefona yükle" adımlarını yapın, sonra uygulamayı ana ekrandan açıp buradan bildirimleri açın.</p>
    ) : state === 'denied' ? (
      <p className="text-[14px] text-muted leading-5">Bildirim izni kapalı. Telefon Ayarları'nda Palmiye (veya Safari/Chrome) için bildirimlere izin verin, sonra buraya dönün.</p>
    ) : state === 'off' ? (
      <>
        <p className="text-[14px] text-muted leading-5">Müşterine uyan yeni ilan, fiyatı düşen ilan ve aranacak müşterilerin için telefonuna haber gelir.</p>
        <button onClick={enable} disabled={busy} className={`${btnBig} w-full mt-3`}>{busy ? 'Açılıyor…' : 'Bildirimleri aç'}</button>
      </>
    ) : (
      <>
        <p className="text-[14px] text-positive flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Bu telefonda açık</p>
        <button
          type="button"
          onClick={() => setNews(!news)}
          aria-pressed={news}
          className="mt-3 w-full min-h-12 flex items-center gap-3 text-left"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[16px]">Ofis haberleri</span>
            <span className="block text-[13px] text-faint">Yeni eklenen ilan ve satış duyuruları</span>
          </span>
          <span className={`h-8 px-3 rounded-full text-[14px] font-medium flex items-center ${news ? 'bg-ink text-ground' : 'bg-raised text-muted'}`}>{news ? 'Açık' : 'Kapalı'}</span>
        </button>
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => {
              postRead({ action: 'pushTest' }).then(() => setTested(true)).catch(() => undefined);
            }}
            className={`${btnBigSecondary} flex-1`}
          >
            {tested ? 'Gönderildi' : 'Deneme gönder'}
          </button>
          <button onClick={disable} disabled={busy} className={`${btnBigSecondary} flex-1`}>Kapat</button>
        </div>
      </>
    );

  return (
    <section className="bg-surface rounded-2xl p-4">
      <h2 className="text-[16px] font-semibold mb-2">Bildirimler</h2>
      {body}
      {error && <p role="alert" className="mt-2 text-[13px] text-negative">{error}</p>}
    </section>
  );
}
