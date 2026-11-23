/**
 * Marka yapılandırması — uygulama adı, logo ve renkler YALNIZCA buradan değiştirilir.
 * Renkler `index.css` içindeki CSS değişkenlerine `applyBrandTheme()` ile aktarılır.
 * Mobil uygulamadaki karşılığı: apps/mobile/lib/config/brand.dart
 */
export const brand = {
  appName: 'Menü Atlası',
  tagline: 'Yakınındaki mekânların güncel menüleri',
  /** public/ altındaki logo dosyası */
  logoSrc: '/logo.svg',
  colors: {
    primary: '#E8590C', // sıcak turuncu
    primaryForeground: '#FFFFFF',
    primarySoft: '#FFF1E6',
    background: '#FFFCF9',
    foreground: '#1C1917',
    muted: '#F5F1EC',
    mutedForeground: '#6B635B',
    border: '#E7E0D8',
    danger: '#C92A2A',
    success: '#2B8A3E',
  },
  supportEmail: 'destek@menuatlasi.example',
} as const;

export function applyBrandTheme(root: HTMLElement = document.documentElement) {
  const c = brand.colors;
  const vars: Record<string, string> = {
    '--color-primary': c.primary,
    '--color-primary-foreground': c.primaryForeground,
    '--color-primary-soft': c.primarySoft,
    '--color-background': c.background,
    '--color-foreground': c.foreground,
    '--color-muted': c.muted,
    '--color-muted-foreground': c.mutedForeground,
    '--color-border': c.border,
    '--color-danger': c.danger,
    '--color-success': c.success,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.title = brand.appName;
}
