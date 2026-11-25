# Menü Atlası — Web paneli ve QR menü

İşletme sahipleri için menü yönetim paneli, yöneticiler için başvuru inceleme paneli ve herkese açık QR menü
sayfası (`/m/:publicId`). React, TypeScript, Vite, Tailwind CSS ve shadcn/ui ile yazılmıştır.

```bash
npm install
```
```bash
npm run dev
```

Ayar dosyası `.env.local` (örnek: `.env.example`). Yerel kurulumda `infra/local-supabase/scripts/up.sh` bu dosyayı
otomatik oluşturur.

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (http://localhost:5173) |
| `npm run build` | Tip denetimi ve üretim derlemesi (`dist/`) |
| `npm run lint` | Kod denetimi |
| `npm test` | Birim testleri |
| `npm run e2e` | Uçtan uca testler (Playwright; yerel backend çalışıyor olmalı) |

| Klasör | İçerik |
|---|---|
| `src/pages/panel` | İşletme paneli: bilgiler, saatler, menü, toplu fiyat, QR, istatistik, AI aktarma |
| `src/pages/admin` | Yönetim: başvurular, işletmeler, bildirimler, işlem kayıtları |
| `src/pages/public` | Herkese açık QR menü sayfası |
| `src/components` | Ortak bileşenler (`ui/` altında shadcn/ui bileşenleri) |
| `src/config/brand.ts` | Uygulama adı, logo ve renkler |

Genel kurulum ve proje açıklaması için kök dizindeki [README](../../README.md) dosyasına bakın.
