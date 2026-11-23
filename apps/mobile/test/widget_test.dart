import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:menu_atlasi/core/theme.dart';
import 'package:menu_atlasi/features/business/business_detail_screen.dart';
import 'package:menu_atlasi/features/discover/discover_screen.dart';
import 'package:menu_atlasi/features/favorites/favorites_screen.dart';
import 'package:menu_atlasi/services/map/map_service.dart';
import 'package:menu_atlasi/state/providers.dart';

import 'fixtures.dart';

Widget app(Widget child, {required FakeDiscoveryRepository repo}) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        discoveryRepoProvider.overrideWithValue(repo),
        mapServiceProvider.overrideWithValue(const UnconfiguredMapService()),
        currentUserProvider.overrideWithValue(null),
        clientIdProvider.overrideWith((ref) async => 'test-client-id-0000000000'),
        favoriteIdsProvider.overrideWith(_NoFavs.new),
      ],
      child: MaterialApp(theme: buildTheme(), home: child),
    );

class _NoFavs extends FavoriteIdsNotifier {
  @override
  Future<Set<String>> build() async => {};
}

void main() {
  setUpAll(() => initializeDateFormatting('tr_TR'));

  testWidgets('harita anahtarı yokken açık yapılandırma mesajı ve gerçek verili liste görünümü', (tester) async {
    final repo = FakeDiscoveryRepository(businesses: [summary]);
    await tester.pumpWidget(app(const DiscoverScreen(), repo: repo));
    await tester.pumpAndSettle();
    // Anahtar yokken varsayılan liste görünümüdür; harita sekmesinde açık mesaj gösterilir.
    expect(find.text('Test Kahvecisi'), findsOneWidget);
    await tester.tap(find.text('Harita'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Harita yapılandırılmamış'), findsOneWidget);
    await tester.tap(find.text('Liste görünümü'));
    await tester.pumpAndSettle();
    expect(find.text('Test Kahvecisi'), findsOneWidget);
    expect(find.textContaining('1,5 km'), findsOneWidget);
    expect(find.text('Kapalı'), findsOneWidget);
  });

  testWidgets('bağlantı hatasında anlaşılır mesaj ve tekrar dene', (tester) async {
    final repo = FakeDiscoveryRepository(fail: true);
    await tester.pumpWidget(app(const DiscoverScreen(), repo: repo));
    await tester.pumpAndSettle();
    expect(find.text('İşletmeler yüklenemedi'), findsOneWidget);
    expect(find.textContaining('İnternet bağlantısı yok'), findsOneWidget);
    repo
      ..fail = false
      ..businesses = [summary];
    await tester.tap(find.text('Tekrar dene'));
    await tester.pumpAndSettle();
    expect(find.text('Test Kahvecisi'), findsOneWidget);
  });

  testWidgets('boş sonuç durumu', (tester) async {
    await tester.pumpWidget(app(const DiscoverScreen(), repo: FakeDiscoveryRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Sonuç bulunamadı'), findsOneWidget);
  });

  testWidgets('işletme detayı: menü, varyant fiyatları, tükendi, etiket, menüde arama ve ölçüm', (tester) async {
    tester.view.physicalSize = const Size(1080, 4200);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final repo = FakeDiscoveryRepository();
    await tester.pumpWidget(app(const BusinessDetailScreen(businessId: 'b1'), repo: repo));
    await tester.pumpAndSettle();
    expect(find.text('Test Kahvecisi'), findsOneWidget);
    expect(find.text('Küçük'), findsOneWidget);
    expect(find.textContaining('110,50'), findsOneWidget);
    expect(find.text('Tükendi'), findsOneWidget);
    expect(find.text('Vejetaryen'), findsOneWidget);
    expect(find.textContaining('Menü son güncelleme'), findsOneWidget);
    expect(repo.events, containsAll(['business_view', 'menu_view']));

    // Kategori sekmesi
    await tester.tap(find.widgetWithText(ChoiceChip, 'Tatlılar'));
    await tester.pumpAndSettle();
    expect(find.text('Cheesecake'), findsOneWidget);
    expect(find.text('Latte'), findsNothing);

    // Menü içinde arama tüm kategorilerde çalışır
    await tester.enterText(find.widgetWithText(TextField, 'Menüde ara'), 'kahve');
    await tester.pumpAndSettle();
    expect(find.text('Türk Kahvesi'), findsOneWidget);
    expect(find.text('Cheesecake'), findsNothing);
    await tester.enterText(find.widgetWithText(TextField, 'Menüde ara'), 'pizza');
    await tester.pumpAndSettle();
    expect(find.textContaining('menüde sonuç yok'), findsOneWidget);
  });

  testWidgets('küçük ekranda işletme detayında taşma olmaz', (tester) async {
    tester.view.physicalSize = const Size(320 * 2, 568 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app(const BusinessDetailScreen(businessId: 'b1'), repo: FakeDiscoveryRepository()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('favoriler: giriş yapılmamışsa yönlendirme', (tester) async {
    await tester.pumpWidget(app(const FavoritesScreen(), repo: FakeDiscoveryRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Favorilerinizi görmek için giriş yapın'), findsOneWidget);
    expect(find.text('Giriş yap / Kayıt ol'), findsOneWidget);
  });
}
