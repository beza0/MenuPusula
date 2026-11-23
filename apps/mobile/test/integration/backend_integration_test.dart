// Mobil veri katmanını gerçek (yerel) Supabase yığınına karşı doğrular.
// Çalıştırma: SUPABASE_URL=... SUPABASE_ANON_KEY=... flutter test test/integration
// Seed verisi gerekir: infra/local-supabase/scripts/migrate.sh --seed
@Tags(['integration'])
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:menu_atlasi/data/models.dart';
import 'package:menu_atlasi/data/repositories.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final url = Platform.environment['SUPABASE_URL'];
final key = Platform.environment['SUPABASE_ANON_KEY'];

SupabaseClient newClient() => SupabaseClient(url!, key!, authOptions: const AuthClientOptions(autoRefreshToken: false));

void main() {
  final skip = url == null || key == null ? 'SUPABASE_URL / SUPABASE_ANON_KEY tanımlı değil' : null;

  group('keşif (ziyaretçi, konum izni olmadan)', skip: skip, () {
    late DiscoveryRepository repo;
    setUp(() => repo = SupabaseDiscoveryRepository(newClient()));

    test('bölge listesi ve bölgeye göre arama; taslak işletme görünmez', () async {
      final regions = await repo.listRegions();
      final kadikoy = regions.firstWhere((r) => r.district == 'Kadıköy');
      final list = await repo.searchBusinesses(DiscoverQuery(bounds: kadikoy.bounds));
      final names = list.map((b) => b.name).toList();
      expect(names, containsAll(['Örnek Moda Kahvecisi', 'Örnek Ocakbaşı']));
      expect(names.any((n) => n.contains('Taslak')), isFalse);
    });

    test('ürün araması: bütçe filtresi ve fiyat sıralaması, varyantta başlangıç fiyatı', () async {
      final all = await repo.searchMenuItems(const ProductQuery(text: 'latte'));
      final prices = all.map((r) => r.priceCents).toList();
      expect(prices, [...prices]..sort());
      final moda = all.firstWhere((r) => r.businessName == 'Örnek Moda Kahvecisi');
      expect(moda.hasVariants, isTrue);
      expect(moda.priceCents, 9000);
      final cheap = await repo.searchMenuItems(const ProductQuery(text: 'latte', maxPriceCents: 10000));
      expect(cheap.every((r) => r.priceCents <= 10000), isTrue);
      expect(cheap.any((r) => r.businessName.contains('Taslak')), isFalse);
    });

    test('mesafe sıralaması', () async {
      final near = await repo.searchMenuItems(const ProductQuery(text: 'latte', sort: ProductSort.distance, userLocation: LatLngPoint(41.0429, 29.0075)));
      expect(near.first.businessName, 'Örnek Beşiktaş Kafe');
      expect(near.first.distanceM, lessThan(100));
    });

    test('işletme detayı ve menü (gece yarısını geçen saatler dahil)', () async {
      final b = await repo.getBusiness('ornekbesik');
      expect(b, isNotNull);
      expect(b!.categories.map((c) => c.name), ['Kahveler', 'Kahvaltı']);
      expect(b.hours.first.closesAt, '02:00');
      expect(await repo.getBusiness('ornektasla'), isNull);
    });
  });

  group('favoriler (kayıtlı kullanıcı)', skip: skip, () {
    test('ekleme/çıkarma kalıcıdır', () async {
      final c1 = newClient();
      await c1.auth.signInWithPassword(email: 'ornek-kullanici@menuatlasi.local', password: 'OrnekSifre123!');
      final fav1 = SupabaseFavoritesRepository(c1);
      const id = 'a0000000-0000-4000-8000-000000000002';
      await fav1.remove(id);
      await fav1.add(id);

      final c2 = newClient();
      await c2.auth.signInWithPassword(email: 'ornek-kullanici@menuatlasi.local', password: 'OrnekSifre123!');
      final fav2 = SupabaseFavoritesRepository(c2);
      expect(await fav2.ids(), contains(id));
      expect((await fav2.list()).map((b) => b.name), contains('Örnek Ocakbaşı'));
      await fav2.remove(id);
      expect(await fav1.ids(), isNot(contains(id)));
    });

    test('ziyaretçi favori ekleyemez', () async {
      expect(() => SupabaseFavoritesRepository(newClient()).add('a0000000-0000-4000-8000-000000000002'), throwsA(isA<PostgrestException>()));
    });
  });
}
