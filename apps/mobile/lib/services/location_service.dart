import 'package:geolocator/geolocator.dart';

import '../data/models.dart';

enum LocationStatus { granted, denied, deniedForever, serviceDisabled, unknown }

class LocationResult {
  const LocationResult(this.status, [this.point]);
  final LocationStatus status;
  final LatLngPoint? point;
}

/// Konum izni yalnızca kullanıcı konum gerektiren bir özelliği kullandığında istenir.
/// Kesin konum sunucuda saklanmaz; yalnızca yakınlık sorgusunda parametre olarak gönderilir.
abstract class LocationService {
  Future<LocationStatus> status();
  Future<LocationResult> requestCurrent();
  Future<void> openSettings();
}

class GeolocatorLocationService implements LocationService {
  @override
  Future<LocationStatus> status() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationStatus.serviceDisabled;
    return _map(await Geolocator.checkPermission());
  }

  @override
  Future<LocationResult> requestCurrent() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return const LocationResult(LocationStatus.serviceDisabled);
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      final s = _map(perm);
      if (s != LocationStatus.granted) return LocationResult(s);
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)),
      );
      return LocationResult(LocationStatus.granted, LatLngPoint(pos.latitude, pos.longitude));
    } catch (_) {
      return const LocationResult(LocationStatus.unknown);
    }
  }

  @override
  Future<void> openSettings() => Geolocator.openAppSettings();

  LocationStatus _map(LocationPermission p) => switch (p) {
        LocationPermission.always || LocationPermission.whileInUse => LocationStatus.granted,
        LocationPermission.deniedForever => LocationStatus.deniedForever,
        LocationPermission.denied => LocationStatus.denied,
        _ => LocationStatus.unknown,
      };
}

String locationStatusMessage(LocationStatus s) => switch (s) {
      LocationStatus.granted => 'Konum izni verildi',
      LocationStatus.denied => 'Konum izni verilmedi. Şehir/ilçe seçerek veya haritada gezinerek arayabilirsiniz.',
      LocationStatus.deniedForever => 'Konum izni kalıcı olarak reddedildi. Ayarlardan açabilirsiniz.',
      LocationStatus.serviceDisabled => 'Cihazınızın konum servisi kapalı.',
      LocationStatus.unknown => 'Konum alınamadı.',
    };
