import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:menu_atlasi/core/format.dart';

String n(String s) => s.replaceAll(' ', ' ');

void main() {
  setUpAll(() => initializeDateFormatting('tr_TR'));

  group('fiyat', () {
    test('kuruş → Türkçe TL', () {
      expect(n(formatPrice(9500)), '₺95');
      expect(n(formatPrice(9550)), '₺95,50');
      expect(n(formatPrice(125075)), '₺1.250,75');
    });
    test('varyantlı üründe başlangıç fiyatı açıkça belirtilir', () {
      expect(n(formatStartingPrice(8000, hasVariants: true)), "₺80'den başlayan");
      expect(n(formatStartingPrice(8000, hasVariants: false)), '₺80');
    });
    test('bütçe girişi kayan nokta kullanmadan kuruşa çevrilir', () {
      expect(parseLiraToCents('250'), 25000);
      expect(parseLiraToCents('19,99'), 1999);
      expect(parseLiraToCents('0.1'), 10);
      expect(parseLiraToCents('₺ 12'), 1200);
      expect(parseLiraToCents('abc'), isNull);
      expect(parseLiraToCents('-5'), isNull);
    });
  });

  test('mesafe', () {
    expect(formatDistance(84), '80 m');
    expect(formatDistance(1530), '1,5 km');
    expect(formatDistance(null), '');
  });

  test('gece yarısını geçen saatler', () {
    expect(formatHoursRange('18:00', '02:00'), '18:00 – 02:00 (ertesi gün)');
    expect(formatHoursRange('00:00:00', '24:00:00'), '24 saat açık');
    expect(formatHoursRange('09:00', '17:00'), '09:00 – 17:00');
  });

  test('Türkçe karakter duyarsız arama', () {
    expect(trNormalize('İSTANBUL Çay Şöğüş'), 'istanbul cay sogus');
    expect(trNormalize('KADIKÖY'), 'kadikoy');
  });
}
