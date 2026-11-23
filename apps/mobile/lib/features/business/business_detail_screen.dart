import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/brand.dart';
import '../../config/env.dart';
import '../../core/errors.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../widgets/business_card.dart';
import '../../widgets/media.dart';
import '../../widgets/state_views.dart';
import 'report_sheet.dart';

class BusinessDetailScreen extends ConsumerStatefulWidget {
  const BusinessDetailScreen({super.key, required this.businessId});
  final String businessId;

  @override
  ConsumerState<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends ConsumerState<BusinessDetailScreen> {
  bool _logged = false;

  void _logViews(BusinessDetail b) {
    if (_logged) return;
    _logged = true;
    ref.read(clientIdProvider.future).then((cid) {
      final repo = ref.read(discoveryRepoProvider);
      repo.logEvent(b.id, 'business_view', cid);
      repo.logEvent(b.id, 'menu_view', cid);
    }).ignore();
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(businessDetailProvider(widget.businessId));
    return detail.when(
      loading: () => Scaffold(appBar: AppBar(), body: const LoadingView()),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorView(error: e, title: 'İşletme yüklenemedi', onRetry: () => ref.invalidate(businessDetailProvider(widget.businessId))),
      ),
      data: (b) {
        if (b == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyView(
              icon: Icons.storefront_outlined,
              title: 'İşletme şu anda görüntülenemiyor',
              message: 'İşletme yayından kaldırılmış veya geçici olarak kapatılmış olabilir.',
            ),
          );
        }
        _logViews(b);
        return _DetailView(business: b);
      },
    );
  }
}

class _DetailView extends ConsumerStatefulWidget {
  const _DetailView({required this.business});
  final BusinessDetail business;

  @override
  ConsumerState<_DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends ConsumerState<_DetailView> {
  String _menuQuery = '';
  int _category = 0;

  BusinessDetail get b => widget.business;

  Future<void> _toggleFavorite() async {
    if (ref.read(currentUserProvider) == null) {
      _askLogin('Favorilere eklemek için giriş yapın.');
      return;
    }
    try {
      await ref.read(favoriteIdsProvider.notifier).toggle(b.id);
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    }
  }

  void _askLogin(String message) {
    showSnack(context, message);
    context.push('/profil/giris');
  }

  Future<void> _open(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) showSnack(context, 'Bağlantı açılamadı', error: true);
    }
  }

  Future<void> _report() async {
    if (ref.read(currentUserProvider) == null) {
      _askLogin('Bildirim göndermek için giriş yapın.');
      return;
    }
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ReportSheet(businessId: b.id),
    );
    if (sent == true && mounted) showSnack(context, 'Bildiriminiz alındı. Teşekkürler!');
  }

  @override
  Widget build(BuildContext context) {
    final favs = ref.watch(favoriteIdsProvider).value ?? const {};
    final isFav = favs.contains(b.id);
    final paths = [b.coverPath, b.logoPath, for (final c in b.categories) for (final i in c.items) i.imagePath];
    final urls = ref.watch(signedUrlsProvider(pathsKey(paths))).value;

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 180,
          actions: [
            IconButton(
              tooltip: isFav ? 'Favorilerden çıkar' : 'Favorilere ekle',
              onPressed: _toggleFavorite,
              icon: Icon(isFav ? Icons.favorite : Icons.favorite_border, color: isFav ? Brand.primary : null),
            ),
            PopupMenuButton<String>(
              tooltip: 'Diğer',
              onSelected: (v) {
                if (v == 'report') _report();
                if (v == 'web') _open(Uri.parse('${Env.publicWebUrl}/m/${b.publicId}'));
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'report', child: Text('Hatalı bilgi bildir')),
                PopupMenuItem(value: 'web', child: Text('Web menüsünü aç')),
              ],
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: StorageImage(path: b.coverPath, urls: urls, placeholderIcon: Icons.restaurant_menu),
          ),
        ),
        SliverToBoxAdapter(child: _Header(business: b, urls: urls, onDirections: _directions, onCall: _call, onReport: _report)),
        if (b.categories.isEmpty)
          const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(24), child: Text('Bu işletme henüz menü eklemedi.')))
        else ...[
          SliverPersistentHeader(
            pinned: true,
            delegate: _MenuToolbar(
              categories: b.categories,
              selected: _category,
              searching: _menuQuery.isNotEmpty,
              onSelect: (i) => setState(() => _category = i),
              onSearch: (v) => setState(() => _menuQuery = v.trim()),
            ),
          ),
          ..._menuSlivers(urls),
        ],
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 32),
            child: Text(
              'Etiketler ve alerjen bilgileri işletme tarafından beyan edilmiştir. Kesin bilgi için işletmeye danışın.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Brand.mutedForeground),
            ),
          ),
        ),
      ]),
    );
  }

  List<Widget> _menuSlivers(Map<String, String>? urls) {
    final q = trNormalize(_menuQuery);
    final cats = q.isEmpty
        ? [b.categories[_category.clamp(0, b.categories.length - 1)]]
        : b.categories
            .map((c) => MenuCategory(
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  items: c.items.where((i) => trNormalize(i.name).contains(q) || trNormalize(i.description ?? '').contains(q)).toList(),
                ))
            .where((c) => c.items.isNotEmpty)
            .toList();
    if (cats.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(padding: const EdgeInsets.all(24), child: Text('“$_menuQuery” için menüde sonuç yok.', textAlign: TextAlign.center)),
        ),
      ];
    }
    return [
      for (final c in cats) ...[
        if (q.isNotEmpty || c.description != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (q.isNotEmpty) Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                if (c.description != null) Text(c.description!, style: const TextStyle(color: Brand.mutedForeground)),
              ]),
            ),
          ),
        SliverList.separated(
          itemCount: c.items.length,
          separatorBuilder: (_, _) => const Divider(indent: 16, endIndent: 16),
          itemBuilder: (_, i) => MenuItemTile(item: c.items[i], urls: urls),
        ),
      ],
    ];
  }

  void _directions() {
    if (b.latitude == null) return;
    _open(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}'));
  }

  void _call() {
    if (b.phone == null) return;
    _open(Uri(scheme: 'tel', path: b.phone!.replaceAll(' ', '')));
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.business, required this.urls, required this.onDirections, required this.onCall, required this.onReport});
  final BusinessDetail business;
  final Map<String, String>? urls;
  final VoidCallback onDirections, onCall, onReport;

  @override
  Widget build(BuildContext context) {
    final b = business;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(width: 56, height: 56, child: StorageImage(path: b.logoPath, urls: urls, placeholderIcon: Icons.storefront)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(b.name, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                if (b.isVerified) ...[
                  const SizedBox(width: 6),
                  const Tooltip(message: 'Doğrulanmış işletme', child: Icon(Icons.verified, color: Brand.primary, size: 20)),
                ],
              ]),
              Text([b.type.label, ...b.cuisines].join(' · '), style: const TextStyle(color: Brand.mutedForeground)),
            ]),
          ),
          OpenBadge(isOpen: b.isOpenNow),
        ]),
        if (b.description != null) ...[const SizedBox(height: 10), Text(b.description!)],
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (b.latitude != null) FilledButton.icon(onPressed: onDirections, icon: const Icon(Icons.directions), label: const Text('Yol tarifi')),
          if (b.phone != null) OutlinedButton.icon(onPressed: onCall, icon: const Icon(Icons.call), label: const Text('Ara')),
          OutlinedButton.icon(onPressed: onReport, icon: const Icon(Icons.flag_outlined), label: const Text('Bildir')),
        ]),
        const SizedBox(height: 8),
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 8),
          leading: const Icon(Icons.info_outline),
          title: const Text('Adres, saatler ve iletişim'),
          children: [
            if (b.fullAddress.isNotEmpty) _InfoRow(icon: Icons.place_outlined, text: b.fullAddress),
            if (b.phone != null) _InfoRow(icon: Icons.call_outlined, text: b.phone!),
            for (final (label, url) in [('Web sitesi', b.websiteUrl), ('Instagram', b.instagramUrl), ('Facebook', b.facebookUrl)])
              if (url != null)
                _InfoRow(
                  icon: Icons.link,
                  text: label,
                  onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                ),
            const SizedBox(height: 8),
            _HoursTable(hours: b.hours),
          ],
        ),
        Text('Menü son güncelleme: ${formatDateTime(b.menuUpdatedAt)}', style: const TextStyle(fontSize: 12, color: Brand.mutedForeground)),
        if (b.pricesCheckedAt != null)
          Text('Fiyatlar işletme tarafından son kontrol edildi: ${formatDate(b.pricesCheckedAt)}',
              style: const TextStyle(fontSize: 12, color: Brand.mutedForeground)),
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text, this.onTap});
  final IconData icon;
  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, size: 20),
        title: Text(text, style: onTap != null ? const TextStyle(color: Brand.primary) : null),
        onTap: onTap,
      );
}

class _HoursTable extends StatelessWidget {
  const _HoursTable({required this.hours});
  final List<OpeningHours> hours;

  @override
  Widget build(BuildContext context) {
    if (hours.isEmpty) return const Text('Çalışma saatleri belirtilmemiş.');
    final today = DateTime.now().weekday;
    return Column(children: [
      for (var d = 1; d <= 7; d++)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(children: [
            Expanded(child: Text(weekdayNames[d - 1], style: TextStyle(fontWeight: d == today ? FontWeight.w700 : null))),
            Text(
              hours.where((h) => h.weekday == d).map((h) => formatHoursRange(h.opensAt, h.closesAt)).join(', ').ifEmpty('Kapalı'),
              style: TextStyle(fontWeight: d == today ? FontWeight.w700 : null),
            ),
          ]),
        ),
    ]);
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class _MenuToolbar extends SliverPersistentHeaderDelegate {
  _MenuToolbar({required this.categories, required this.selected, required this.searching, required this.onSelect, required this.onSearch});
  final List<MenuCategory> categories;
  final int selected;
  final bool searching;
  final ValueChanged<int> onSelect;
  final ValueChanged<String> onSearch;

  @override
  double get minExtent => 116;
  @override
  double get maxExtent => 116;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Material(
      color: Brand.background,
      elevation: overlapsContent ? 1 : 0,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Menüde ara', prefixIcon: Icon(Icons.search), isDense: true),
            textInputAction: TextInputAction.search,
            onChanged: onSearch,
          ),
        ),
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            itemCount: categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) => ChoiceChip(
              label: Text(categories[i].name),
              selected: !searching && i == selected,
              onSelected: (_) => onSelect(i),
            ),
          ),
        ),
      ]),
    );
  }

  @override
  bool shouldRebuild(covariant _MenuToolbar old) =>
      old.selected != selected || old.searching != searching || old.categories != categories;
}

class MenuItemTile extends StatelessWidget {
  const MenuItemTile({super.key, required this.item, this.urls});
  final MenuItem item;
  final Map<String, String>? urls;

  @override
  Widget build(BuildContext context) {
    final i = item;
    return Opacity(
      opacity: i.isAvailable ? 1 : 0.55,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
                if (!i.hasVariants) _Price(i.priceCents),
              ]),
              if (i.description != null) ...[
                const SizedBox(height: 2),
                Text(i.description!, style: const TextStyle(color: Brand.mutedForeground, fontSize: 13)),
              ],
              if (i.hasVariants)
                for (final v in i.variants)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(children: [Expanded(child: Text(v.name)), _Price(v.priceCents)]),
                  ),
              if (!i.isAvailable || i.tags.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(spacing: 4, runSpacing: 4, children: [
                    if (!i.isAvailable) const _Tag('Tükendi', danger: true),
                    for (final t in i.tags) _Tag(dietaryTagLabels[t] ?? t),
                  ]),
                ),
            ]),
          ),
          const SizedBox(width: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(width: 72, height: 72, child: StorageImage(path: i.imagePath, urls: urls)),
          ),
        ]),
      ),
    );
  }
}

class _Price extends StatelessWidget {
  const _Price(this.cents);
  final int cents;
  @override
  Widget build(BuildContext context) => Text(
        formatPrice(cents),
        style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
      );
}

class _Tag extends StatelessWidget {
  const _Tag(this.label, {this.danger = false});
  final String label;
  final bool danger;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: danger ? const Color(0xFFFFF5F5) : Brand.muted, borderRadius: BorderRadius.circular(99)),
        child: Text(label, style: TextStyle(fontSize: 12, color: danger ? Brand.danger : Brand.foreground)),
      );
}
