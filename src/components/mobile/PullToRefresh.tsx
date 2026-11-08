import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { haptic } from '../../lib/personal';

const THRESHOLD = 72;

// Sayfanın en üstündeyken aşağı çekince yeniler (iPhone'da ana ekran uygulamasında tarayıcının kendi yenilemesi yoktur)
export default function PullToRefresh({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const latest = useRef(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    const locked = () => document.body.style.overflow === 'hidden';
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && !locked() && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        latest.current = 0;
        setPull(0);
        return;
      }
      latest.current = Math.min(dy * 0.5, 96);
      setPull(latest.current);
    };
    const onEnd = () => {
      if (start.current !== null && latest.current >= THRESHOLD * 0.5) {
        haptic(15);
        refresh.current();
      }
      start.current = null;
      latest.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const visible = pull > 6 || busy;
  if (!visible) return null;
  return (
    <div className="m-top fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none" aria-hidden="true">
      <div
        className="mt-2 w-10 h-10 rounded-full bg-surface border border-rule shadow-[0_4px_14px_rgba(0,0,0,.35)] flex items-center justify-center text-muted"
        style={{ transform: `translateY(${busy ? 8 : pull * 0.6}px)`, opacity: busy ? 1 : Math.min(1, pull / 40) }}
      >
        <RefreshCw className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
      </div>
    </div>
  );
}
