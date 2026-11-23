import 'package:go_router/go_router.dart';

import 'features/business/business_detail_screen.dart';
import 'features/discover/discover_screen.dart';
import 'features/discover/product_search_screen.dart';
import 'features/favorites/favorites_screen.dart';
import 'features/profile/auth_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/shell/app_shell.dart';

GoRouter buildRouter() => GoRouter(
      initialLocation: '/kesfet',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => AppShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [GoRoute(path: '/kesfet', builder: (_, _) => const DiscoverScreen())]),
            StatefulShellBranch(routes: [GoRoute(path: '/favoriler', builder: (_, _) => const FavoritesScreen())]),
            StatefulShellBranch(routes: [GoRoute(path: '/profil', builder: (_, _) => const ProfileScreen())]),
          ],
        ),
        GoRoute(path: '/isletme/:id', builder: (_, s) => BusinessDetailScreen(businessId: s.pathParameters['id']!)),
        // QR/NFC derin bağlantısıyla aynı kalıcı kimlik: /m/:publicId
        GoRoute(path: '/m/:publicId', builder: (_, s) => BusinessDetailScreen(businessId: s.pathParameters['publicId']!)),
        GoRoute(path: '/urun-ara', builder: (_, s) => ProductSearchScreen(initialQuery: s.uri.queryParameters['q'] ?? '')),
        GoRoute(path: '/profil/giris', builder: (_, _) => const AuthScreen()),
      ],
    );
