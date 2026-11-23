import 'package:intl/intl.dart';

/// Fiyatlar kuruş (int) olarak gelir; yalnızca gösterimde TL'ye çevrilir.
final _tl = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 2);
final _tlWhole = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

String formatPrice(int cents) => cents % 100 == 0 ? _tlWhole.format(cents ~/ 100) : _tl.format(cents / 100);

String formatStartingPrice(int cents, {required bool hasVariants}) =>
    hasVariants ? "${formatPrice(cents)}'den başlayan" : formatPrice(cents);

/// "250" → 25000 kuruş. Bütçe alanı için tam/ondalık TL girişi (kayan nokta kullanılmaz).
int? parseLiraToCents(String input) {
  final s = input.trim().replaceAll('₺', '').replaceAll(' ', '');
  final m = RegExp(r'^(\d{1,7})(?:[.,](\d{1,2}))?$').firstMatch(s);
  if (m == null) return null;
  final whole = int.parse(m.group(1)!);
  final frac = int.parse((m.group(2) ?? '0').padRight(2, '0'));
  return whole * 100 + frac;
}

String formatDistance(double? meters) {
  if (meters == null) return '';
  if (meters < 1000) return '${(meters / 10).round() * 10} m';
  return '${NumberFormat('#,##0.0', 'tr_TR').format(meters / 1000)} km';
}

final _date = DateFormat('d MMMM y', 'tr_TR');
final _dateTime = DateFormat('d MMMM y HH:mm', 'tr_TR');

String formatDate(DateTime? d) => d == null ? '—' : _date.format(d.toLocal());
String formatDateTime(DateTime? d) => d == null ? '—' : _dateTime.format(d.toLocal());

const weekdayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

String formatHoursRange(String opens, String closes) {
  final o = opens.length >= 5 ? opens.substring(0, 5) : opens;
  final c = closes.length >= 5 ? closes.substring(0, 5) : closes;
  if (o == '00:00' && c == '24:00') return '24 saat açık';
  return c.compareTo(o) <= 0 ? '$o – $c (ertesi gün)' : '$o – $c';
}

/// Türkçe karakter duyarsız karşılaştırma için sadeleştirme (sunucudaki tr_normalize ile aynı).
String trNormalize(String s) {
  const from = 'İIıŞşĞğÜüÖöÇçÂâÎîÛû';
  const to = 'iiissgguuooccaaiiuu';
  final buf = StringBuffer();
  for (final ch in s.split('')) {
    final i = from.indexOf(ch);
    buf.write(i >= 0 ? to[i] : ch);
  }
  return buf.toString().toLowerCase();
}
