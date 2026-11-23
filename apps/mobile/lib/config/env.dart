/// Derleme zamanı yapılandırması (`--dart-define` veya `--dart-define-from-file=env/local.json`).
/// Service-role anahtarı ASLA mobil uygulamaya konmaz; yalnızca anon (public) anahtar.
abstract final class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Web panelin / QR menünün adresi (şifre sıfırlama ve yasal sayfalar için).
  static const publicWebUrl = String.fromEnvironment('PUBLIC_WEB_URL', defaultValue: 'http://localhost:5173');

  /// Google Maps anahtarı yerel platform dosyalarına eklendiğinde `true` yapılır.
  /// (Anahtar Android'de local.properties → manifest, iOS'ta MapsKey.xcconfig üzerinden okunur.)
  static const mapsEnabled = bool.fromEnvironment('MAPS_ENABLED');

  static bool get supabaseConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
