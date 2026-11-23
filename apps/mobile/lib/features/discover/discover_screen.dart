import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../config/brand.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../services/location_service.dart';
import '../../services/map/map_service.dart';
import '../../state/providers.dart';
import '../../widgets/business_card.dart';
import '../../widgets/state_views.dart';
import 'filters_sheet.dart';
import 'region_sheet.dart';

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _search = TextEditingController();
  late bool _showMap = ref.read(mapServiceProvider).isConfigured;
  MapBounds? _pendingBounds;
  MapBounds? _focusBounds;
  LatLngPoint? _focusPoint;
  BusinessSummary? _selected;
  bool _locating = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _useMyLocation() async {
    setState(() => _locating = true);
    final res = await ref.read(locationServiceProvider).requestCurrent();
    if (!mounted) return;
    setState(() => _locating = false);
    if (res.point == null) {
      showSnack(context, locationStatusMessage(res.status));
      if (res.status == LocationStatus.denied || res.status == LocationStatus.deniedForever) _openRegions();
      return;
    }
    // Kesin konum yalnızca yakınlık sorgusunda kullanılır, kaydedilmez.
    final notifier = ref.read(discoverQueryProvider.notifier);
    final q = ref.read(discoverQueryProvider);
    notifier.set(q.copyWith(userLocation: () => res.point, bounds: () => null));
    setState(() {
      _focusPoint = res.point;
      _pendingBounds = null;
    });
  }

  Future<void> _openRegions() async {
    final region = await showModalBottomSheet<Region>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => const RegionSheet());
    if (region == null) return;
    ref.read(discoverQueryProvider.notifier).searchArea(region.bounds);
    setState(() {
      _focusBounds = region.bounds;
      _pendingBounds = null;
    });
  }

  Future<void> _openFilters() async {
    final current = ref.read(discoverQueryProvider);
    final next = await showModalBottomSheet<DiscoverQuery>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => FiltersSheet(initial: current),
    );
    if (next != null) ref.read(discoverQueryProvider.notifier).set(next);
  }

  void _submitSearch(String text) {
    ref.read(discoverQueryProvider.notifier).setText(text);
    setState(() => _selected = null);
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(discoverQueryProvider);
    final results = ref.watch(businessesProvider);
    final mapService = ref.watch(mapServiceProvider);
    final text = _search.text.trim();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: _submitSearch,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'İşletme, ilçe veya ürün ara',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Temizle',
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              _search.clear();
                              _submitSearch('');
                            },
                          ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Badge(
                isLabelVisible: query.activeFilterCount > 0,
                label: Text('${query.activeFilterCount}'),
                child: IconButton.outlined(tooltip: 'Filtreler', onPressed: _openFilters, icon: const Icon(Icons.tune)),
              ),
            ]),
          ),
          if (text.length >= 2)
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: ActionChip(
                  avatar: const Icon(Icons.local_cafe_outlined, size: 18),
                  label: Text('“$text” ürünlerde ara'),
                  onPressed: () => context.push('/urun-ara?q=${Uri.encodeQueryComponent(text)}'),
                ),
              ),
            ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: true, icon: Icon(Icons.map_outlined), label: Text('Harita')),
                    ButtonSegment(value: false, icon: Icon(Icons.list), label: Text('Liste')),
                  ],
                  selected: {_showMap},
                  onSelectionChanged: (s) => setState(() => _showMap = s.first),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _locating ? null : _useMyLocation,
                  icon: _locating
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.my_location, size: 18),
                  label: const Text('Yakınımda'),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(onPressed: _openRegions, icon: const Icon(Icons.location_city, size: 18), label: const Text('Bölge seç')),
                if (query.bounds != null) ...[
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: () {
                      ref.read(discoverQueryProvider.notifier).set(query.copyWith(bounds: () => null));
                      setState(() => _pendingBounds = null);
                    },
                    child: const Text('Bölgeyi kaldır'),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: _showMap
                ? _MapArea(
                    mapService: mapService,
                    results: results,
                    focusBounds: _focusBounds,
                    focusPoint: _focusPoint,
                    selected: _selected,
                    showUserLocation: query.userLocation != null,
                    showSearchHere: _pendingBounds != null && _pendingBounds != query.bounds,
                    onIdle: (b) => setState(() => _pendingBounds = b),
                    onSearchHere: () {
                      ref.read(discoverQueryProvider.notifier).searchArea(_pendingBounds!);
                      setState(() => _selected = null);
                    },
                    onMarkerTap: (b) => setState(() => _selected = b),
                    onCloseCard: () => setState(() => _selected = null),
                    onShowList: () => setState(() => _showMap = false),
                  )
                : _ListArea(results: results, onRetry: () => ref.invalidate(businessesProvider), hasRegion: query.bounds != null),
          ),
        ]),
      ),
    );
  }
}

class _MapArea extends ConsumerWidget {
  const _MapArea({
    required this.mapService,
    required this.results,
    required this.focusBounds,
    required this.focusPoint,
    required this.selected,
    required this.showUserLocation,
    required this.showSearchHere,
    required this.onIdle,
    required this.onSearchHere,
    required this.onMarkerTap,
    required this.onCloseCard,
    required this.onShowList,
  });

  final MapService mapService;
  final AsyncValue<List<BusinessSummary>> results;
  final MapBounds? focusBounds;
  final LatLngPoint? focusPoint;
  final BusinessSummary? selected;
  final bool showUserLocation, showSearchHere;
  final ValueChanged<MapBounds> onIdle;
  final VoidCallback onSearchHere, onCloseCard, onShowList;
  final ValueChanged<BusinessSummary> onMarkerTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!mapService.isConfigured) {
      return MapNotConfigured(message: mapService.configurationMessage, onShowList: onShowList);
    }
    final businesses = results.value ?? const <BusinessSummary>[];
    return Stack(children: [
      Positioned.fill(
        child: mapService.buildMap(MapViewConfig(
          businesses: businesses,
          onCameraIdle: onIdle,
          onMarkerTap: onMarkerTap,
          focusBounds: focusBounds,
          focusPoint: focusPoint,
          showUserLocation: showUserLocation,
          selectedId: selected?.id,
        )),
      ),
      if (results.isLoading) const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator()),
      if (results.hasError)
        Positioned(
          top: 8,
          left: 12,
          right: 12,
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: ListTile(
              leading: const Icon(Icons.wifi_off, color: Brand.danger),
              title: const Text('Sonuçlar yüklenemedi'),
              trailing: TextButton(onPressed: () => ref.invalidate(businessesProvider), child: const Text('Tekrar dene')),
            ),
          ),
        ),
      if (showSearchHere)
        Positioned(
          top: 12,
          left: 0,
          right: 0,
          child: Center(
            child: FilledButton.icon(onPressed: onSearchHere, icon: const Icon(Icons.refresh), label: const Text('Bu bölgede ara')),
          ),
        ),
      if (!results.isLoading && !results.hasError && businesses.isEmpty)
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Text('Bu bölgede yayınlanmış işletme bulunamadı.', textAlign: TextAlign.center),
            ),
          ),
        ),
      if (selected != null)
        Positioned(
          left: 12,
          right: 12,
          bottom: 12,
          child: BusinessCard(
            business: selected!,
            onTap: () => context.push('/isletme/${selected!.id}'),
            trailing: IconButton(tooltip: 'Kapat', icon: const Icon(Icons.close), onPressed: onCloseCard),
          ),
        ),
    ]);
  }
}

class _ListArea extends ConsumerWidget {
  const _ListArea({required this.results, required this.onRetry, required this.hasRegion});
  final AsyncValue<List<BusinessSummary>> results;
  final VoidCallback onRetry;
  final bool hasRegion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return results.when(
      loading: () => const LoadingView(label: 'İşletmeler yükleniyor…'),
      error: (e, _) => ErrorView(error: e, onRetry: onRetry, title: 'İşletmeler yüklenemedi'),
      data: (list) {
        if (list.isEmpty) {
          return EmptyView(
            icon: Icons.storefront_outlined,
            title: 'Sonuç bulunamadı',
            message: hasRegion ? 'Bu bölgede filtrelere uyan yayınlanmış işletme yok.' : 'Aramayı veya filtreleri değiştirmeyi deneyin.',
          );
        }
        final urls = ref.watch(signedUrlsProvider(pathsKey(list.map((b) => b.coverPath ?? b.logoPath)))).value;
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(businessesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) => BusinessCard(business: list[i], urls: urls, onTap: () => context.push('/isletme/${list[i].id}')),
          ),
        );
      },
    );
  }
}
