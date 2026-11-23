import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../config/brand.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../services/location_service.dart';
import '../../state/providers.dart';
import '../../widgets/state_views.dart';

/// Ürün araması: seçili bölgedeki (veya yakındaki) yayınlanmış işletmelerin görünür ürünleri.
class ProductSearchScreen extends ConsumerStatefulWidget {
  const ProductSearchScreen({super.key, this.initialQuery = ''});
  final String initialQuery;

  @override
  ConsumerState<ProductSearchScreen> createState() => _ProductSearchScreenState();
}

class _ProductSearchScreenState extends ConsumerState<ProductSearchScreen> {
  late final _text = TextEditingController(text: widget.initialQuery);
  final _budget = TextEditingController();
  late String _submitted = widget.initialQuery.trim();
  int? _maxPriceCents;
  ProductSort _sort = ProductSort.price;
  String? _budgetError;

  @override
  void dispose() {
    _text.dispose();
    _budget.dispose();
    super.dispose();
  }

  void _applyBudget(String v) {
    if (v.trim().isEmpty) {
      setState(() {
        _maxPriceCents = null;
        _budgetError = null;
      });
      return;
    }
    final c = parseLiraToCents(v);
    setState(() {
      _budgetError = c == null ? 'Geçerli bir tutar girin' : null;
      if (c != null) _maxPriceCents = c;
    });
  }

  Future<void> _sortByDistance() async {
    if (ref.read(discoverQueryProvider).userLocation == null) {
      final res = await ref.read(locationServiceProvider).requestCurrent();
      if (!mounted) return;
      if (res.point == null) {
        showSnack(context, '${locationStatusMessage(res.status)} Mesafe sıralaması için konum gerekir.');
        return;
      }
      ref.read(discoverQueryProvider.notifier).setUserLocation(res.point);
    }
    setState(() => _sort = ProductSort.distance);
  }

  @override
  Widget build(BuildContext context) {
    final discover = ref.watch(discoverQueryProvider);
    final q = ProductQuery(
      text: _submitted,
      bounds: discover.bounds,
      userLocation: discover.userLocation,
      maxPriceCents: _maxPriceCents,
      sort: _sort,
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Ürün ara')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
          child: TextField(
            controller: _text,
            autofocus: widget.initialQuery.isEmpty,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(hintText: 'ör. latte, lahmacun', prefixIcon: Icon(Icons.search)),
            onSubmitted: (v) => setState(() => _submitted = v.trim()),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 140,
              child: TextField(
                controller: _budget,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(labelText: 'En fazla ₺', errorText: _budgetError, isDense: true),
                onSubmitted: _applyBudget,
                onChanged: _applyBudget,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Wrap(spacing: 6, children: [
                ChoiceChip(label: const Text('Fiyat'), selected: _sort == ProductSort.price, onSelected: (_) => setState(() => _sort = ProductSort.price)),
                ChoiceChip(label: const Text('Mesafe'), selected: _sort == ProductSort.distance, onSelected: (_) => _sortByDistance()),
              ]),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
          child: Text(
            discover.bounds != null ? 'Seçili harita bölgesinde aranıyor' : 'Tüm yayınlanmış işletmelerde aranıyor',
            style: const TextStyle(color: Brand.mutedForeground, fontSize: 12),
          ),
        ),
        const Divider(),
        Expanded(child: _submitted.length < 2 ? const EmptyView(icon: Icons.search, title: 'Bir ürün adı yazın', message: 'En az 2 karakter') : _Results(query: q)),
      ]),
    );
  }
}

class _Results extends ConsumerWidget {
  const _Results({required this.query});
  final ProductQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final res = ref.watch(productResultsProvider(query));
    return res.when(
      loading: () => const LoadingView(label: 'Aranıyor…'),
      error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(productResultsProvider(query))),
      data: (list) {
        if (list.isEmpty) {
          return EmptyView(
            icon: Icons.no_food_outlined,
            title: '“${query.text}” bulunamadı',
            message: query.maxPriceCents != null ? 'Bütçeyi artırmayı veya bölgeyi genişletmeyi deneyin.' : 'Farklı bir ürün adı deneyin.',
          );
        }
        return ListView.separated(
          itemCount: list.length,
          separatorBuilder: (_, _) => const Divider(indent: 16),
          itemBuilder: (_, i) => _ResultTile(r: list[i]),
        );
      },
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.r});
  final MenuItemResult r;

  @override
  Widget build(BuildContext context) {
    final sub = [r.businessName, if (r.district != null) r.district!, if (r.distanceM != null) formatDistance(r.distanceM)].join(' · ');
    return ListTile(
      onTap: () => context.push('/isletme/${r.businessId}'),
      title: Text(r.itemName, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(sub + (r.isAvailable ? '' : ' · Tükendi')),
      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
        if (r.hasVariants) const Text('başlangıç', style: TextStyle(fontSize: 11, color: Brand.mutedForeground)),
        Text(formatPrice(r.priceCents), style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
      ]),
    );
  }
}
