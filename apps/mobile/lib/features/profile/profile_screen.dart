import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/brand.dart';
import '../../config/env.dart';
import '../../core/errors.dart';
import '../../services/location_service.dart';
import '../../state/providers.dart';
import '../../widgets/media.dart';
import '../../widgets/state_views.dart';

final _locationStatusProvider = FutureProvider.autoDispose<LocationStatus>((ref) => ref.watch(locationServiceProvider).status());
final _displayNameProvider = FutureProvider.autoDispose<String?>((ref) {
  if (ref.watch(currentUserProvider) == null) return Future.value(null);
  return ref.watch(accountRepoProvider).displayName();
});

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final loc = ref.watch(_locationStatusProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(children: [
        if (user == null)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  const BrandLogo(size: 48),
                  const SizedBox(height: 12),
                  const Text('Favorilerinizi kaydetmek ve hatalı bilgi bildirmek için giriş yapın.', textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: () => context.push('/profil/giris'), child: const Text('Giriş yap / Kayıt ol')),
                ]),
              ),
            ),
          )
        else ...[
          ListTile(
            leading: const CircleAvatar(backgroundColor: Brand.primarySoft, child: Icon(Icons.person, color: Brand.primary)),
            title: Text(ref.watch(_displayNameProvider).value ?? 'Görünen ad eklenmedi'),
            subtitle: Text(user.email ?? ''),
            trailing: IconButton(tooltip: 'Adı düzenle', icon: const Icon(Icons.edit), onPressed: () => _editName(context, ref)),
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Çıkış yap'),
            onTap: () => ref.read(supabaseClientProvider).auth.signOut(),
          ),
        ],
        const Divider(),
        ListTile(
          leading: const Icon(Icons.location_on_outlined),
          title: const Text('Konum izni'),
          subtitle: Text(loc.whenOrNull(data: locationStatusMessage) ?? '…'),
          trailing: TextButton(onPressed: () => ref.read(locationServiceProvider).openSettings(), child: const Text('Ayarlar')),
        ),
        const ListTile(
          leading: Icon(Icons.shield_outlined),
          title: Text('Konum verisi'),
          subtitle: Text('Kesin konumunuz yalnızca yakınlık aramasında kullanılır ve sunucuda saklanmaz.'),
        ),
        ListTile(
          leading: const Icon(Icons.privacy_tip_outlined),
          title: const Text('Gizlilik politikası'),
          onTap: () => launchUrl(Uri.parse('${Env.publicWebUrl}/gizlilik')),
        ),
        ListTile(
          leading: const Icon(Icons.description_outlined),
          title: const Text('Kullanım koşulları'),
          onTap: () => launchUrl(Uri.parse('${Env.publicWebUrl}/kullanim-kosullari')),
        ),
        ListTile(
          leading: const Icon(Icons.storefront_outlined),
          title: const Text('İşletme sahibi misiniz?'),
          subtitle: const Text('Menünüzü web panelinden ekleyin'),
          onTap: () => launchUrl(Uri.parse('${Env.publicWebUrl}/kayit'), mode: LaunchMode.externalApplication),
        ),
        if (user != null) ...[
          const Divider(),
          ListTile(
            leading: const Icon(Icons.delete_forever, color: Brand.danger),
            title: const Text('Hesabımı sil', style: TextStyle(color: Brand.danger)),
            onTap: () => _deleteAccount(context, ref),
          ),
        ],
        const SizedBox(height: 24),
        const Center(child: Text(Brand.appName, style: TextStyle(color: Brand.mutedForeground))),
        const SizedBox(height: 24),
      ]),
    );
  }

  Future<void> _editName(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: ref.read(_displayNameProvider).value ?? '');
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Görünen ad'),
        content: TextField(controller: controller, maxLength: 80, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Kaydet')),
        ],
      ),
    );
    if (name == null) return;
    try {
      await ref.read(accountRepoProvider).updateDisplayName(name);
      ref.invalidate(_displayNameProvider);
    } catch (e) {
      if (context.mounted) showSnack(context, friendlyError(e), error: true);
    }
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final repo = ref.read(accountRepoProvider);
    try {
      final blockers = await repo.deletionBlockers();
      if (!context.mounted) return;
      if (blockers.isNotEmpty) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Hesap silinemiyor'),
            content: Text(
                'Tek sahibi olduğunuz işletmeler var: ${blockers.join(', ')}. İşletmeler sahipsiz bırakılamaz; önce web panelinden bu işletmeleri silin.'),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Tamam'))],
          ),
        );
        return;
      }
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Hesabınız silinsin mi?'),
          content: const Text('Profiliniz ve favorileriniz kalıcı olarak silinir; gönderdiğiniz bildirimler anonimleştirilir. Bu işlem geri alınamaz.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
            FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Sil')),
          ],
        ),
      );
      if (ok != true) return;
      await repo.deleteAccount();
      if (context.mounted) showSnack(context, 'Hesabınız silindi.');
    } catch (e) {
      if (context.mounted) showSnack(context, friendlyError(e), error: true);
    }
  }
}
