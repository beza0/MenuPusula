import 'package:material_ui/material_ui.dart';

/// Marka yapılandırması — ad, logo ve renkler YALNIZCA buradan değiştirilir.
/// Web paneldeki karşılığı: apps/business-web/src/config/brand.ts
abstract final class Brand {
  static const appName = 'Menü Atlası';
  static const tagline = 'Yakınındaki mekânların güncel menüleri';

  static const primary = Color(0xFFE8590C); // sıcak turuncu
  static const primarySoft = Color(0xFFFFF1E6);
  static const background = Color(0xFFFFFCF9);
  static const foreground = Color(0xFF1C1917);
  static const muted = Color(0xFFF5F1EC);
  static const mutedForeground = Color(0xFF6B635B);
  static const border = Color(0xFFE7E0D8);
  static const danger = Color(0xFFC92A2A);
  static const success = Color(0xFF2B8A3E);
}
