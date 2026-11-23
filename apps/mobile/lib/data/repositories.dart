import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';

/// İşletme keşfi sorgu parametreleri.
class DiscoverQuery {
  const DiscoverQuery({
    this.bounds,
    this.text = '',
    this.types = const {},
    this.cuisines = const {},
    this.openNow = false,
    this.maxDistanceKm,
    this.userLocation,
  });

  final MapBounds? bounds;
  final String text;
  final Set<BusinessType> types;
  final Set<String> cuisines;
  final bool openNow;
  final double? maxDistanceKm;
  final LatLngPoint? userLocation;

  DiscoverQuery copyWith({
    MapBounds? Function()? bounds,
    String? text,
    Set<BusinessType>? types,
    Set<String>? cuisines,
    bool? openNow,
    double? Function()? maxDistanceKm,
    LatLngPoint? Function()? userLocation,
  }) =>
      DiscoverQuery(
        bounds: bounds != null ? bounds() : this.bounds,
        text: text ?? this.text,
        types: types ?? this.types,
        cuisines: cuisines ?? this.cuisines,
        openNow: openNow ?? this.openNow,
        maxDistanceKm: maxDistanceKm != null ? maxDistanceKm() : this.maxDistanceKm,
        userLocation: userLocation != null ? userLocation() : this.userLocation,
      );

  int get activeFilterCount => types.length + cuisines.length + (openNow ? 1 : 0) + (maxDistanceKm != null ? 1 : 0);

  @override
  bool operator ==(Object other) =>
      other is DiscoverQuery &&
      other.bounds == bounds &&
      other.text == text &&
      _setEq(other.types, types) &&
      _setEq(other.cuisines, cuisines) &&
      other.openNow == openNow &&
      other.maxDistanceKm == maxDistanceKm &&
      other.userLocation?.lat == userLocation?.lat &&
      other.userLocation?.lng == userLocation?.lng;

  @override
  int get hashCode => Object.hash(bounds, text, Object.hashAllUnordered(types), Object.hashAllUnordered(cuisines), openNow,
      maxDistanceKm, userLocation?.lat, userLocation?.lng);

  static bool _setEq<T>(Set<T> a, Set<T> b) => a.length == b.length && a.containsAll(b);
}

enum ProductSort { price, distance }

class ProductQuery {
  const ProductQuery({required this.text, this.bounds, this.userLocation, this.maxPriceCents, this.sort = ProductSort.price});
  final String text;
  final MapBounds? bounds;
  final LatLngPoint? userLocation;
  final int? maxPriceCents;
  final ProductSort sort;

  @override
  bool operator ==(Object other) =>
      other is ProductQuery &&
      other.text == text &&
      other.bounds == bounds &&
      other.userLocation?.lat == userLocation?.lat &&
      other.userLocation?.lng == userLocation?.lng &&
      other.maxPriceCents == maxPriceCents &&
      other.sort == sort;
  @override
  int get hashCode => Object.hash(text, bounds, userLocation?.lat, userLocation?.lng, maxPriceCents, sort);
}

/// Herkese açık keşif verileri. Arama RPC'leri yalnızca yayınlanmış işletmeleri döndürür.
abstract class DiscoveryRepository {
  Future<List<BusinessSummary>> searchBusinesses(DiscoverQuery q, {int limit = 100, int offset = 0});
  Future<List<MenuItemResult>> searchMenuItems(ProductQuery q, {int limit = 50, int offset = 0});
  Future<List<Region>> listRegions();
  Future<List<Cuisine>> cuisines();
  Future<BusinessDetail?> getBusiness(String ref);
  Future<Map<String, String>> signedUrls(List<String> paths);
  Future<void> logEvent(String businessId, String type, String clientId);
}

class SupabaseDiscoveryRepository implements DiscoveryRepository {
  SupabaseDiscoveryRepository(this.client);
  final SupabaseClient client;

  @override
  Future<List<BusinessSummary>> searchBusinesses(DiscoverQuery q, {int limit = 100, int offset = 0}) async {
    final rows = await client.rpc('search_businesses', params: {
      ...?q.bounds?.toRpc(),
      'p_query': q.text.trim().isEmpty ? null : q.text.trim(),
      'p_types': q.types.isEmpty ? null : q.types.map((t) => t.name).toList(),
      'p_cuisines': q.cuisines.isEmpty ? null : q.cuisines.toList(),
      'p_open_now': q.openNow,
      'p_user_lng': q.userLocation?.lng,
      'p_user_lat': q.userLocation?.lat,
      'p_max_distance_m': q.maxDistanceKm == null ? null : q.maxDistanceKm! * 1000,
      'p_limit': limit,
      'p_offset': offset,
    });
    return (rows as List).map((r) => BusinessSummary.fromJson(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<MenuItemResult>> searchMenuItems(ProductQuery q, {int limit = 50, int offset = 0}) async {
    final rows = await client.rpc('search_menu_items', params: {
      'p_query': q.text.trim(),
      ...?q.bounds?.toRpc(),
      'p_user_lng': q.userLocation?.lng,
      'p_user_lat': q.userLocation?.lat,
      'p_max_price_cents': q.maxPriceCents,
      'p_sort': q.sort.name,
      'p_limit': limit,
      'p_offset': offset,
    });
    return (rows as List).map((r) => MenuItemResult.fromJson(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<Region>> listRegions() async {
    final rows = await client.rpc('list_regions');
    return (rows as List).map((r) => Region.fromJson(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<Cuisine>> cuisines() async {
    final rows = await client.from('cuisine_types').select('id, name_tr').order('sort_order');
    return rows.map(Cuisine.fromJson).toList();
  }

  @override
  Future<BusinessDetail?> getBusiness(String ref) async {
    final data = await client.rpc('get_public_business', params: {'p_ref': ref});
    if (data == null) return null;
    final detail = BusinessDetail.fromJson(data as Map<String, dynamic>);
    return detail.status == 'published' ? detail : null;
  }

  @override
  Future<Map<String, String>> signedUrls(List<String> paths) async {
    final unique = paths.toSet().toList();
    if (unique.isEmpty) return const {};
    // ignore: deprecated_member_use
    final res = await client.storage.from('business-media').createSignedUrls(unique, 3600);
    return {for (final r in res) r.path: r.signedUrl};
  }

  @override
  Future<void> logEvent(String businessId, String type, String clientId) async {
    try {
      await client.rpc('log_event', params: {
        'p_business_id': businessId,
        'p_event_type': type,
        'p_source': 'app',
        'p_client_id': clientId,
      });
    } catch (_) {
      // Ölçüm hataları kullanıcı deneyimini etkilemez.
    }
  }
}

/// Giriş yapmış kullanıcının favorileri (RLS: yalnızca kendi kayıtları).
abstract class FavoritesRepository {
  Future<List<BusinessSummary>> list();
  Future<Set<String>> ids();
  Future<void> add(String businessId);
  Future<void> remove(String businessId);
}

class SupabaseFavoritesRepository implements FavoritesRepository {
  SupabaseFavoritesRepository(this.client);
  final SupabaseClient client;

  @override
  Future<Set<String>> ids() async {
    final rows = await client.from('favorites').select('business_id');
    return rows.map((r) => r['business_id'] as String).toSet();
  }

  @override
  Future<List<BusinessSummary>> list() async {
    final rows = await client
        .from('favorites')
        .select('created_at, businesses(id, public_id, name, type, latitude, longitude, description, address_line, district, city, logo_path, cover_path, is_verified, status)')
        .order('created_at', ascending: false);
    return rows
        .map((r) => r['businesses'] as Map<String, dynamic>?)
        .whereType<Map<String, dynamic>>()
        .where((b) => b['status'] == 'published' && b['latitude'] != null)
        .map(BusinessSummary.fromJson)
        .toList();
  }

  @override
  Future<void> add(String businessId) => client.from('favorites').insert({'business_id': businessId});

  @override
  Future<void> remove(String businessId) => client.from('favorites').delete().eq('business_id', businessId);
}

abstract class AccountRepository {
  Future<void> report({required String businessId, required ReportReason reason, String? message});
  Future<String?> displayName();
  Future<void> updateDisplayName(String? name);
  Future<List<String>> deletionBlockers();
  Future<void> deleteAccount();
}

class SupabaseAccountRepository implements AccountRepository {
  SupabaseAccountRepository(this.client);
  final SupabaseClient client;

  String get _uid => client.auth.currentUser?.id ?? (throw StateError('Giriş gerekli'));

  @override
  Future<void> report({required String businessId, required ReportReason reason, String? message}) => client.from('reports').insert({
        'business_id': businessId,
        'reason': reason.value,
        'message': (message?.trim().isEmpty ?? true) ? null : message!.trim(),
      });

  @override
  Future<String?> displayName() async {
    final row = await client.from('profiles').select('display_name').eq('id', _uid).maybeSingle();
    return row?['display_name'] as String?;
  }

  @override
  Future<void> updateDisplayName(String? name) =>
      client.from('profiles').update({'display_name': (name?.trim().isEmpty ?? true) ? null : name!.trim()}).eq('id', _uid);

  @override
  Future<List<String>> deletionBlockers() async {
    final rows = await client.rpc('account_deletion_blockers');
    return (rows as List).map((r) => (r as Map)['business_name'] as String).toList();
  }

  /// Sunucu tarafı Edge Function; service-role anahtarı yalnızca orada bulunur.
  @override
  Future<void> deleteAccount() async {
    await client.functions.invoke('delete-account', method: HttpMethod.post);
    await client.auth.signOut();
  }
}
