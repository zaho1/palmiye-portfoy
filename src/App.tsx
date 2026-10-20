import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Building2, 
  Search, 
  Phone, 
  Shield, 
  Eye, 
  EyeOff,
  ExternalLink,
  MessageCircle,
  X,
  RefreshCw,
  Tag,
  Home,
  LogOut,
  UserCheck,
  Globe,
  Trees,
  Filter,
  KeyRound
} from 'lucide-react';
import type { Property } from './types';
import Login from './components/Login';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrZ9plOA7q5mwahYBk3pW9GdMIBeIORrfRWBKx1wVetpliFeVt_hId-aoaQncMst5mF42RSnCxzQZw/pub?output=csv';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('palmiye_user');
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('Hepsi');
  const [showPrivateInfo, setShowPrivateInfo] = useState<boolean>(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const handleLoginSuccess = (email: string) => {
    localStorage.setItem('palmiye_user', email);
    setCurrentUser(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('palmiye_user');
    setCurrentUser(null);
  };

  const fetchProperties = () => {
    setLoading(true);
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData: Property[] = results.data.map((row: any, index: number) => ({
          id: `PLM-${101 + index}`,
          title: row['İlan Başlığı'] || 'Başlıksız İlan',
          price: row['Fiyat'] || '0 TL',
          category: row['Kategori'] || 'Diğer',
          imarStatus: row['İmar Durumu'] || '',
          size: row['m²'] || '',
          description: row['Açıklama'] || '',
          imageUrl: row['Görsel URL'] || FALLBACK_IMAGE,
          sahibindenUrl: row['Sahibinden Linki'] || '',
          adaParsel: row['Ada/Parsel'] || '',
          agentName: row['Danışman Bilgileri'] || 'Palmiye Danışmanı',
          agentPhone: row['Danışmanın Telefon Numarası'] || '',
          whatsappUrl: row['WhatsApp Link'] || '',
          status: row['Durum'] || 'Aktif'
        }));

        setProperties(parsedData.filter(item => item.title && item.status.trim() !== 'Pasif'));
        setLoading(false);
      },
      error: (error) => {
        console.error('Google Sheets yüklenirken hata oluştu:', error);
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    if (currentUser) {
      fetchProperties();
    }
  }, [currentUser]);

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const parseNumericPrice = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') return priceStr;
    const clean = priceStr.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  const filteredProperties = properties.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'Hepsi' || item.category.toLowerCase().includes(selectedType.toLowerCase());

    const numPrice = parseNumericPrice(item.price);
    const min = minPrice ? parseInt(minPrice, 10) : 0;
    const max = maxPrice ? parseInt(maxPrice, 10) : Infinity;

    const matchesPrice = numPrice >= min && numPrice <= max;

    return matchesSearch && matchesType && matchesPrice;
  });

  const totalListings = properties.length;
  const kiralikCount = properties.filter(i => i.category.toLowerCase().includes('kiralık')).length;
  const satilikCount = properties.filter(i => i.category.toLowerCase().includes('satılık')).length;

  const getSmartWhatsappUrl = (item: Property) => {
    const rawPhone = item.agentPhone ? item.agentPhone.replace(/[^0-9]/g, '') : '';
    const phoneToUse = rawPhone.length === 10 ? `90${rawPhone}` : rawPhone;
    const text = encodeURIComponent(`Merhaba, Palmiye Yatırım bünyesindeki "${item.title}" ilanı hakkında detaylı bilgi almak istiyorum.`);
    
    if (phoneToUse) {
      return `https://wa.me/${phoneToUse}?text=${text}`;
    }
    return item.whatsappUrl ? `${item.whatsappUrl}?text=${text}` : '#';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* SOL SIDEBAR */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-900/30">
              <Trees className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-black text-lg text-white tracking-wider">PALMİYE</h1>
              <p className="text-xs text-emerald-400 font-bold tracking-wide">YATIRIM & PORTFÖY</p>
            </div>
          </div>

          <nav className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Ana Menü</p>
              <button 
                onClick={() => setSelectedType('Hepsi')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                  selectedType === 'Hepsi' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                    : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Tüm Portföy ({totalListings})</span>
              </button>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-emerald-400" />
                <span>Hızlı Filtrele</span>
              </p>
              <div className="space-y-1">
                {['Satılık', 'Kiralık', 'Daire', 'Arsa'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedType(selectedType === cat ? 'Hepsi' : cat)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition ${
                      selectedType === cat 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-md text-slate-500 font-mono">
                      {properties.filter(p => p.category.toLowerCase().includes(cat.toLowerCase())).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Bağlantılar</p>
              <a 
                href="https://palmiyeyatirim.com/tr" 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Resmi Web Sitesi</span>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300 truncate">{currentUser}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-rose-400 transition"
              title="Oturumu Kapat"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={fetchProperties}
            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Verileri Yenile</span>
          </button>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 font-medium">Ada/Parsel Modu</span>
              <button 
                onClick={() => setShowPrivateInfo(!showPrivateInfo)}
                className="text-emerald-400 hover:text-emerald-300"
              >
                {showPrivateInfo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {showPrivateInfo ? 'Detaylar açık (Ofis İçi)' : 'Müşteri Sunum Modu'}
            </p>
          </div>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Toplam Portföy</p>
              <h3 className="text-xl font-bold text-white">{totalListings} İlan</h3>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Kiralık İlan Sayısı</p>
              <h3 className="text-xl font-bold text-white">{kiralikCount} Adet</h3>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Satılık İlan Sayısı</p>
              <h3 className="text-xl font-bold text-white">{satilikCount} Adet</h3>
            </div>
          </div>
        </div>

        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Palmiye Yatırım | Danışman Paneli</h2>
            <p className="text-sm text-slate-400">Aktif filtrelenen {filteredProperties.length} gayrimenkul</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="İlan veya açıklama ara..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition text-white placeholder-slate-500"
              />
            </div>

            <input 
              type="number" 
              placeholder="Min ₺" 
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-24 px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition text-white placeholder-slate-500"
            />

            <input 
              type="number" 
              placeholder="Maks ₺" 
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-24 px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition text-white placeholder-slate-500"
            />

            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Hepsi">Tüm Kategoriler</option>
              <option value="Daire">Daire</option>
              <option value="Arsa">Arsa</option>
              <option value="Kiralık">Kiralık</option>
              <option value="Satılık">Satılık</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
            <p className="text-sm font-medium">Google Sheets verileri çekiliyor...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-base font-medium">Aranan kriterlere uygun ilan bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((item) => (
              <div 
                key={item.id} 
                className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700 transition duration-300 flex flex-col justify-between group cursor-pointer"
                onClick={() => setSelectedProperty(item)}
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img 
                      src={item.imageUrl} 
                      alt={item.title} 
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="bg-emerald-500/90 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">
                        {item.category}
                      </span>
                      {item.size && (
                        <span className="bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                          {item.size}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="text-xl font-bold text-emerald-400 mb-1">
                      {item.price}
                    </p>
                    <h3 className="font-semibold text-slate-100 text-base mb-3 line-clamp-2">
                      {item.title}
                    </h3>

                    <div className="space-y-2 text-xs text-slate-400 mb-4">
                      {showPrivateInfo && item.adaParsel && (
                        <div className="flex items-center gap-1.5 text-amber-400/90 bg-amber-400/5 px-2.5 py-1.5 rounded-md border border-amber-400/10">
                          <Shield className="w-3.5 h-3.5 shrink-0" />
                          <span>Ada/Parsel: {item.adaParsel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <p className="text-slate-300 font-medium">{item.agentName}</p>
                    <p className="text-slate-500">{item.agentPhone}</p>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={getSmartWhatsappUrl(item)} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition"
                      title="WhatsApp ile Sor"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    {item.agentPhone && (
                      <a 
                        href={`tel:${item.agentPhone.replace(/[^0-9+]/g, '')}`} 
                        className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition"
                        title="Ara"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* İLAN DETAY MODALI (GENİŞ & PROFESYONEL 2 SÜTUNLU DÜZEN) */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                  {selectedProperty.category}
                </span>
                <span className="text-xs text-slate-400 font-mono">İlan No: {selectedProperty.id}</span>
              </div>
              <button 
                onClick={() => setSelectedProperty(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="relative h-72 lg:h-80 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 group">
                  <img 
                    src={selectedProperty.imageUrl} 
                    alt={selectedProperty.title} 
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedProperty.size && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <p className="text-[11px] text-slate-500 font-medium">Metrekare</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">{selectedProperty.size}</p>
                    </div>
                  )}
                  {selectedProperty.imarStatus && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <p className="text-[11px] text-slate-500 font-medium">İmar Durumu</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">{selectedProperty.imarStatus}</p>
                    </div>
                  )}
                  {showPrivateInfo && selectedProperty.adaParsel && (
                    <div className="bg-amber-400/5 p-3 rounded-xl border border-amber-400/20 col-span-2 sm:col-span-1">
                      <p className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Ada/Parsel
                      </p>
                      <p className="text-sm font-bold text-amber-400 mt-0.5">{selectedProperty.adaParsel}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-black text-emerald-400 mb-1">{selectedProperty.price}</p>
                    <h2 className="text-lg font-bold text-white leading-snug">{selectedProperty.title}</h2>
                  </div>

                  {selectedProperty.description && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 max-h-48 overflow-y-auto">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">İlan Açıklaması</h4>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                        {selectedProperty.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3 mt-auto">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sorumlu Portföy Danışmanı</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-100">{selectedProperty.agentName}</p>
                      <p className="text-xs text-slate-400">{selectedProperty.agentPhone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                    {/* Doğrudan Arama Butonu */}
                    {selectedProperty.agentPhone ? (
                      <a 
                        href={`tel:${selectedProperty.agentPhone.replace(/[^0-9+]/g, '')}`} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                        title="Hemen Ara"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ara</span>
                      </a>
                    ) : (
                      <div className="text-center py-2.5 text-[11px] text-slate-600 bg-slate-900 rounded-xl font-medium">No Yok</div>
                    )}

                    {/* Sahibinden Linki */}
                    {selectedProperty.sahibindenUrl ? (
                      <a 
                        href={selectedProperty.sahibindenUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-semibold transition"
                      >
                        <span>Sahibinden</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <div className="text-center py-2.5 text-[11px] text-slate-600 bg-slate-900 rounded-xl font-medium">Link Yok</div>
                    )}

                    {/* WhatsApp Butonu */}
                    <a 
                      href={getSmartWhatsappUrl(selectedProperty)} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/20 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}