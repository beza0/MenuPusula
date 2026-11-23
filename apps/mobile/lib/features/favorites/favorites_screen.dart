import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/errors.dart';
import '../../state/providers.dart';
import '../../widgets/business_card.dart';
import '../../widgets/state_views.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Favoriler')),
      body: user == null
          ? EmptyView(
              icon: Icons.favorite_border,
              title: 'Favorilerinizi görmek için giriş yapın',
              message: 'Beğendiğiniz mekânları kaydedin, menülerine hızlıca ulaşın.',
              action: FilledButton(onPressed: () => context.push('/profil/giris'), child: const Text('Giriş yap / Kayıt ol')),
            )
          : ref.watch(favoritesListProvider).when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(favoritesListProvider)),
                data: (list) {
                  if (list.isEmpty) {
                    return const EmptyView(
                      icon: Icons.favorite_border,
                      title: 'Henüz favoriniz yok',
                      message: 'İşletme sayfasındaki kalp simgesiyle favorilere ekleyebilirsiniz.',
                    );
                  }
                  final urls = ref.watch(signedUrlsProvider(pathsKey(list.map((b) => b.coverPath ?? b.logoPath)))).value;
                  return RefreshIndicator(
                    onRefresh: () async => ref.invalidate(favoriteIdsProvider),
                    child: ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => BusinessCard(
                        business: list[i],
                        urls: urls,
                        onTap: () => context.push('/isletme/${list[i].id}'),
                        trailing: IconButton(
                          tooltip: 'Favorilerden çıkar',
                          icon: const Icon(Icons.favorite, color: Color(0xFFE8590C)),
                          onPressed: () async {
                            try {
                              await ref.read(favoriteIdsProvider.notifier).toggle(list[i].id);
                            } catch (e) {
                              if (context.mounted) showSnack(context, friendlyError(e), error: true);
                            }
                          },
                        ),
                      ),
                    ),
                  );
                },
              ),
    );
  }
}
