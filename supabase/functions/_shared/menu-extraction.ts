// AI menü aktarma: sağlayıcıdan bağımsız sözleşme, sınırlar ve doğrulama.
// Bu modül saf TypeScript'tir (Deno ve Vitest tarafından içe aktarılabilir).

export const LIMITS = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxPdfPages: 10,
  maxItems: 300,
} as const;

export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

export interface SourceFile {
  path: string;
  mime: AcceptedMime;
  bytes: Uint8Array;
}

/** Modelden beklenen ham çıktı (JSON Schema ile sınırlandırılır). */
export interface RawExtraction {
  items: {
    category: string | null;
    name: string | null;
    description: string | null;
    price_text: string | null;
    variants: { name: string | null; price_text: string | null }[];
    uncertain: boolean;
    note: string | null;
  }[];
}

/** Panelde gösterilen taslak satır. Fiyatlar kuruş; okunamayanlar null ve işaretli. */
export interface DraftItem {
  category: string | null;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  variants: { name: string | null; price_cents: number | null }[];
  flags: string[]; // 'name_missing' | 'price_missing' | 'price_unparsed' | 'model_uncertain' | 'variant_incomplete'
  note: string | null;
}

export interface ExtractionResult {
  draft: DraftItem[];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Değiştirilebilir sağlayıcı arayüzü. */
export interface MenuExtractionProvider {
  readonly name: string;
  readonly model: string;
  extract(files: SourceFile[]): Promise<RawExtraction & { inputTokens?: number; outputTokens?: number }>;
}

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'name', 'description', 'price_text', 'variants', 'uncertain', 'note'],
        properties: {
          category: { type: ['string', 'null'] },
          name: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          price_text: { type: ['string', 'null'] },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'price_text'],
              properties: { name: { type: ['string', 'null'] }, price_text: { type: ['string', 'null'] } },
            },
          },
          uncertain: { type: 'boolean' },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export const EXTRACTION_INSTRUCTIONS = `Sen bir menü okuma aracısın. Ekteki menü fotoğraflarından veya PDF'den ürünleri çıkar.
Kurallar:
- YALNIZCA görselde açıkça okunan bilgiyi yaz. Hiçbir fiyatı, ürün adını, açıklamayı veya içeriği tahmin etme ya da uydurma.
- Okunamayan veya emin olmadığın alanı null bırak ve "uncertain": true yap; nedenini "note" alanına kısaca yaz.
- "price_text" alanına fiyatı menüde yazdığı gibi aktar (ör. "95,50", "₺120", "1.250"). Fiyat yoksa null.
- Aynı ürünün boy/porsiyon seçenekleri varsa (küçük/büyük, tek/duble) bunları "variants" içinde ver; bu durumda "price_text" null olabilir.
- "category" menüdeki başlıktır (ör. "Sıcak İçecekler"); görünmüyorsa null.
- Alerjen, beslenme etiketi veya içerik bilgisi ÇIKARMA; bu bilgiler yalnızca işletme tarafından girilir.
- Menü dışı metinleri (adres, slogan, kampanya) ürün olarak ekleme.`;

/** "95,50" | "₺1.250" | "120 TL" | "95.5" → kuruş. Belirsizse null. */
export function parsePriceText(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.replace(/\s|₺|TL|TRY/gi, '');
  let m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(s);
  if (m) return Number(m[1].replace(/\./g, '')) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
  m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s);
  if (m) return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
  return null;
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/** Model çıktısını doğrular ve panel taslağına dönüştürür. Uydurma riskine karşı tüm alanlar işaretlenir. */
export function normalizeExtraction(raw: unknown): DraftItem[] {
  const items = (raw as RawExtraction | null)?.items;
  if (!Array.isArray(items)) throw new Error('Sağlayıcı geçersiz bir yanıt döndürdü');
  return items.slice(0, LIMITS.maxItems).map((it) => {
    const flags: string[] = [];
    const name = clean(it?.name, 120);
    if (!name) flags.push('name_missing');
    const variants = Array.isArray(it?.variants)
      ? it.variants.slice(0, 12).map((v) => {
          const price = parsePriceText(v?.price_text);
          const vname = clean(v?.name, 60);
          if (!vname || price === null) flags.push('variant_incomplete');
          return { name: vname, price_cents: price };
        })
      : [];
    let price_cents: number | null = null;
    if (variants.length === 0) {
      price_cents = parsePriceText(it?.price_text);
      if (it?.price_text && price_cents === null) flags.push('price_unparsed');
      else if (price_cents === null) flags.push('price_missing');
    }
    if (it?.uncertain === true) flags.push('model_uncertain');
    return {
      category: clean(it?.category, 80),
      name,
      description: clean(it?.description, 500),
      price_cents,
      variants,
      flags: Array.from(new Set(flags)),
      note: clean(it?.note, 300),
    };
  });
}

/** PDF sayfa sayısını kaba ama güvenli biçimde sayar (sınır kontrolü için). */
export function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches ? matches.length : 1;
}

export function validateFiles(files: SourceFile[]): { ok: true; pages: number } | { ok: false; message: string } {
  if (files.length === 0) return { ok: false, message: 'En az bir dosya seçin' };
  if (files.length > LIMITS.maxFiles) return { ok: false, message: `En fazla ${LIMITS.maxFiles} dosya yüklenebilir` };
  let total = 0;
  let pages = 0;
  for (const f of files) {
    if (!ACCEPTED_MIME.includes(f.mime)) return { ok: false, message: 'Yalnızca JPEG, PNG, WebP veya PDF desteklenir' };
    if (f.bytes.byteLength > LIMITS.maxFileBytes) return { ok: false, message: 'Dosya başına en fazla 10 MB' };
    total += f.bytes.byteLength;
    pages += f.mime === 'application/pdf' ? countPdfPages(f.bytes) : 1;
  }
  if (total > LIMITS.maxTotalBytes) return { ok: false, message: 'Toplam dosya boyutu 20 MB’ı aşamaz' };
  if (pages > LIMITS.maxPdfPages) return { ok: false, message: `Toplam en fazla ${LIMITS.maxPdfPages} sayfa/görsel işlenebilir (${pages})` };
  return { ok: true, pages };
}

export function mimeFromPath(path: string): AcceptedMime | null {
  const ext = path.toLowerCase().split('.').pop();
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null;
}
