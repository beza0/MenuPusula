import 'package:material_ui/material_ui.dart';

import '../config/brand.dart';
import '../core/format.dart';
import '../data/models.dart';
import 'media.dart';

class OpenBadge extends StatelessWidget {
  const OpenBadge({super.key, required this.isOpen});
  final bool? isOpen;

  @override
  Widget build(BuildContext context) {
    if (isOpen == null) return const SizedBox.shrink();
    final open = isOpen!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: open ? const Color(0xFFEBFBEE) : Brand.muted,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(open ? 'Açık' : 'Kapalı',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: open ? Brand.success : Brand.mutedForeground)),
    );
  }
}

/// Liste satırı ve haritadaki alt kart için kısa işletme kartı.
class BusinessCard extends StatelessWidget {
  const BusinessCard({super.key, required this.business, required this.onTap, this.urls, this.trailing});
  final BusinessSummary business;
  final VoidCallback onTap;
  final Map<String, String>? urls;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final b = business;
    final meta = [
      b.type.label,
      if (b.locationLabel.isNotEmpty) b.locationLabel,
      if (b.distanceM != null) formatDistance(b.distanceM),
    ].join(' · ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(width: 72, height: 72, child: StorageImage(path: b.coverPath ?? b.logoPath, urls: urls)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(
                    child: Text(b.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  ),
                  if (b.isVerified) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.verified, size: 16, color: Brand.primary, semanticLabel: 'Doğrulanmış işletme'),
                  ],
                ]),
                const SizedBox(height: 2),
                Text(meta, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.mutedForeground, fontSize: 13)),
                const SizedBox(height: 6),
                OpenBadge(isOpen: b.isOpenNow),
              ]),
            ),
            ?trailing,
          ]),
        ),
      ),
    );
  }
}
