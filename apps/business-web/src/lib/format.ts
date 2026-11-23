/** Fiyatlar veritabanında kuruş (integer) olarak tutulur; yalnızca gösterimde TL'ye çevrilir. */
const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
const tlWhole = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

export function formatPrice(cents: number): string {
  return cents % 100 === 0 ? tlWhole.format(cents / 100) : tl.format(cents / 100);
}

export function formatPriceWithVariants(cents: number, hasVariants: boolean): string {
  return hasVariants ? `${formatPrice(cents)}'den başlayan` : formatPrice(cents);
}

/**
 * Kullanıcının yazdığı TL tutarını kuruşa çevirir. "95", "95,5", "95,50", "1.250,75", "95.50" kabul edilir.
 * Kayan nokta kullanılmaz: metin tam sayı ve kuruş kısmına ayrılır.
 */
export function parsePriceToCents(input: string): number | null {
  const s = input.trim().replace(/\s|₺|TL/gi, '');
  if (!s) return null;
  let intPart: string;
  let fracPart = '';
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    // 1.250,75 biçimi
    const [i, f = ''] = s.split(',');
    intPart = i.replace(/\./g, '');
    fracPart = f;
  } else if (/^\d+([.,]\d{1,2})?$/.test(s)) {
    const [i, f = ''] = s.split(/[.,]/);
    intPart = i;
    fracPart = f;
  } else {
    return null;
  }
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents > 100_000_000) return null;
  return cents;
}

/** Düzenleme alanı için kuruş → "95,50" */
export function centsToInput(cents: number): string {
  const i = Math.floor(cents / 100);
  const f = cents % 100;
  return f === 0 ? String(i) : `${i},${String(f).padStart(2, '0')}`;
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
});

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '—';
}

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Pazartesi', short: 'Pzt' },
  { value: 2, label: 'Salı', short: 'Sal' },
  { value: 3, label: 'Çarşamba', short: 'Çar' },
  { value: 4, label: 'Perşembe', short: 'Per' },
  { value: 5, label: 'Cuma', short: 'Cum' },
  { value: 6, label: 'Cumartesi', short: 'Cmt' },
  { value: 7, label: 'Pazar', short: 'Paz' },
];

export function formatHoursRange(opens: string, closes: string): string {
  const o = opens.slice(0, 5);
  const c = closes.slice(0, 5) === '24:00' ? '24:00' : closes.slice(0, 5);
  if (o === '00:00' && c === '24:00') return '24 saat açık';
  return c <= o ? `${o} – ${c} (ertesi gün)` : `${o} – ${c}`;
}
