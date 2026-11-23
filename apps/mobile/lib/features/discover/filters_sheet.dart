import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../services/location_service.dart';
import '../../state/providers.dart';
import '../../widgets/state_views.dart';

class FiltersSheet extends ConsumerStatefulWidget {
  const FiltersSheet({super.key, required this.initial});
  final DiscoverQuery initial;

  @override
  ConsumerState<FiltersSheet> createState() => _FiltersSheetState();
}

class _FiltersSheetState extends ConsumerState<FiltersSheet> {
  late DiscoverQuery q = widget.initial;
  static const _distances = [1.0, 3.0, 5.0, 10.0];

  Future<void> _setDistance(double? km) async {
    if (km != null && q.userLocation == null) {
      // Mesafe filtresi konum gerektirir: izin yalnızca burada istenir.
      final res = await ref.read(locationServiceProvider).requestCurrent();
      if (!mounted) return;
      if (res.point == null) {
        showSnack(context, locationStatusMessage(res.status));
        return;
      }
      setState(() => q = q.copyWith(userLocation: () => res.point));
    }
    setState(() => q = q.copyWith(maxDistanceKm: () => km));
  }

  @override
  Widget build(BuildContext context) {
    final cuisines = ref.watch(cuisinesProvider);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Filtreler', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            const Text('Tür', style: TextStyle(fontWeight: FontWeight.w600)),
            Wrap(spacing: 8, children: [
              for (final t in BusinessType.values)
                FilterChip(
                  label: Text(t.label),
                  selected: q.types.contains(t),
                  onSelected: (v) => setState(() => q = q.copyWith(types: v ? {...q.types, t} : ({...q.types}..remove(t)))),
                ),
            ]),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Şu anda açık olanlar'),
              value: q.openNow,
              onChanged: (v) => setState(() => q = q.copyWith(openNow: v)),
            ),
            const Text('Mesafe', style: TextStyle(fontWeight: FontWeight.w600)),
            Wrap(spacing: 8, children: [
              ChoiceChip(label: const Text('Tümü'), selected: q.maxDistanceKm == null, onSelected: (_) => _setDistance(null)),
              for (final d in _distances)
                ChoiceChip(label: Text('${d.toStringAsFixed(0)} km'), selected: q.maxDistanceKm == d, onSelected: (_) => _setDistance(d)),
            ]),
            const SizedBox(height: 12),
            const Text('Mutfak türü', style: TextStyle(fontWeight: FontWeight.w600)),
            cuisines.when(
              loading: () => const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator()),
              error: (e, _) => TextButton(onPressed: () => ref.invalidate(cuisinesProvider), child: const Text('Mutfak türleri yüklenemedi — tekrar dene')),
              data: (list) => Wrap(spacing: 8, runSpacing: 4, children: [
                for (final c in list)
                  FilterChip(
                    label: Text(c.name),
                    selected: q.cuisines.contains(c.id),
                    onSelected: (v) =>
                        setState(() => q = q.copyWith(cuisines: v ? {...q.cuisines, c.id} : ({...q.cuisines}..remove(c.id)))),
                  ),
              ]),
            ),
            const SizedBox(height: 20),
            Row(children: [
              TextButton(
                onPressed: () => setState(() => q = DiscoverQuery(bounds: q.bounds, text: q.text, userLocation: q.userLocation)),
                child: const Text('Temizle'),
              ),
              const Spacer(),
              FilledButton(onPressed: () => Navigator.pop(context, q), child: const Text('Uygula')),
            ]),
          ]),
        ),
      ),
    );
  }
}
