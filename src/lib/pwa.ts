import { useSyncExternalStore } from 'react';

/* ---------- Kurulum (Ana ekrana ekle) ---------- */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

let deferred: InstallPromptEvent | null = null;
let installed = false;
let updateReady = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || iPadOs) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

/** main.tsx içinden bir kez çağrılır: kurulum olayını yakalar, servis çalışanını kaydeder. */
export function initPwa() {
  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });

  // Geliştirme sunucusunda önbellek kafa karıştırır; yalnızca yayın sürümünde
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Sayfa açıkken yeni sürümün servis çalışanı devreye girerse "Yeni sürüm hazır" uyarısı çıkar
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      updateReady = true;
      emit();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Uygulama arka plandan dönünce ve yarım saatte bir yeni sürüm var mı diye bakılır
          const check = () => reg.update().catch(() => undefined);
          document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
          window.setInterval(check, 30 * 60_000);
        })
        .catch((err) => console.warn('Servis çalışanı kaydedilemedi:', err));
    });
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const installSnapshot = () => `${deferred ? 1 : 0}${installed ? 1 : 0}`;

export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => updateReady);
}

export function useInstall() {
  useSyncExternalStore(subscribe, installSnapshot);
  return {
    installed,
    canPrompt: deferred !== null,
    platform: detectPlatform(),
    // Android / Chrome: yükleme penceresini açar
    prompt: async () => {
      const ev = deferred;
      if (!ev) return false;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferred = null;
      emit();
      return outcome === 'accepted';
    },
  };
}

/* ---------- Ekran ve bağlantı durumu ---------- */

const PHONE_QUERY = '(max-width: 1023px)';

export const isMobileViewport = () => window.matchMedia(PHONE_QUERY).matches;

// Masaüstü düzeninin sol paneli lg (1024px) ve üstünde açılır; altı telefon kabuğunu kullanır
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
  );
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
  );
}

/** Çıkış yapılınca cihazdaki ilan verisi önbelleğini siler. */
export function clearOfflineData() {
  try {
    navigator.serviceWorker?.controller?.postMessage('clear-data');
    caches?.keys().then((names) => names.filter((n) => n.startsWith('palmiye-data-')).forEach((n) => caches.delete(n)));
  } catch {
    /* önbellek erişimi yoksa yapacak bir şey yok */
  }
}
