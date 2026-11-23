# Menü Atlası — Mobil (Flutter)

Ekranlar: Keşfet (harita/liste, arama, filtreler, “Bu bölgede ara”, bölge seçimi), İşletme detay + menü,
Ürün arama, Favoriler, Profil (giriş/kayıt/şifre sıfırlama, konum izni, yasal sayfalar, hesap silme).

```bash
cp env/local.example.json env/local.json
```
```bash
flutter run --dart-define-from-file=env/local.json
```

- Marka: `lib/config/brand.dart` · Tema: `lib/core/theme.dart`
- Harita sağlayıcısı: `lib/services/map/` (`MapService`; anahtar yoksa `UnconfiguredMapService`)
- Veri katmanı: `lib/data/repositories.dart` (Supabase RPC'leri; web paneliyle aynı backend)
- Testler: `flutter test` (birim/widget), `flutter test test/integration` (yerel backend gerekir; bkz. kök README)

Google Maps kurulumu için `../../docs/CONFIGURATION.md`.
