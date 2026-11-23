# Yapılandırma

## Ortam değişkenleri

### Web (`apps/business-web/.env.local`, örnek: `.env.example`)
| Değişken | Açıklama |
|---|---|
| `VITE_SUPABASE_URL` | Supabase proje URL'si |
| `VITE_SUPABASE_ANON_KEY` | **anon/publishable** anahtar (service-role ASLA) |
| `VITE_PUBLIC_MENU_BASE_URL` | QR kodların yönleneceği kalıcı adres kökü (ör. `https://menu.alanadiniz.com`). Üretimde mutlaka sabit bir alan adı verin; QR'lar bu adrese basılır. |

### Mobil (`apps/mobile/env/local.json`, örnek: `env/local.example.json`, `--dart-define-from-file` ile)
| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Aynı Supabase projesi (anon anahtar) |
| `PUBLIC_WEB_URL` | Web panel/QR menü adresi (şifre sıfırlama dönüşü, yasal sayfalar) |
| `MAPS_ENABLED` | Google Maps anahtarı platform dosyalarına eklendiyse `true` |

### Edge Functions (Supabase panelinde *Secrets*; yerelde `infra/local-supabase/.env`)
| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Barındırılan Supabase'de otomatik tanımlıdır |
| `MENU_IMPORT_PROVIDER` | `anthropic` (boşsa AI aktarma “yapılandırılmamış” görünür) |
| `ANTHROPIC_API_KEY` | Yalnızca sunucuda |
| `MENU_IMPORT_MODEL` | Varsayılan `claude-opus-5-5` |
| `MENU_IMPORT_DAILY_LIMIT` | İşletme başına 24 saatte en fazla aktarım (varsayılan 10) |

## Google Maps
1. Google Cloud'da *Maps SDK for Android* ve *Maps SDK for iOS* etkinleştirin; uygulama paket adı / bundle ID ile kısıtlı iki anahtar oluşturun.
2. Android: `apps/mobile/android/local.properties` dosyasına `MAPS_API_KEY=...` ekleyin (git'e girmez; `build.gradle.kts` bunu manifeste aktarır).
3. iOS: `apps/mobile/ios/Flutter/MapsKey.xcconfig.example` dosyasını `MapsKey.xcconfig` olarak kopyalayıp anahtarı yazın (git'e girmez; `Info.plist` → `GMSApiKey`, `AppDelegate` okur). iOS için `pod install` gerekir.
4. Uygulamayı `MAPS_ENABLED=true` ile derleyin.

Anahtar yoksa: keşif ekranı liste görünümüyle açılır, “Harita” sekmesinde açık bir yapılandırma mesajı çıkar; tüm veriler gerçek işletmelerden gelir.

## E-posta (doğrulama ve şifre sıfırlama)
Supabase Auth'ta e-posta doğrulaması açık olmalı (`config.toml` → `enable_confirmations = true`). Üretimde
özel SMTP tanımlayın ve *Redirect URLs* listesine web panel adresini (`https://…/panel`, `https://…/sifre-yenile`) ekleyin.
Yerelde e-postalar Mailpit'e düşer (`http://localhost:54324`).

## Üretime alma kontrol listesi
1. Supabase projesi oluşturun; `supabase link` ve `supabase db push` ile migration'ları uygulayın (**`seed.sql`'i uygulamayın**).
2. `supabase functions deploy delete-account menu-import`.
3. İlk yöneticiyi README'deki SQL ile ekleyin.
4. Web paneli statik olarak yayınlayın (`npm run build` → `dist/`), SPA yönlendirmesi için tüm yolları `index.html`'e döndürün; `VITE_PUBLIC_MENU_BASE_URL`'i kalıcı alan adına ayarlayın.
5. Panel haritası OpenStreetMap kutucuklarını kullanır; yoğun trafikte OSM kullanım politikasına uygun bir kutucuk sağlayıcısı (ör. ücretli bir servis) yapılandırın (`LocationPicker.tsx` → `TileLayer url`).
6. Gizlilik politikası ve kullanım koşulları sayfaları **taslaktır**; hukuki inceleme gerekir.
7. Mobil: uygulama kimliği (`com.menuatlasi.menu_atlasi`), imzalama, ikonlar ve mağaza bilgileri.

## Eksik harici yapılandırmalar (şu an yapılandırılmamış olanlar)
| Konu | Durum | Etkisi |
|---|---|---|
| Google Maps API anahtarları (Android/iOS) | Yok | Mobil harita yerine açık mesaj + liste görünümü çalışır |
| AI sağlayıcı anahtarı (`ANTHROPIC_API_KEY`) | Yok | “AI ile aktar” sekmesi “yapılandırılmamış” der; manuel menü tam çalışır. Gerçek sağlayıcı çağrısı bu ortamda **çalıştırılmadı/test edilmedi** |
| Üretim Supabase projesi ve SMTP | Yok | Yalnızca yerel yığında doğrulandı |
| Kalıcı QR alan adı (`VITE_PUBLIC_MENU_BASE_URL`) | Yok | Yerelde panel adresi kullanılır |
| Android SDK / Xcode | Bu ortamda yok | APK/IPA derlenmedi; Flutter analiz, testler ve web derlemesi yapıldı |
| Mobil derin bağlantı (QR URL'sinin uygulamada açılması) | Yapılandırılmadı | Uygulamada `/m/:publicId` rotası hazır; Android App Links / iOS Universal Links için alan adı doğrulama dosyaları gerekir |
