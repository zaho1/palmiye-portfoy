/* Palmiye Portföy servis çalışanı
 *  - Uygulama kabuğu (index.html + /assets) önbelleğe alınır; uygulama hızlı açılır, internet yokken de açılır.
 *  - Son görülen ilanlar ve talepler (Apps Script GET cevapları) önbelleğe alınır; internet zayıfsa veya yoksa
 *    en son görülen veri gösterilir. Yazma istekleri (POST) hiçbir zaman buradan geçmez, çevrimdışıyken yazılamaz.
 *  - Mal sahibi (action=owner) ve ofis şifresi taşıyan hiçbir istek önbelleğe alınmaz.
 */
const VERSION = 'v2';
const SHELL = `palmiye-shell-${VERSION}`;
const ASSETS = `palmiye-assets-${VERSION}`;
const DATA = `palmiye-data-${VERSION}`;
const KEEP = [SHELL, ASSETS, DATA];

const DATA_ACTIONS = ['listings', 'requests', 'log'];
const NETWORK_TIMEOUT_MS = 4000;
// Apps Script bazen 3-6 sn'de cevap verir; iyi bağlantıda "eski veri" uyarısına düşmemek için daha uzun beklenir
const DATA_TIMEOUT_MS = 9000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch('/', { cache: 'reload' });
        if (res.ok) {
          const html = await res.clone().text();
          await cache.put('/', res);
          const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
          const assetCache = await caches.open(ASSETS);
          await Promise.all(
            assets.map((u) =>
              fetch(u)
                .then((r) => (r.ok ? assetCache.put(u, r) : undefined))
                .catch(() => undefined),
            ),
          );
        }
      } catch {
        /* ilk kurulumda internet yoksa kabuk ilk açılışta önbelleğe girer */
      }
      await Promise.all(
        ['/manifest.webmanifest', '/logo.png', '/icons/icon-192.png', '/icons/apple-touch-icon.png'].map((u) =>
          cache.add(u).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('palmiye-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// Çıkış yapılınca uygulama önbellekteki ilan verisini sildirir
self.addEventListener('message', (event) => {
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Önbellek anahtarı: sorgudaki "_" (önbellek kırıcı) atılır
function dataKey(url) {
  const u = new URL(url);
  u.searchParams.delete('_');
  return u.toString();
}

function isDataRequest(url) {
  if (url.hostname === 'script.google.com') {
    const action = url.searchParams.get('action');
    return DATA_ACTIONS.includes(action) && !url.searchParams.has('key');
  }
  return url.hostname === 'docs.google.com' && url.pathname.includes('/pub') && url.searchParams.get('output') === 'csv';
}

async function dataStrategy(request) {
  const cache = await caches.open(DATA);
  const key = dataKey(request.url);
  // Ağ cevabı geç gelse bile (zaman aşımından sonra) önbelleğe yazılır; bir sonraki açılış güncel olur
  const network = fetch(request).then((res) => {
    if (res.ok) {
      // Kaydedildiği an cevabın kendi başlığına yazılır (Cache API anahtardaki # kısmını yok sayar)
      const copy = res.clone();
      (async () => {
        const body = await copy.blob();
        const headers = new Headers(copy.headers);
        headers.set('x-palmiye-cached-at', String(Date.now()));
        await cache.put(key, new Response(body, { status: copy.status, statusText: copy.statusText, headers }));
      })().catch(() => undefined);
    }
    return res;
  });
  network.catch(() => undefined);
  try {
    return await withTimeout(network, DATA_TIMEOUT_MS);
  } catch (err) {
    const hit = await cache.match(key);
    if (!hit) throw err;
    return hit;
  }
}

async function navigationStrategy(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (res.ok) cache.put('/', res.clone()).catch(() => undefined);
    return res;
  } catch {
    const hit = await cache.match('/');
    if (hit) return hit;
    return new Response('Çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return hit || (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isDataRequest(url)) {
    event.respondWith(dataStrategy(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(navigationStrategy(request));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, ASSETS));
      return;
    }
    if (url.pathname === '/sw.js') return;
    if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, ASSETS));
  }
});
