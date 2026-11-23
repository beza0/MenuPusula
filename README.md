# Menü Atlası

Restoran ve kafelerin menülerini yayınladığı; kullanıcıların harita/liste üzerinden işletmeleri ve ürünleri
keşfedip güncel fiyatları görebildiği mobil uygulama + işletme/yönetim paneli + QR menü.

> Çalışma adı “Menü Atlası”. Ad, logo ve renkler tek yerden değişir:
> web `apps/business-web/src/config/brand.ts` (+ `public/logo.svg`), mobil `apps/mobile/lib/config/brand.dart`
> (Android uygulama adı `android/app/src/main/res/values/strings.xml`, iOS `Info.plist` → `CFBundleDisplayName`).

## İçerik

| Klasör | Açıklama |
|---|---|
| `supabase/migrations` | PostgreSQL + PostGIS şeması, RLS, iş kuralları (RPC), storage politikaları |
| `supabase/functions` | Edge Functions: `delete-account`, `menu-import` (AI, isteğe bağlı) |
| `supabase/seed.sql` | **Yalnızca yerel** açıkça etiketlenmiş örnek veri |
| `supabase/tests` | Gerçek yığına karşı RLS / yayın / fiyat / arama / saat testleri (Vitest) |
| `apps/business-web` | İşletme paneli, yönetim paneli ve herkese açık QR menü (`/m/:publicId`) |
| `apps/mobile` | Flutter mobil uygulama (Material 3, Riverpod, go_router) |
| `infra/local-supabase` | Supabase CLI olmayan ortamlar için Docker Compose yığını |
| `docs/` | Plan, kararlar, yapılandırma, test sonuçları |

## Hızlı başlangıç (yerel)

Gereksinimler: Docker, Node 20+, Flutter 3.38+ (bu repo Flutter 3.50 ile denendi), `psql`.

### 1) Backend

**Seçenek A — Supabase CLI**
```bash
supabase start
```
```bash
supabase db reset
```
(`db reset` migration'ları ve `seed.sql`'i uygular.) Edge Functions: `supabase functions serve`.

**Seçenek B — Bu repodaki Docker Compose yığını** (CLI yoksa; testler bununla çalıştırıldı)
```bash
bash infra/local-supabase/scripts/up.sh --seed
```
Bu komut rastgele yerel anahtarlar üretir (`infra/local-supabase/.env`, git'e girmez), Postgres/PostGIS, Auth,
PostgREST, Storage, Edge Runtime ve Mailpit'i başlatır, migration + seed uygular.
- API: `http://localhost:54321` · Mailpit (doğrulama e-postaları): `http://localhost:54324`
- Sıfırlama: `bash infra/local-supabase/scripts/reset.sh --seed` · Durdurma: `bash infra/local-supabase/scripts/down.sh`

Örnek hesaplar (yalnızca seed ile, şifre `OrnekSifre123!`): `ornek-sahip@menuatlasi.local`,
`ornek-yonetici@menuatlasi.local`, `ornek-kullanici@menuatlasi.local`.

### 2) Web paneli + QR menü
```bash
cd apps/business-web && cp .env.example .env.local
```
`.env.local` içine `VITE_SUPABASE_ANON_KEY` değerini (`infra/local-supabase/.env` → `ANON_KEY`) yazın, sonra:
```bash
npm install && npm run dev
```
Panel: `http://localhost:5173/panel` · QR menü örneği: `http://localhost:5173/m/ornekmoda1`

### 3) Mobil
```bash
cd apps/mobile && cp env/local.example.json env/local.json
```
`env/local.json` içine anon anahtarı yazın (Android emülatöründen bilgisayara `10.0.2.2` ile erişilir), sonra:
```bash
flutter run --dart-define-from-file=env/local.json
```
Harita anahtarı yoksa uygulama liste görünümüyle açılır ve harita alanında açık bir yapılandırma mesajı gösterir.
Harita kurulumu: [docs/CONFIGURATION.md](docs/CONFIGURATION.md#google-maps).

## Testler
```bash
bash scripts/test-all.sh
```
Ayrıntı ve son çalıştırma sonuçları: [docs/TESTING.md](docs/TESTING.md).

## İlk yöneticiyi güvenli oluşturma
Yönetici yetkisi kullanıcı metadata'sından **okunmaz**; yalnızca istemcilerin yazamadığı `public.admin_users`
tablosundan gelir. Kişi önce normal hesap açar ve e-postasını doğrular; ardından veritabanı sahibi (SQL Editor
veya `psql`, service bağlantısı) şunu çalıştırır:
```sql
insert into public.admin_users (user_id, note)
select id, 'İlk yönetici' from auth.users where email = 'yonetici@ornek.com';
```
Bu tabloya API üzerinden (anon/authenticated) yazma yetkisi yoktur; testlerle doğrulanmıştır.

## Belgeler
- [docs/PLAN.md](docs/PLAN.md) — plan ve görev listesi
- [docs/DECISIONS.md](docs/DECISIONS.md) — teknik kararlar ve gerekçeleri
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — ortam değişkenleri, harita, e-posta, AI, üretim kontrol listesi, eksik harici yapılandırmalar
- [docs/TESTING.md](docs/TESTING.md) — test kapsamı ve sonuçları
