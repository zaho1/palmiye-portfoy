import crypto from 'node:crypto';
import { sendPush } from './_webpush.js';

// Apps Script'ten çağrılır: { secret, messages: [{ endpoint, p256dh, auth, payload }] }
// Vercel ortam değişkenleri: VAPID_PRIVATE_KEY, PUSH_SECRET, (isteğe bağlı) VAPID_SUBJECT
// Açık anahtar gizli değildir (uygulamada da gömülü); ortam değişkeni yanlış girilmesin diye burada sabittir.
const VAPID_PUBLIC_KEY = 'BPJ7BHG7QenYvu05qYhJL710v6d9G9NGP6njjsoAynXQqx-FT2H7qL1LQ_iiLBvvZrFYvNpr5muGs8yXqifidaM';
const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST gerekli' });
  const { PUSH_SECRET, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!PUSH_SECRET || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'Sunucu ayarları eksik' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (!same(body.secret ?? '', PUSH_SECRET)) return res.status(401).json({ error: 'Yetkisiz' });
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 500) : [];

  const vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT || 'mailto:ofis@palmiyeyatirim.com' };
  const gone = [];
  let sent = 0;
  let failed = 0;
  const problems = [];
  for (let i = 0; i < messages.length; i += 20) {
    const batch = await Promise.allSettled(messages.slice(i, i + 20).map((m) => sendPush(m, vapid)));
    for (const r of batch) {
      if (r.status === 'rejected') {
        failed++;
        problems.push(String(r.reason && r.reason.message ? r.reason.message : r.reason).slice(0, 160));
      } else if (r.value.gone) {
        gone.push(r.value.endpoint);
        problems.push(`gone ${r.value.status}`);
      } else if (r.value.status >= 200 && r.value.status < 300) sent++;
      else {
        failed++;
        problems.push(`${r.value.status} ${r.value.detail || ''}`.trim());
      }
    }
  }
  return res.status(200).json({ sent, failed, gone, problems: problems.slice(0, 5) });
}
