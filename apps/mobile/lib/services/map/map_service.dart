import 'package:material_ui/material_ui.dart';

import '../../data/models.dart';

/// Harita sağlayıcısı soyutlaması. Uygulama yalnızca bu arayüzü kullanır; sağlayıcı
/// (Google Maps veya ileride başka biri) tek yerden değiştirilebilir.
abstract class MapService {
  /// Sağlayıcı yapılandırılmış mı (API anahtarı vb.)?
  bool get isConfigured;

  /// Yapılandırılmamışsa kullanıcıya gösterilecek açıklama.
  String get configurationMessage;

  Widget buildMap(MapViewConfig config);
}

class MapViewConfig {
  const MapViewConfig({
    required this.businesses,
    required this.onCameraIdle,
    required this.onMarkerTap,
    this.focusBounds,
    this.focusPoint,
    this.showUserLocation = false,
    this.selectedId,
  });

  final List<BusinessSummary> businesses;

  /// Kamera durduğunda görünür sınırlar bildirilir (otomatik sorgu YAPILMAZ;
  /// ekran "Bu bölgede ara" butonunu gösterir).
  final ValueChanged<MapBounds> onCameraIdle;
  final ValueChanged<BusinessSummary> onMarkerTap;

  /// Değiştiğinde harita bu bölgeye/noktaya gider.
  final MapBounds? focusBounds;
  final LatLngPoint? focusPoint;
  final bool showUserLocation;
  final String? selectedId;
}

/// Anahtar yokken kullanılan sağlayıcı: harita alanında açık bir yapılandırma mesajı gösterir.
class UnconfiguredMapService implements MapService {
  const UnconfiguredMapService();

  @override
  bool get isConfigured => false;

  @override
  String get configurationMessage =>
      'Harita yapılandırılmamış. Google Maps API anahtarı eklenip uygulama MAPS_ENABLED=true ile derlendiğinde '
      'harita burada görünür. Bu sırada işletmeleri liste görünümünde inceleyebilirsiniz.';

  @override
  Widget buildMap(MapViewConfig config) => MapNotConfigured(message: configurationMessage);
}

class MapNotConfigured extends StatelessWidget {
  const MapNotConfigured({super.key, required this.message, this.onShowList});
  final String message;
  final VoidCallback? onShowList;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFF5F1EC),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 40, color: Color(0xFF6B635B)),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
              if (onShowList != null) ...[
                const SizedBox(height: 12),
                FilledButton.icon(onPressed: onShowList, icon: const Icon(Icons.list), label: const Text('Liste görünümü')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
