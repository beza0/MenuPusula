import 'package:menu_atlasi/data/models.dart';
import 'package:menu_atlasi/data/repositories.dart';

const businessJson = <String, dynamic>{
  'id': 'b1',
  'public_id': 'abc1234567',
  'name': 'Test Kahvecisi',
  'type': 'cafe',
  'status': 'published',
  'description': 'Açıklama',
  'phone': '+90 216 000 00 00',
  'address_line': 'Cad. 1',
  'district': 'Kadıköy',
  'city': 'İstanbul',
  'latitude': 40.99,
  'longitude': 29.03,
  'is_verified': false,
  'is_open_now': true,
  'menu_updated_at': '2026-11-20T10:00:00Z',
  'prices_checked_at': null,
  'cuisines': [
    {'id': 'coffee', 'name': 'Kahve'}
  ],
  'hours': [
    {'weekday': 5, 'opens_at': '18:00', 'closes_at': '02:00'}
  ],
  'categories': [
    {
      'id': 'c1',
      'name': 'Kahveler',
      'items': [
        {
          'id': 'i1',
          'name': 'Latte',
          'description': 'Sütlü',
          'price_cents': 8000,
          'has_variants': true,
          'is_available': true,
          'variants': [
            {'id': 'v1', 'name': 'Küçük', 'price_cents': 8000},
            {'id': 'v2', 'name': 'Büyük', 'price_cents': 11050},
          ],
          'tags': ['vegetarian'],
        },
        {'id': 'i2', 'name': 'Türk Kahvesi', 'price_cents': 6000, 'has_variants': false, 'is_available': false, 'variants': [], 'tags': []},
      ],
    },
    {
      'id': 'c2',
      'name': 'Tatlılar',
      'items': [
        {'id': 'i3', 'name': 'Cheesecake', 'price_cents': 14500, 'has_variants': false, 'is_available': true, 'variants': [], 'tags': []},
      ],
    },
  ],
};

final summary = BusinessSummary.fromJson({
  'id': 'b1',
  'public_id': 'abc1234567',
  'name': 'Test Kahvecisi',
  'type': 'cafe',
  'latitude': 40.99,
  'longitude': 29.03,
  'district': 'Kadıköy',
  'city': 'İstanbul',
  'is_open_now': false,
  'distance_m': 1530.0,
});

class FakeDiscoveryRepository implements DiscoveryRepository {
  FakeDiscoveryRepository({this.businesses = const [], this.fail = false});
  List<BusinessSummary> businesses;
  bool fail;
  final List<String> events = [];

  @override
  Future<List<BusinessSummary>> searchBusinesses(DiscoverQuery q, {int limit = 100, int offset = 0}) async {
    if (fail) throw Exception('SocketException: Failed host lookup');
    return businesses;
  }

  @override
  Future<List<MenuItemResult>> searchMenuItems(ProductQuery q, {int limit = 50, int offset = 0}) async => [];
  @override
  Future<List<Region>> listRegions() async => [];
  @override
  Future<List<Cuisine>> cuisines() async => const [Cuisine('coffee', 'Kahve')];
  @override
  Future<BusinessDetail?> getBusiness(String ref) async => BusinessDetail.fromJson(businessJson);
  @override
  Future<Map<String, String>> signedUrls(List<String> paths) async => {};
  @override
  Future<void> logEvent(String businessId, String type, String clientId) async => events.add(type);
}
