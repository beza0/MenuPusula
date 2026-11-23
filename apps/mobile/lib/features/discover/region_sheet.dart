import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/format.dart';
import '../../state/providers.dart';
import '../../widgets/state_views.dart';

/// Konum izni olmadan keşif: yayınlanmış işletmelerin bulunduğu şehir/ilçeler.
class RegionSheet extends ConsumerStatefulWidget {
  const RegionSheet({super.key});
  @override
  ConsumerState<RegionSheet> createState() => _RegionSheetState();
}

class _RegionSheetState extends ConsumerState<RegionSheet> {
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final regions = ref.watch(regionsProvider);
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                decoration: const InputDecoration(hintText: 'Şehir veya ilçe ara', prefixIcon: Icon(Icons.search)),
                onChanged: (v) => setState(() => _filter = trNormalize(v.trim())),
              ),
            ),
            Expanded(
              child: regions.when(
                loading: () => const LoadingView(),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(regionsProvider)),
                data: (list) {
                  final shown = list.where((r) => _filter.isEmpty || trNormalize(r.label).contains(_filter)).toList();
                  if (shown.isEmpty) return const EmptyView(title: 'Bölge bulunamadı', message: 'Bu bölgede henüz yayınlanmış işletme yok.');
                  return ListView.builder(
                    itemCount: shown.length,
                    itemBuilder: (_, i) => ListTile(
                      leading: const Icon(Icons.place_outlined),
                      title: Text(shown[i].label),
                      trailing: Text('${shown[i].count} işletme'),
                      onTap: () => Navigator.pop(context, shown[i]),
                    ),
                  );
                },
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
