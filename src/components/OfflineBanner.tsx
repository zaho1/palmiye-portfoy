import { useOnline } from '../lib/pwa';
import { WifiOffIcon } from './mobile/icons';

// İnternet yokken veya zayıfken en son görülen ilan verisi gösteriliyorsa uyarır.
// Normal durumda hiçbir şey çizmez.
export default function OfflineBanner({ staleAt }: { staleAt: number | null }) {
  const online = useOnline();
  if (online && !staleAt) return null;
  const when = staleAt
    ? new Date(staleAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div role="status" className="no-print mb-4 rounded-xl bg-warning-bg text-warning px-4 py-3 text-sm flex items-start gap-3">
      <WifiOffIcon className="w-5 h-5 shrink-0 mt-px" />
      <p>
        {online
          ? `Bağlantı zayıf: ${when} tarihli son görülen ilanlar gösteriliyor.`
          : `İnternet yok. ${when ? `${when} tarihli ` : 'En son görülen '}ilanlar gösteriliyor; bu sırada değişiklik kaydedilemez.`}
      </p>
    </div>
  );
}
