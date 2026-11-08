import type { ReactNode } from 'react';

// Yerel çizgi simgeleri (lucide stilinde). Derlemeyi kurulu lucide sürümünün
// simge adlarına bağlamamak için yalnızca bu birkaç simge burada çizilir.
function Svg({ className = 'w-5 h-5', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { className?: string };

export const CameraIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Svg>
);

export const GalleryIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Svg>
);

export const ChevronRightIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);

export const ChevronLeftIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);

// iPhone "Paylaş" simgesi: kare ve yukarı ok
export const IosShareIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" x2="12" y1="2" y2="15" />
  </Svg>
);

export const SquarePlusIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </Svg>
);

export const LocateIcon = ({ className }: P) => (
  <Svg className={className}>
    <line x1="2" x2="5" y1="12" y2="12" />
    <line x1="19" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="5" />
    <line x1="12" x2="12" y1="19" y2="22" />
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const WifiOffIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 20h.01" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
    <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
    <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
    <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
    <path d="m2 2 20 20" />
  </Svg>
);

export const DownloadIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </Svg>
);

export const SmartphoneIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </Svg>
);
