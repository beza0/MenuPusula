import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/brand.dart';
import 'config/env.dart';
import 'core/theme.dart';
import 'router.dart';
import 'state/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr_TR');
  if (!Env.supabaseConfigured) {
    runApp(const _ConfigMissingApp());
    return;
  }
  await Supabase.initialize(url: Env.supabaseUrl, publishableKey: Env.supabaseAnonKey);
  runApp(ProviderScope(
    // Otomatik yeniden deneme kapalı: hata durumları kullanıcıya hemen ve açıkça gösterilir.
    retry: (_, _) => null,
    overrides: [supabaseClientProvider.overrideWithValue(Supabase.instance.client)],
    child: MenuAtlasiApp(),
  ));
}

class MenuAtlasiApp extends StatelessWidget {
  MenuAtlasiApp({super.key});
  final _router = buildRouter();

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: Brand.appName,
        theme: buildTheme(),
        routerConfig: _router,
        locale: const Locale('tr', 'TR'),
        supportedLocales: const [Locale('tr', 'TR')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        debugShowCheckedModeBanner: false,
      );
}

class _ConfigMissingApp extends StatelessWidget {
  const _ConfigMissingApp();
  @override
  Widget build(BuildContext context) => MaterialApp(
        theme: buildTheme(),
        home: const Scaffold(
          body: Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Yapılandırma eksik: SUPABASE_URL ve SUPABASE_ANON_KEY değerlerini --dart-define-from-file=env/local.json ile verin.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      );
}
