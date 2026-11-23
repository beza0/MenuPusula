import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// Anonim, rastgele kurulum kimliği (kişisel veri değildir). Sunucu bunu günlük tuzla
/// hash'leyerek yalnızca tekrar sayımı engellemek için kullanır.
Future<String> loadClientId() async {
  const key = 'ma_client_id';
  final prefs = await SharedPreferences.getInstance();
  var id = prefs.getString(key);
  if (id == null) {
    final r = Random.secure();
    id = List.generate(32, (_) => r.nextInt(16).toRadixString(16)).join();
    await prefs.setString(key, id);
  }
  return id;
}
