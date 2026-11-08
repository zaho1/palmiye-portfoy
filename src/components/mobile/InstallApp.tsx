import { useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useInstall } from '../../lib/pwa';
import { IosShareIcon, SmartphoneIcon, SquarePlusIcon } from './icons';
import { Sheet, btnBig } from './controls';

const DISMISS_KEY = 'palmiye_install_dismissed';

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="w-8 h-8 rounded-full bg-raised flex items-center justify-center text-sm font-semibold shrink-0">{n}</span>
      <p className="text-[15px] leading-6 pt-0.5">{children}</p>
    </li>
  );
}

function useInstallFlow() {
  const inst = useInstall();
  const [steps, setSteps] = useState(false);
  // Android/Chrome'da tarayıcının yükleme penceresi açılır; olay yoksa (iPhone vb.) adımlar gösterilir
  const start = async () => {
    if (inst.canPrompt) await inst.prompt();
    else setSteps(true);
  };
  return { ...inst, steps, setSteps, start };
}

function StepsSheet({ platform, onClose }: { platform: 'ios' | 'android' | 'other'; onClose: () => void }) {
  return (
    <Sheet title="Uygulamayı telefona yükle" onClose={onClose} footer={<button onClick={onClose} className={`${btnBig} w-full`}>Tamam</button>}>
      {platform === 'ios' ? (
        <ol className="space-y-4">
          <Step n={1}>Bu sayfayı <b>Safari</b>'de açın (WhatsApp veya başka bir uygulamanın içinden değil).</Step>
          <Step n={2}>Altta ortadaki <b>Paylaş</b> simgesine dokunun <IosShareIcon className="w-5 h-5 inline -mt-1" />.</Step>
          <Step n={3}>Listeyi yukarı kaydırıp <b>Ana Ekrana Ekle</b>'ye dokunun <SquarePlusIcon className="w-5 h-5 inline -mt-1" />.</Step>
          <Step n={4}>Sağ üstte <b>Ekle</b>'ye dokunun. Palmiye simgesi ana ekranınıza gelir; oradan açın.</Step>
        </ol>
      ) : (
        <ol className="space-y-4">
          <Step n={1}>Bu sayfayı <b>Chrome</b>'da açın.</Step>
          <Step n={2}>Sağ üstteki <b>⋮</b> (üç nokta) menüsüne dokunun.</Step>
          <Step n={3}><b>Uygulamayı yükle</b> veya <b>Ana ekrana ekle</b>'yi seçin.</Step>
          <Step n={4}><b>Yükle</b>'ye dokunun. Palmiye simgesi ana ekranınıza gelir; oradan açın.</Step>
        </ol>
      )}
    </Sheet>
  );
}

// "Ben" ekranındaki tam kart
export function InstallCard() {
  const f = useInstallFlow();
  return (
    <section className="bg-surface rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-full bg-positive-bg text-positive flex items-center justify-center shrink-0">
          {f.installed ? <Check className="w-5 h-5" /> : <SmartphoneIcon className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{f.installed ? 'Uygulama yüklü' : 'Uygulamayı telefona yükle'}</h2>
          <p className="text-[15px] text-muted mt-1">
            {f.installed
              ? 'Ana ekrandaki Palmiye simgesinden tek dokunuşla açabilirsiniz.'
              : 'Ana ekrana ekleyin: simgeye dokununca tam ekran açılır, mağazadan indirmek gerekmez.'}
          </p>
        </div>
      </div>
      {!f.installed && (
        <button onClick={f.start} className={`${btnBig} w-full mt-4`}>
          {f.platform === 'ios' ? 'Nasıl yüklenir?' : 'Uygulamayı yükle'}
        </button>
      )}
      {f.steps && <StepsSheet platform={f.platform} onClose={() => f.setSteps(false)} />}
    </section>
  );
}

// İlanlar ekranının üstünde, kapatılabilir küçük şerit
export function InstallBanner() {
  const f = useInstallFlow();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (f.installed || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* depolama kapalıysa şerit bu oturumda gizli kalır */
    }
  };
  return (
    <div className="mx-4 mt-2 rounded-2xl bg-surface flex items-center gap-2 pl-4 pr-1 py-1">
      <SmartphoneIcon className="w-5 h-5 text-muted shrink-0" />
      <p className="flex-1 min-w-0 text-[15px]">Uygulamayı ana ekrana ekle</p>
      <button onClick={f.start} className="h-11 px-4 rounded-full bg-ink text-ground text-[15px] font-semibold active:opacity-80">
        {f.platform === 'ios' ? 'Nasıl?' : 'Yükle'}
      </button>
      <button onClick={dismiss} aria-label="Bu öneriyi kapat" className="w-11 h-11 flex items-center justify-center rounded-full text-muted active:bg-active">
        <X className="w-4 h-4" />
      </button>
      {f.steps && <StepsSheet platform={f.platform} onClose={() => f.setSteps(false)} />}
    </div>
  );
}
