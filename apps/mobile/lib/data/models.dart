/// Veri modelleri. Sunucu yanıtları doğrulanarak ayrıştırılır; beklenmeyen veri
/// [FormatException] fırlatır (sessizce yanlış değer gösterilmez).
library;

T _req<T>(Map<String, dynamic> j, String key) {
  final v = j[key];
  if (v is T) return v;
  throw FormatException('Geçersiz alan: $key');
}

int _int(Map<String, dynamic> j, String key) {
  final v = j[key];
  if (v is int) return v;
  if (v is num && v == v.roundToDouble()) return v.toInt();
  throw FormatException('Geçersiz tam sayı: $key');
}

double? _dbl(Object? v) => v is num ? v.toDouble() : null;
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;

enum BusinessType {
  restaurant('Restoran'),
  cafe('Kafe');

  const BusinessType(this.label);
  final String label;

  static BusinessType parse(Object? v) => switch (v) {
        'restaurant' => BusinessType.restaurant,
        'cafe' => BusinessType.cafe,
        _ => throw FormatException('Geçersiz işletme türü: $v'),
      };
}

class LatLngPoint {
  const LatLngPoint(this.lat, this.lng);
  final double lat;
  final double lng;
}

/// Haritanın görünür sınırları (bölge araması için).
class MapBounds {
  const MapBounds({required this.minLng, required this.minLat, required this.maxLng, required this.maxLat});
  final double minLng, minLat, maxLng, maxLat;

  /// Tek noktalı bölgeler için kenar payı ekler.
  MapBounds padded([double deg = 0.01]) =>
      MapBounds(minLng: minLng - deg, minLat: minLat - deg, maxLng: maxLng + deg, maxLat: maxLat + deg);

  Map<String, dynamic> toRpc() => {'p_min_lng': minLng, 'p_min_lat': minLat, 'p_max_lng': maxLng, 'p_max_lat': maxLat};

  @override
  bool operator ==(Object other) =>
      other is MapBounds && other.minLng == minLng && other.minLat == minLat && other.maxLng == maxLng && other.maxLat == maxLat;
  @override
  int get hashCode => Object.hash(minLng, minLat, maxLng, maxLat);
}

class BusinessSummary {
  const BusinessSummary({
    required this.id,
    required this.publicId,
    required this.name,
    required this.type,
    required this.latitude,
    required this.longitude,
    this.description,
    this.addressLine,
    this.district,
    this.city,
    this.logoPath,
    this.coverPath,
    this.isVerified = false,
    this.cuisines = const [],
    this.isOpenNow,
    this.distanceM,
  });

  final String id, publicId, name;
  final BusinessType type;
  final double latitude, longitude;
  final String? description, addressLine, district, city, logoPath, coverPath;
  final bool isVerified;
  final List<String> cuisines;
  final bool? isOpenNow;
  final double? distanceM;

  factory BusinessSummary.fromJson(Map<String, dynamic> j) => BusinessSummary(
        id: _req<String>(j, 'id'),
        publicId: _req<String>(j, 'public_id'),
        name: _req<String>(j, 'name'),
        type: BusinessType.parse(j['type']),
        latitude: _dbl(j['latitude']) ?? (throw const FormatException('Konum yok')),
        longitude: _dbl(j['longitude']) ?? (throw const FormatException('Konum yok')),
        description: j['description'] as String?,
        addressLine: j['address_line'] as String?,
        district: j['district'] as String?,
        city: j['city'] as String?,
        logoPath: j['logo_path'] as String?,
        coverPath: j['cover_path'] as String?,
        isVerified: j['is_verified'] == true,
        cuisines: (j['cuisines'] as List?)?.cast<String>() ?? const [],
        isOpenNow: j['is_open_now'] as bool?,
        distanceM: _dbl(j['distance_m']),
      );

  String get locationLabel => [district, city].whereType<String>().join(', ');
}

class MenuItemResult {
  const MenuItemResult({
    required this.itemId,
    required this.itemName,
    required this.priceCents,
    required this.hasVariants,
    required this.isAvailable,
    required this.businessId,
    required this.businessName,
    this.itemDescription,
    this.imagePath,
    this.district,
    this.city,
    this.distanceM,
  });

  final String itemId, itemName, businessId, businessName;
  final int priceCents;
  final bool hasVariants, isAvailable;
  final String? itemDescription, imagePath, district, city;
  final double? distanceM;

  factory MenuItemResult.fromJson(Map<String, dynamic> j) => MenuItemResult(
        itemId: _req<String>(j, 'item_id'),
        itemName: _req<String>(j, 'item_name'),
        priceCents: _int(j, 'price_cents'),
        hasVariants: j['has_variants'] == true,
        isAvailable: j['is_available'] != false,
        businessId: _req<String>(j, 'business_id'),
        businessName: _req<String>(j, 'business_name'),
        itemDescription: j['item_description'] as String?,
        imagePath: j['image_path'] as String?,
        district: j['district'] as String?,
        city: j['city'] as String?,
        distanceM: _dbl(j['distance_m']),
      );
}

class Region {
  const Region({required this.city, this.district, required this.count, required this.bounds});
  final String city;
  final String? district;
  final int count;
  final MapBounds bounds;

  String get label => district == null ? city : '$district, $city';

  factory Region.fromJson(Map<String, dynamic> j) => Region(
        city: _req<String>(j, 'city'),
        district: j['district'] as String?,
        count: _int(j, 'business_count'),
        bounds: MapBounds(
          minLng: _dbl(j['min_lng'])!,
          minLat: _dbl(j['min_lat'])!,
          maxLng: _dbl(j['max_lng'])!,
          maxLat: _dbl(j['max_lat'])!,
        ).padded(),
      );
}

class Cuisine {
  const Cuisine(this.id, this.name);
  final String id, name;
  factory Cuisine.fromJson(Map<String, dynamic> j) => Cuisine(_req<String>(j, 'id'), (j['name_tr'] ?? j['name']) as String);
}

class MenuVariant {
  const MenuVariant({required this.id, required this.name, required this.priceCents});
  final String id, name;
  final int priceCents;
  factory MenuVariant.fromJson(Map<String, dynamic> j) =>
      MenuVariant(id: _req<String>(j, 'id'), name: _req<String>(j, 'name'), priceCents: _int(j, 'price_cents'));
}

class MenuItem {
  const MenuItem({
    required this.id,
    required this.name,
    required this.priceCents,
    required this.hasVariants,
    required this.isAvailable,
    this.description,
    this.imagePath,
    this.variants = const [],
    this.tags = const [],
  });
  final String id, name;
  final int priceCents;
  final bool hasVariants, isAvailable;
  final String? description, imagePath;
  final List<MenuVariant> variants;
  final List<String> tags;

  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: _req<String>(j, 'id'),
        name: _req<String>(j, 'name'),
        priceCents: _int(j, 'price_cents'),
        hasVariants: j['has_variants'] == true,
        isAvailable: j['is_available'] != false,
        description: j['description'] as String?,
        imagePath: j['image_path'] as String?,
        variants: ((j['variants'] as List?) ?? const []).map((e) => MenuVariant.fromJson(e as Map<String, dynamic>)).toList(),
        tags: ((j['tags'] as List?) ?? const []).cast<String>(),
      );
}

class MenuCategory {
  const MenuCategory({required this.id, required this.name, this.description, required this.items});
  final String id, name;
  final String? description;
  final List<MenuItem> items;
  factory MenuCategory.fromJson(Map<String, dynamic> j) => MenuCategory(
        id: _req<String>(j, 'id'),
        name: _req<String>(j, 'name'),
        description: j['description'] as String?,
        items: ((j['items'] as List?) ?? const []).map((e) => MenuItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class OpeningHours {
  const OpeningHours(this.weekday, this.opensAt, this.closesAt);
  final int weekday;
  final String opensAt, closesAt;
}

class BusinessDetail {
  const BusinessDetail({
    required this.id,
    required this.publicId,
    required this.name,
    required this.type,
    required this.status,
    this.description,
    this.phone,
    this.websiteUrl,
    this.instagramUrl,
    this.facebookUrl,
    this.addressLine,
    this.district,
    this.city,
    this.latitude,
    this.longitude,
    this.logoPath,
    this.coverPath,
    this.menuPdfPath,
    this.isVerified = false,
    this.isOpenNow,
    this.menuUpdatedAt,
    this.pricesCheckedAt,
    this.cuisines = const [],
    this.hours = const [],
    this.categories = const [],
  });

  final String id, publicId, name, status;
  final BusinessType type;
  final String? description, phone, websiteUrl, instagramUrl, facebookUrl, addressLine, district, city;
  final double? latitude, longitude;
  final String? logoPath, coverPath, menuPdfPath;
  final bool isVerified;
  final bool? isOpenNow;
  final DateTime? menuUpdatedAt, pricesCheckedAt;
  final List<String> cuisines;
  final List<OpeningHours> hours;
  final List<MenuCategory> categories;

  String get fullAddress => [addressLine, district, city].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  factory BusinessDetail.fromJson(Map<String, dynamic> j) => BusinessDetail(
        id: _req<String>(j, 'id'),
        publicId: _req<String>(j, 'public_id'),
        name: _req<String>(j, 'name'),
        type: BusinessType.parse(j['type']),
        status: _req<String>(j, 'status'),
        description: j['description'] as String?,
        phone: j['phone'] as String?,
        websiteUrl: j['website_url'] as String?,
        instagramUrl: j['instagram_url'] as String?,
        facebookUrl: j['facebook_url'] as String?,
        addressLine: j['address_line'] as String?,
        district: j['district'] as String?,
        city: j['city'] as String?,
        latitude: _dbl(j['latitude']),
        longitude: _dbl(j['longitude']),
        logoPath: j['logo_path'] as String?,
        coverPath: j['cover_path'] as String?,
        menuPdfPath: j['menu_pdf_path'] as String?,
        isVerified: j['is_verified'] == true,
        isOpenNow: j['is_open_now'] as bool?,
        menuUpdatedAt: _date(j['menu_updated_at']),
        pricesCheckedAt: _date(j['prices_checked_at']),
        cuisines: ((j['cuisines'] as List?) ?? const []).map((c) => (c as Map)['name'] as String).toList(),
        hours: ((j['hours'] as List?) ?? const [])
            .map((h) => OpeningHours((h as Map)['weekday'] as int, h['opens_at'] as String, h['closes_at'] as String))
            .toList(),
        categories: ((j['categories'] as List?) ?? const []).map((c) => MenuCategory.fromJson(c as Map<String, dynamic>)).toList(),
      );
}

const dietaryTagLabels = <String, String>{
  'vegan': 'Vegan',
  'vegetarian': 'Vejetaryen',
  'gluten_free': 'Glutensiz',
  'lactose_free': 'Laktozsuz',
  'spicy': 'Acılı',
  'halal': 'Helal',
  'contains_gluten': 'Gluten içerir',
  'contains_milk': 'Süt içerir',
  'contains_egg': 'Yumurta içerir',
  'contains_nuts': 'Kabuklu yemiş içerir',
  'contains_peanuts': 'Yer fıstığı içerir',
  'contains_soy': 'Soya içerir',
  'contains_fish': 'Balık içerir',
  'contains_shellfish': 'Kabuklu deniz ürünü içerir',
  'contains_sesame': 'Susam içerir',
  'contains_celery': 'Kereviz içerir',
  'contains_mustard': 'Hardal içerir',
  'contains_sulphites': 'Sülfit içerir',
};

enum ReportReason {
  wrongPrice('wrong_price', 'Hatalı fiyat'),
  closedPermanently('closed_permanently', 'İşletme kapanmış'),
  wrongInfo('wrong_info', 'Hatalı bilgi'),
  inappropriate('inappropriate', 'Uygunsuz içerik'),
  other('other', 'Diğer');

  const ReportReason(this.value, this.label);
  final String value, label;
}
