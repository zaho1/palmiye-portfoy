import { useCallback, useEffect, useState } from 'react';
import { postRead } from './sheets';
import { detectPlatform, isStandalone } from './pwa';

// Herkese açık VAPID anahtarı (gizli anahtar yalnızca Vercel'de durur)
const VAPID_PUBLIC_KEY = 'BPJ7BHG7QenYvu05qYhJL710v6d9G9NGP6njjsoAynXQqx-FT2H7qL1LQ_iiLBvvZrFYvNpr5muGs8yXqifidaM';
const NEWS_KEY = 'palmiye_push_news';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function readState(): Promise<PushState> {
  // iPhone'da bildirim yalnızca ana ekrana eklenmiş uygulamada çalışır
  if (detectPlatform() === 'ios' && !isStandalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await currentSubscription()) ? 'on' : 'off';
}

const deviceName = () => {
  const p = detectPlatform();
  return p === 'ios' ? 'iPhone' : p === 'android' ? 'Android' : 'Bilgisayar';
};

export const getNewsPref = (): boolean => {
  try {
    return localStorage.getItem(NEWS_KEY) === '1';
  } catch {
    return false;
  }
};

async function register(sub: PushSubscription, news: boolean) {
  const res = await postRead<{ success: boolean; message?: string }>({
    action: 'pushSubscribe',
    sub: sub.toJSON(),
    device: deviceName(),
    news,
  });
  if (!res.success) throw new Error(res.message || 'Abonelik kaydedilemedi');
}

export function usePush() {
  const [state, setState] = useState<PushState>('off');
  const [news, setNewsState] = useState(getNewsPref);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    readState().then(setState).catch(() => setState('unsupported'));
  }, []);
  useEffect(refresh, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
      await register(sub, news);
      setState('on');
    } catch (err) {
      console.error('Bildirim açılamadı:', err);
      setError('Bildirim açılamadı. İnternet bağlantısını kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }, [news]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const sub = await currentSubscription();
      if (sub) {
        await postRead({ action: 'pushUnsubscribe', endpoint: sub.endpoint }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState('off');
    } catch {
      setError('Bildirim kapatılamadı.');
    } finally {
      setBusy(false);
    }
  }, []);

  // "Ofis haberleri" (yeni ilan, satış) isteğe bağlıdır; kapalıyken yalnızca sana ait bildirimler gelir
  const setNews = useCallback(async (value: boolean) => {
    setNewsState(value);
    try {
      localStorage.setItem(NEWS_KEY, value ? '1' : '0');
    } catch {
      /* önemsiz */
    }
    try {
      const sub = await currentSubscription();
      if (sub) await register(sub, value);
    } catch {
      setError('Tercih kaydedilemedi.');
    }
  }, []);

  return { state, news, busy, error, enable, disable, setNews };
}
