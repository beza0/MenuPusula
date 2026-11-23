import { describe, expect, it } from 'vitest';
import { bulkPriceSchema, businessInfoSchema, hoursRowSchema, menuItemSchema } from './schemas';

const baseItem = {
  name: 'Latte', description: '', category_id: '7f0c2e9a-1b2c-4d3e-8f90-123456789abc', price: '95',
  variants: [], is_available: true, is_hidden: false, tags: [], dietary_info_confirmed: false,
};

describe('ürün doğrulama', () => {
  it('geçerli ürün', () => expect(menuItemSchema.safeParse(baseItem).success).toBe(true));
  it('varyantsız üründe fiyat zorunlu', () => {
    const r = menuItemSchema.safeParse({ ...baseItem, price: '' });
    expect(r.success).toBe(false);
  });
  it('varyant varsa ana fiyat gerekmez ve varyant fiyatı kuruşa çevrilir', () => {
    const r = menuItemSchema.safeParse({ ...baseItem, price: '', variants: [{ name: 'Küçük', price: '80' }, { name: 'Büyük', price: '110,50' }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.variants.map((v) => v.price)).toEqual([8000, 11050]);
  });
  it('aynı adlı varyant reddedilir (Türkçe büyük/küçük harf)', () => {
    const r = menuItemSchema.safeParse({ ...baseItem, variants: [{ name: 'İri', price: '1' }, { name: 'iri', price: '2' }] });
    expect(r.success).toBe(false);
  });
  it('etiketler doğrulama onayı olmadan kaydedilemez', () => {
    expect(menuItemSchema.safeParse({ ...baseItem, tags: ['vegan'] }).success).toBe(false);
    expect(menuItemSchema.safeParse({ ...baseItem, tags: ['vegan'], dietary_info_confirmed: true }).success).toBe(true);
  });
});

describe('işletme doğrulama', () => {
  const base = {
    name: 'Kafe', type: 'cafe', cuisines: [], description: '', phone: '', website_url: '', instagram_url: '',
    facebook_url: '', address_line: '', district: '', city: '', latitude: null, longitude: null,
  };
  it('boş isteğe bağlı alanlar null olur', () => {
    const r = businessInfoSchema.parse(base);
    expect(r.phone).toBeNull();
    expect(r.website_url).toBeNull();
  });
  it('geçersiz telefon ve bağlantı reddedilir', () => {
    expect(businessInfoSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
    expect(businessInfoSchema.safeParse({ ...base, website_url: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('enlem ve boylam birlikte verilmeli', () => {
    expect(businessInfoSchema.safeParse({ ...base, latitude: 41 }).success).toBe(false);
  });
});

describe('saat ve toplu fiyat doğrulama', () => {
  it('saat aralıkları', () => {
    expect(hoursRowSchema.safeParse({ weekday: 5, opens_at: '18:00', closes_at: '02:00' }).success).toBe(true);
    expect(hoursRowSchema.safeParse({ weekday: 1, opens_at: '00:00', closes_at: '24:00' }).success).toBe(true);
    expect(hoursRowSchema.safeParse({ weekday: 1, opens_at: '10:00', closes_at: '10:00' }).success).toBe(false);
    expect(hoursRowSchema.safeParse({ weekday: 1, opens_at: '25:00', closes_at: '10:00' }).success).toBe(false);
  });
  it('toplu fiyat sınırları', () => {
    expect(bulkPriceSchema.safeParse({ mode: 'percent', value: 10, roundTo: 1 }).success).toBe(true);
    expect(bulkPriceSchema.safeParse({ mode: 'percent', value: -95, roundTo: 1 }).success).toBe(false);
    expect(bulkPriceSchema.safeParse({ mode: 'fixed', value: 1.5, roundTo: 1 }).success).toBe(false);
    expect(bulkPriceSchema.safeParse({ mode: 'fixed', value: 0, roundTo: 1 }).success).toBe(false);
  });
});
