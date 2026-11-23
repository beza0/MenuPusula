import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:material_ui/material_ui.dart';

import '../../data/models.dart';
import 'map_service.dart';

/// Google Maps sağlayıcısı. Çok sayıda işaretçi için yerleşik kümeleme (ClusterManager) kullanılır.
class GoogleMapService implements MapService {
  const GoogleMapService();

  @override
  bool get isConfigured => true;

  @override
  String get configurationMessage => '';

  @override
  Widget buildMap(MapViewConfig config) => _GoogleMapView(config: config);
}

class _GoogleMapView extends StatefulWidget {
  const _GoogleMapView({required this.config});
  final MapViewConfig config;

  @override
  State<_GoogleMapView> createState() => _GoogleMapViewState();
}

class _GoogleMapViewState extends State<_GoogleMapView> {
  static const _cluster = ClusterManagerId('businesses');
  static const _turkey = CameraPosition(target: LatLng(39.0, 35.0), zoom: 5.2);
  GoogleMapController? _controller;

  @override
  void didUpdateWidget(covariant _GoogleMapView old) {
    super.didUpdateWidget(old);
    final c = widget.config;
    if (c.focusBounds != null && c.focusBounds != old.config.focusBounds) {
      final b = c.focusBounds!;
      _controller?.animateCamera(CameraUpdate.newLatLngBounds(
        LatLngBounds(southwest: LatLng(b.minLat, b.minLng), northeast: LatLng(b.maxLat, b.maxLng)),
        32,
      ));
    } else if (c.focusPoint != null &&
        (c.focusPoint?.lat != old.config.focusPoint?.lat || c.focusPoint?.lng != old.config.focusPoint?.lng)) {
      _controller?.animateCamera(CameraUpdate.newLatLngZoom(LatLng(c.focusPoint!.lat, c.focusPoint!.lng), 14));
    }
  }

  Future<void> _idle() async {
    final r = await _controller?.getVisibleRegion();
    if (r == null || !mounted) return;
    widget.config.onCameraIdle(MapBounds(
      minLng: r.southwest.longitude,
      minLat: r.southwest.latitude,
      maxLng: r.northeast.longitude,
      maxLat: r.northeast.latitude,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.config;
    final markers = c.businesses
        .map((b) => Marker(
              markerId: MarkerId(b.id),
              clusterManagerId: _cluster,
              position: LatLng(b.latitude, b.longitude),
              icon: BitmapDescriptor.defaultMarkerWithHue(b.id == c.selectedId ? BitmapDescriptor.hueRed : BitmapDescriptor.hueOrange),
              infoWindow: InfoWindow(title: b.name),
              onTap: () => c.onMarkerTap(b),
            ))
        .toSet();
    return GoogleMap(
      initialCameraPosition: c.focusPoint != null
          ? CameraPosition(target: LatLng(c.focusPoint!.lat, c.focusPoint!.lng), zoom: 14)
          : _turkey,
      onMapCreated: (ctrl) => _controller = ctrl,
      onCameraIdle: _idle,
      myLocationEnabled: c.showUserLocation,
      myLocationButtonEnabled: false,
      mapToolbarEnabled: false,
      zoomControlsEnabled: false,
      clusterManagers: {
        ClusterManager(
          clusterManagerId: _cluster,
          onClusterTap: (cluster) => _controller?.animateCamera(CameraUpdate.newLatLngBounds(cluster.bounds, 48)),
        ),
      },
      markers: markers,
      rotateGesturesEnabled: false,
      tiltGesturesEnabled: false,
      buildingsEnabled: false,
      minMaxZoomPreference: const MinMaxZoomPreference(4, 20),
    );
  }
}
