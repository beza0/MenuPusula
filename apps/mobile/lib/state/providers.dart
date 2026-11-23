import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../data/models.dart';
import '../data/repositories.dart';
import '../services/client_id.dart';
import '../services/location_service.dart';
import '../services/map/google_map_service.dart';
import '../services/map/map_service.dart';

/// main.dart içinde gerçek istemci ile geçersiz kılınır; testlerde sahte depolar verilir.
final supabaseClientProvider = Provider<SupabaseClient>((ref) => throw UnimplementedError('SupabaseClient verilmedi'));

final discoveryRepoProvider = Provider<DiscoveryRepository>((ref) => SupabaseDiscoveryRepository(ref.watch(supabaseClientProvider)));
final favoritesRepoProvider = Provider<FavoritesRepository>((ref) => SupabaseFavoritesRepository(ref.watch(supabaseClientProvider)));
final accountRepoProvider = Provider<AccountRepository>((ref) => SupabaseAccountRepository(ref.watch(supabaseClientProvider)));
final locationServiceProvider = Provider<LocationService>((ref) => GeolocatorLocationService());

/// Harita sağlayıcısı tek yerden seçilir.
final mapServiceProvider = Provider<MapService>(
  (ref) => Env.mapsEnabled ? const GoogleMapService() : const UnconfiguredMapService(),
);

final clientIdProvider = FutureProvider<String>((ref) => loadClientId());

/// Oturum durumu (null = ziyaretçi).
final sessionProvider = StreamProvider<Session?>((ref) {
  final auth = ref.watch(supabaseClientProvider).auth;
  return auth.onAuthStateChange.map((e) => e.session).distinct((a, b) => a?.accessToken == b?.accessToken);
});

final currentUserProvider = Provider<User?>((ref) {
  final session = ref.watch(sessionProvider).value;
  return session?.user ?? ref.watch(supabaseClientProvider).auth.currentUser;
});

// ---------------------------------------------------------------------------
// Keşfet
// ---------------------------------------------------------------------------
class DiscoverQueryNotifier extends Notifier<DiscoverQuery> {
  @override
  DiscoverQuery build() => const DiscoverQuery();

  void set(DiscoverQuery q) => state = q;
  void searchArea(MapBounds bounds) => state = state.copyWith(bounds: () => bounds);
  void setText(String text) => state = state.copyWith(text: text);
  void setUserLocation(LatLngPoint? p) => state = state.copyWith(userLocation: () => p);
}

final discoverQueryProvider = NotifierProvider<DiscoverQueryNotifier, DiscoverQuery>(DiscoverQueryNotifier.new);

final businessesProvider = FutureProvider.autoDispose<List<BusinessSummary>>((ref) {
  final q = ref.watch(discoverQueryProvider);
  return ref.watch(discoveryRepoProvider).searchBusinesses(q);
});

final cuisinesProvider = FutureProvider<List<Cuisine>>((ref) => ref.watch(discoveryRepoProvider).cuisines());
final regionsProvider = FutureProvider.autoDispose<List<Region>>((ref) => ref.watch(discoveryRepoProvider).listRegions());

final productResultsProvider = FutureProvider.autoDispose.family<List<MenuItemResult>, ProductQuery>(
  (ref, q) => ref.watch(discoveryRepoProvider).searchMenuItems(q),
);

final businessDetailProvider = FutureProvider.autoDispose.family<BusinessDetail?, String>(
  (ref, id) => ref.watch(discoveryRepoProvider).getBusiness(id),
);

/// Özel kovadaki görseller için imzalı URL'ler. Anahtar: '|' ile birleştirilmiş, sıralı yollar.
final signedUrlsProvider = FutureProvider.autoDispose.family<Map<String, String>, String>((ref, key) {
  if (key.isEmpty) return const {};
  ref.keepAlive();
  return ref.watch(discoveryRepoProvider).signedUrls(key.split('|'));
});

String pathsKey(Iterable<String?> paths) => (paths.whereType<String>().toSet().toList()..sort()).join('|');

// ---------------------------------------------------------------------------
// Favoriler
// ---------------------------------------------------------------------------
class FavoriteIdsNotifier extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final user = ref.watch(currentUserProvider);
    if (user == null) return {};
    return ref.watch(favoritesRepoProvider).ids();
  }

  /// İyimser güncelleme; hata olursa geri alınır ve hata yeniden fırlatılır.
  Future<void> toggle(String businessId) async {
    final current = state.value ?? {};
    final isFav = current.contains(businessId);
    state = AsyncData(isFav ? ({...current}..remove(businessId)) : {...current, businessId});
    try {
      final repo = ref.read(favoritesRepoProvider);
      isFav ? await repo.remove(businessId) : await repo.add(businessId);
      ref.invalidate(favoritesListProvider);
    } catch (e) {
      state = AsyncData(current);
      rethrow;
    }
  }
}

final favoriteIdsProvider = AsyncNotifierProvider<FavoriteIdsNotifier, Set<String>>(FavoriteIdsNotifier.new);

final favoritesListProvider = FutureProvider.autoDispose<List<BusinessSummary>>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return Future.value(const []);
  ref.watch(favoriteIdsProvider);
  return ref.watch(favoritesRepoProvider).list();
});
