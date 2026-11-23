import { describe, expect, it } from 'vitest';
import { centsToInput, formatHoursRange, formatPrice, formatPriceWithVariants, parsePriceToCents } from './format';
import { parseSignedTl } from '@/pages/panel/BulkPriceDialog';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('fiyat biçimlendirme (TR)', () => {
  it('kuruşu Türkçe TL biçiminde gösterir', () => {
    expect(nbsp(formatPrice(9500))).toBe('₺95');
    expect(nbsp(formatPrice(9550))).toBe('₺95,50');
    expect(nbsp(formatPrice(125075))).toBe('₺1.250,75');
    expect(nbsp(formatPrice(0))).toBe('₺0');
  });
  it('varyantlı üründe başlangıç fiyatını açıkça belirtir', () => {
    expect(nbsp(formatPriceWithVariants(8000, true))).toBe("₺80'den başlayan");
    expect(nbsp(formatPriceWithVariants(8000, false))).toBe('₺80');
  });
});

describe('TL girişini kuruşa çevirme (kayan nokta yok)', () => {
  it.each([
    ['95', 9500],
    ['95,5', 9550],
    ['95,50', 9550],
    ['95.50', 9550],
    ['1.250,75', 125075],
    ['0,10', 10],
    ['₺ 12', 1200],
    ['19,99', 1999],
  ])('%s → %d', (input, cents) => expect(parsePriceToCents(input)).toBe(cents));

  it.each(['', 'abc', '1,234', '12,345', '-5', '1.2.3'])('geçersiz: "%s"', (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });

  it('gidiş-dönüş tutarlı', () => {
    for (const c of [0, 1, 10, 99, 100, 9550, 125075]) expect(parsePriceToCents(centsToInput(c))).toBe(c);
  });

  it('işaretli tutar (toplu güncelleme)', () => {
    expect(parseSignedTl('-5')).toBe(-500);
    expect(parseSignedTl('+2,50')).toBe(250);
    expect(parseSignedTl('x')).toBeNull();
  });
});

describe('çalışma saati gösterimi', () => {
  it('gece yarısını geçen ve tam gün aralıkları', () => {
    expect(formatHoursRange('18:00:00', '02:00:00')).toBe('18:00 – 02:00 (ertesi gün)');
    expect(formatHoursRange('00:00:00', '24:00:00')).toBe('24 saat açık');
    expect(formatHoursRange('09:00', '17:30')).toBe('09:00 – 17:30');
  });
});
