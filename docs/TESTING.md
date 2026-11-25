# Test kapsamı ve sonuçları

Tüm testler gerçek bir yerel Supabase yığınına (Postgres 17 + PostGIS, GoTrue Auth, PostgREST, Storage API,
Edge Runtime, Mailpit; `infra/local-supabase`) karşı çalıştırıldı. Tekrar çalıştırmak için: `bash scripts/test-all.sh`.

## Son çalıştırma (2026-11-25)

| Paket | Komut | Sonuç |
|---|---|---|
| Backend (RLS, yayın, fiyat, arama, saatler, favori, bildirim, istatistik, hesap silme, AI aktarma) | `supabase/tests: npx vitest run` | **46/46 geçti** (4 dosya) |
| Web tip denetimi + derleme | `tsc -b && vite build` | Başarılı |
| Web lint | `oxlint` | 0 hata (yalnızca React uyarıları) |
| Web birim testleri (fiyat biçimi/ayrıştırma, Zod şemaları, menü görünümü) | `npx vitest run` | **31/31 geçti** |
| Web uçtan uca (Playwright, masaüstü + Pixel 7) | `npx playwright test` | **8/8 geçti** |
| Mobil statik analiz | `flutter analyze` | Sorun yok |
| Mobil birim + widget testleri | `flutter test test/{format,models,widget}_test.dart` | **15/15 geçti** |
| Mobil veri katmanı ↔ gerçek backend (seed verisi) | `flutter test test/integration` | **6/6 geçti** |
| Mobil web derlemesi | `flutter build web` | Başarılı |

Ek olarak mobil uygulamanın web derlemesi yerel backend'e bağlanıp keşif listesi, işletme detayı ve ürün araması
ekran görüntüleriyle gözle kontrol edildi.

## Kabul kriterleri eşlemesi

| # | Kriter | Kanıt |
|---|---|---|
| 1 | Ziyaretçi girişsiz yayınlanmış işletme/menüyü görür | `publishing-and-rls.test.js` (onay sonrası görünür), E2E ziyaretçi sayfası, mobil entegrasyon testi |
| 2 | Konum izni reddedilse de bölge seçip arama | `list_regions` + bölge sınırlarıyla arama (backend ve mobil entegrasyon testleri); izin reddinde bölge seçici açılır |
| 3 | Sahip hesap açıp taslak + menü oluşturur | E2E: kayıt → Mailpit doğrulama → işletme → kategori/ürün → saatler |
| 4 | Onaylanmadan herkese açık sonuçlarda görünmez | Backend testi + E2E (“görüntülenemiyor”) + mobil entegrasyon (taslak kafe) |
| 5 | Yönetici onayıyla mobil ve web menüde görünür | E2E yönetici onayı → QR sayfası; mobil `get_public_business` aynı RPC |
| 6 | Fiyat güncellemesi mobil ve QR'da görünür | E2E fiyat düzenleme + toplu güncelleme; backend “fiyat güncellemesi yansır” |
| 7 | Başka işletmenin verisini değiştirme reddedilir | Backend: güncelleme/silme/ekleme/üyelik/toplu fiyat/depolama denemeleri |
| 8 | Normal kullanıcı kendine admin veremez | Backend: `admin_users` ekleme, metadata, admin RPC'leri; E2E `/admin` yönlendirmesi |
| 9 | Ürün araması, bütçe, fiyat sıralaması | Backend ürün araması testleri + mobil entegrasyon |
| 10 | Favori ekle/çıkar kalıcı | Backend (yeni oturumla doğrulama) + mobil entegrasyon (iki ayrı istemci) |
| 11 | QR URL menü güncellemesinde değişmez | Backend + E2E (fiyat/ad değişikliği sonrası aynı URL) |
| 12 | Gece yarısını geçen saatler | Backend: aynı gün, taşma, tam gün, saat dilimi, istisna günleri |
| 13 | Hata, boş veri, bağlantı kesintisi | E2E (ağ kesintisi + tekrar dene, bulunamayan menü), mobil widget testleri (hata/boş/tekrar dene), web/mobil boş durumlar |

## Henüz test edilmeyenler
- Gerçek Google Maps görünümü ve işaretçi kümeleme (API anahtarı gerekir; kod `MapService` arkasında ve derleniyor).
- Gerçek AI sağlayıcı çağrısı (API anahtarı gerekir). Doğrulama, sınırlar, “yapılandırılmamış” yanıtı ve onay adımı test edildi.
- Android/iOS cihazda veya emülatörde çalıştırma ve APK/IPA derlemesi. Konum izni akışı yalnızca kod düzeyinde incelendi.
