import 'package:flutter_test/flutter_test.dart';
import 'package:menu_atlasi/data/models.dart';

import 'fixtures.dart';

void main() {
  test('get_public_business yanıtı ayrıştırılır', () {
    final b = BusinessDetail.fromJson(businessJson);
    expect(b.type, BusinessType.cafe);
    expect(b.categories, hasLength(2));
    final latte = b.categories.first.items.first;
    expect(latte.hasVariants, isTrue);
    expect(latte.variants.map((v) => v.priceCents), [8000, 11050]);
    expect(b.categories.first.items[1].isAvailable, isFalse);
    expect(b.hours.single.closesAt, '02:00');
    expect(b.fullAddress, 'Cad. 1, Kadıköy, İstanbul');
  });

  test('geçersiz veri sessizce kabul edilmez', () {
    expect(() => BusinessDetail.fromJson({...businessJson, 'type': 'bar'}), throwsFormatException);
    expect(() => MenuItem.fromJson({'id': 'x', 'name': 'y', 'price_cents': 1.5}), throwsFormatException);
    expect(() => BusinessSummary.fromJson({'id': 'x', 'public_id': 'p', 'name': 'n', 'type': 'cafe'}), throwsFormatException);
  });

  test('bölge sınırlarına kenar payı eklenir', () {
    final r = Region.fromJson({'city': 'İstanbul', 'district': 'Kadıköy', 'business_count': 2, 'min_lng': 29.0, 'min_lat': 40.9, 'max_lng': 29.0, 'max_lat': 40.9});
    expect(r.label, 'Kadıköy, İstanbul');
    expect(r.bounds.maxLat - r.bounds.minLat, closeTo(0.02, 1e-9));
  });
}
