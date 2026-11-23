# Menü Atlası — Uygulama Planı (MVP)

## Kapsam
Restoran/kafe işletmelerinin menülerini yayınladığı, kullanıcıların harita/liste üzerinden
işletme ve ürün keşfettiği uygulama. Ödeme, sipariş, rezervasyon, yorum ve abonelik kapsam dışı.

## Mimari
| Katman | Teknoloji | Konum |
|---|---|---|
| Veritabanı, Auth, Storage | Supabase (PostgreSQL 17 + PostGIS, GoTrue, Storage API) | `supabase/` |
| Sunucu fonksiyonları | Supabase Edge Functions (Deno) | `supabase/functions/` |
| İşletme + yönetim paneli + QR menü | React, TypeScript, Vite, Tailwind, shadcn/ui, Zod | `apps/business-web/` |
| Mobil uygulama | Flutter, Material 3, Riverpod, go_router | `apps/mobile/` |
| Yerel geliştirme yığını (CLI'sız ortamlar) | Docker Compose | `infra/local-supabase/` |
| Uçtan uca / RLS testleri | Vitest + supabase-js, Playwright | `supabase/tests/`, `apps/business-web/e2e/` |

## Görev listesi (dikey dilimler)
1. [x] Şema + RLS + RPC'ler + storage politikaları (migration)
2. [x] Yerel Supabase yığını ve backend testleri (RLS, yayın durumu, fiyat hesabı, arama, saatler)
3. [x] Web panel: kayıt/giriş → işletme oluşturma → menü → incelemeye gönderme
4. [x] Yönetim paneli: onay/red/askı, bildirimler, audit log
5. [x] Herkese açık QR menü sayfası + QR indirme (PNG/SVG)
6. [x] Mobil: keşfet (harita/liste), işletme detay, menü, ürün arama, favoriler, profil
7. [x] İstatistikler (gerçek olay kaydı)
8. [x] Hesap silme (Edge Function) ve politikası
9. [x] Uçtan uca doğrulama, README, eksik yapılandırma listesi
10. [x] İkinci aşama: AI ile menü aktarma (sağlayıcı arayüzü, taslak önizleme)

Kararlar ve gerekçeleri: `docs/DECISIONS.md`.
