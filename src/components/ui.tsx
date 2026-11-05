import { useState } from 'react';
import { ImageOff, MessageCircle, Phone } from 'lucide-react';
import type { ListingStatus, Property } from '../types';
import { whatsappUrl } from '../lib/sheets';

export function Thumb({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} bg-raised flex items-center justify-center text-faint`} aria-label="Fotoğraf yok" role="img">
        <ImageOff className="w-4 h-4" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${className} object-cover bg-raised`} />;
}

const STATUS_STYLE: Record<ListingStatus, string> = {
  Aktif: 'bg-positive-bg text-positive',
  Pasif: 'bg-raised text-muted',
  Satıldı: 'bg-warning-bg text-warning',
  Silindi: 'bg-negative-bg text-negative',
};

const STATUS_LABEL: Record<ListingStatus, string> = {
  Aktif: 'Aktif',
  Pasif: 'Pasif',
  Satıldı: 'Satıldı / kiralandı',
  Silindi: 'Silindi',
};

export function StatusPill({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap flex-none ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Danışmana ulaşma: WhatsApp ve telefon. Tıklama satırı açmasın diye yayılım durdurulur.
export function ContactButtons({ p }: { p: Property }) {
  const wa = whatsappUrl(p);
  const tel = p.agentPhone.replace(/[^0-9+]/g, '');
  const btn = 'w-9 h-9 rounded-full border border-control flex items-center justify-center text-muted hover:text-ink hover:border-ink transition-colors';
  return (
    <div className="flex gap-2 flex-none" onClick={(e) => e.stopPropagation()}>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className={btn} aria-label={`${p.agentName} ile WhatsApp'ta yaz`} title="WhatsApp">
          <MessageCircle className="w-4 h-4" />
        </a>
      )}
      {tel && (
        <a href={`tel:${tel}`} className={btn} aria-label={`${p.agentName} ara`} title="Ara">
          <Phone className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
