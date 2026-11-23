import type { BusinessStatus, BusinessType } from './types';

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurant: 'Restoran',
  cafe: 'Kafe',
};

export const STATUS_LABELS: Record<BusinessStatus, string> = {
  draft: 'Taslak',
  pending_review: 'İncelemede',
  published: 'Yayında',
  rejected: 'Reddedildi',
  suspended: 'Askıya alındı',
};

/** İşletmenin beyan ettiği beslenme / alerjen etiketleri (veritabanındaki kontrol listesiyle aynı). */
export const DIETARY_TAGS: { id: string; label: string; group: 'diet' | 'allergen' }[] = [
  { id: 'vegan', label: 'Vegan', group: 'diet' },
  { id: 'vegetarian', label: 'Vejetaryen', group: 'diet' },
  { id: 'gluten_free', label: 'Glutensiz', group: 'diet' },
  { id: 'lactose_free', label: 'Laktozsuz', group: 'diet' },
  { id: 'spicy', label: 'Acılı', group: 'diet' },
  { id: 'halal', label: 'Helal', group: 'diet' },
  { id: 'contains_gluten', label: 'Gluten içerir', group: 'allergen' },
  { id: 'contains_milk', label: 'Süt içerir', group: 'allergen' },
  { id: 'contains_egg', label: 'Yumurta içerir', group: 'allergen' },
  { id: 'contains_nuts', label: 'Kabuklu yemiş içerir', group: 'allergen' },
  { id: 'contains_peanuts', label: 'Yer fıstığı içerir', group: 'allergen' },
  { id: 'contains_soy', label: 'Soya içerir', group: 'allergen' },
  { id: 'contains_fish', label: 'Balık içerir', group: 'allergen' },
  { id: 'contains_shellfish', label: 'Kabuklu deniz ürünü içerir', group: 'allergen' },
  { id: 'contains_sesame', label: 'Susam içerir', group: 'allergen' },
  { id: 'contains_celery', label: 'Kereviz içerir', group: 'allergen' },
  { id: 'contains_mustard', label: 'Hardal içerir', group: 'allergen' },
  { id: 'contains_sulphites', label: 'Sülfit içerir', group: 'allergen' },
];

export const TAG_LABEL: Record<string, string> = Object.fromEntries(DIETARY_TAGS.map((t) => [t.id, t.label]));

export const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_price: 'Hatalı fiyat',
  closed_permanently: 'İşletme kapanmış',
  wrong_info: 'Hatalı bilgi',
  inappropriate: 'Uygunsuz içerik',
  other: 'Diğer',
};
