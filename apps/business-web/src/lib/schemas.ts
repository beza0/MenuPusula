import { z } from 'zod';
import { parsePriceToCents } from './format';

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), 'Geçerli bir bağlantı girin (https:// ile)')
  .transform((v) => (v === '' ? null : v));

const optionalText = (max: number) =>
  z.string().trim().max(max, `En fazla ${max} karakter`).transform((v) => (v === '' ? null : v));

export const businessInfoSchema = z
  .object({
    name: z.string().trim().min(2, 'İşletme adı en az 2 karakter olmalı').max(120),
    type: z.enum(['restaurant', 'cafe'], { message: 'Tür seçin' }),
    cuisines: z.array(z.string()).max(6, 'En fazla 6 mutfak türü seçin'),
    description: optionalText(1000),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Geçerli bir telefon numarası girin')
      .transform((v) => (v === '' ? null : v)),
    website_url: optionalUrl,
    instagram_url: optionalUrl,
    facebook_url: optionalUrl,
    address_line: optionalText(300),
    district: optionalText(80),
    city: optionalText(80),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: 'Konum eksik', path: ['latitude'],
  });

export type BusinessInfoInput = z.input<typeof businessInfoSchema>;
export type BusinessInfo = z.output<typeof businessInfoSchema>;

export const priceString = z
  .string()
  .trim()
  .min(1, 'Fiyat girin')
  .refine((v) => parsePriceToCents(v) !== null, 'Geçerli bir fiyat girin (ör. 95 veya 95,50)')
  .transform((v) => parsePriceToCents(v) as number);

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Kategori adı girin').max(80),
  description: optionalText(300),
  is_visible: z.boolean(),
});

export const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Seçenek adı girin').max(60),
  price: priceString,
});

export const menuItemSchema = z
  .object({
    name: z.string().trim().min(1, 'Ürün adı girin').max(120),
    description: optionalText(500),
    category_id: z.string().uuid('Kategori seçin'),
    price: z.string(),
    variants: z.array(variantSchema).max(12, 'En fazla 12 seçenek'),
    is_available: z.boolean(),
    is_hidden: z.boolean(),
    tags: z.array(z.string()),
    dietary_info_confirmed: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.variants.length === 0 && parsePriceToCents(v.price) === null) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Geçerli bir fiyat girin (ör. 95 veya 95,50)' });
    }
    const names = v.variants.map((x) => x.name.trim().toLocaleLowerCase('tr'));
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Seçenek adları benzersiz olmalı' });
    }
    if (v.tags.length > 0 && !v.dietary_info_confirmed) {
      ctx.addIssue({ code: 'custom', path: ['dietary_info_confirmed'], message: 'Etiketleri yayınlamak için doğruladığınızı onaylayın' });
    }
  });

export type MenuItemInput = z.input<typeof menuItemSchema>;
export type MenuItemOutput = z.output<typeof menuItemSchema>;

export const hoursRowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  opens_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'SS:DD'),
  closes_at: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'SS:DD'),
}).refine((r) => r.opens_at !== r.closes_at, { message: 'Açılış ve kapanış aynı olamaz', path: ['closes_at'] });

export const bulkPriceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('percent'),
    value: z.number({ message: 'Yüzde girin' }).min(-90, 'En az -%90').max(500, 'En fazla %500').refine((v) => v !== 0, 'Sıfırdan farklı olmalı'),
    roundTo: z.union([z.literal(1), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]),
  }),
  z.object({
    mode: z.literal('fixed'),
    /** kuruş */
    value: z.number().int().refine((v) => v !== 0, 'Sıfırdan farklı olmalı'),
    roundTo: z.union([z.literal(1), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]),
  }),
]);

export const passwordSchema = z.string().min(8, 'Şifre en az 8 karakter olmalı').max(72);
export const emailSchema = z.string().trim().email('Geçerli bir e-posta girin');
