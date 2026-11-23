import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../config/brand.dart';
import '../state/providers.dart';

/// Özel depolamadaki görseli imzalı URL ile gösterir; görsel yoksa düzenli bir yer tutucu çizer.
/// Önbellek anahtarı depolama yoludur (imzalı URL her seferinde değişse de yeniden indirilmez).
class StorageImage extends ConsumerWidget {
  const StorageImage({super.key, required this.path, this.urls, this.placeholderIcon = Icons.restaurant, this.fit = BoxFit.cover});
  final String? path;
  final Map<String, String>? urls;
  final IconData placeholderIcon;
  final BoxFit fit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = path;
    if (p == null) return ImagePlaceholder(icon: placeholderIcon);
    final map = urls ?? ref.watch(signedUrlsProvider(p)).value;
    final url = map?[p];
    if (url == null) return ImagePlaceholder(icon: placeholderIcon);
    return CachedNetworkImage(
      imageUrl: url,
      cacheKey: p,
      fit: fit,
      fadeInDuration: Duration.zero,
      placeholder: (_, _) => ImagePlaceholder(icon: placeholderIcon),
      errorWidget: (_, _, _) => ImagePlaceholder(icon: placeholderIcon),
    );
  }
}

class ImagePlaceholder extends StatelessWidget {
  const ImagePlaceholder({super.key, this.icon = Icons.restaurant});
  final IconData icon;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: Brand.muted,
        child: Center(child: Icon(icon, color: Brand.mutedForeground.withValues(alpha: 0.6), semanticLabel: 'Görsel yok')),
      );
}

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 28});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(color: Brand.primary, shape: BoxShape.circle),
        child: Icon(Icons.restaurant_menu, color: Colors.white, size: size * 0.58),
      );
}
