// İkinci aşama: AI menü aktarma — sağlayıcıdan bağımsız doğrulama ve onay akışı.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countPdfPages, normalizeExtraction, parsePriceText, validateFiles } from '../functions/_shared/menu-extraction.ts';
import { anon, createReadyBusiness, createUser, db, must } from './helpers.js';

afterAll(async () => {
  await db.end();
});

describe('çıkarım çıktısı doğrulama', () => {
  it('fiyat metnini kuruşa çevirir, belirsizse null', () => {
    expect(parsePriceText('95,50')).toBe(9550);
    expect(parsePriceText('₺1.250')).toBe(125000);
    expect(parsePriceText('120 TL')).toBe(12000);
    expect(parsePriceText('yaklaşık 100')).toBeNull();
    expect(parsePriceText(null)).toBeNull();
  });

  it('eksik/okunamayan alanları işaretler; fiyat uydurmaz', () => {
    const draft = normalizeExtraction({
      items: [
        { category: 'Kahveler', name: 'Latte', description: null, price_text: '95', variants: [], uncertain: false, note: null },
        { category: 'Kahveler', name: 'Mocha', description: null, price_text: null, variants: [], uncertain: true, note: 'fiyat bulanık' },
        { category: null, name: null, description: null, price_text: '??', variants: [], uncertain: true, note: null },
        { category: 'Çay', name: 'Çay', description: null, price_text: null, variants: [{ name: 'Küçük', price_text: '20' }, { name: 'Büyük', price_text: null }], uncertain: false, note: null },
      ],
    });
    expect(draft[0]).toMatchObject({ name: 'Latte', price_cents: 9500, flags: [] });
    expect(draft[1].price_cents).toBeNull();
    expect(draft[1].flags).toEqual(expect.arrayContaining(['price_missing', 'model_uncertain']));
    expect(draft[2].flags).toEqual(expect.arrayContaining(['name_missing', 'price_unparsed']));
    expect(draft[3].variants).toEqual([{ name: 'Küçük', price_cents: 2000 }, { name: 'Büyük', price_cents: null }]);
    expect(draft[3].flags).toContain('variant_incomplete');
    expect(() => normalizeExtraction({ foo: 1 })).toThrow();
  });

  it('dosya sınırları ve PDF sayfa sayımı', () => {
    const pdf = new TextEncoder().encode('%PDF /Type /Pages /Type /Page /Type /Page');
    expect(countPdfPages(pdf)).toBe(2);
    const img = (n) => ({ path: `x/${n}.jpg`, mime: 'image/jpeg', bytes: new Uint8Array(10) });
    expect(validateFiles([img(1)])).toEqual({ ok: true, pages: 1 });
    expect(validateFiles([1, 2, 3, 4, 5, 6].map(img)).ok).toBe(false);
    expect(validateFiles([{ path: 'x/a.exe', mime: 'application/x-msdownload', bytes: new Uint8Array(1) }]).ok).toBe(false);
    const bigPdf = new TextEncoder().encode('/Type /Page '.repeat(11));
    expect(validateFiles([{ path: 'x/m.pdf', mime: 'application/pdf', bytes: bigPdf }]).ok).toBe(false);
  });
});

describe('taslağın onaylanması', () => {
  let owner, other, business, jobId;

  beforeAll(async () => {
    owner = await createUser('owner');
    other = await createUser('other');
    ({ business } = await createReadyBusiness(owner));
    const { rows } = await db.query(
      `insert into public.menu_import_jobs (business_id, created_by, status, provider, model, source_paths, draft)
       values ($1::uuid, $2, 'ready', 'test', 'test', array[$1::text || '/a.jpg'], '[]') returning id`,
      [business.id, owner.id],
    );
    jobId = rows[0].id;
  });

  it('servis anahtarı yokken fonksiyon "yapılandırılmamış" döner, elle ekleme etkilenmez', async () => {
    const { error } = await owner.client.functions.invoke('menu-import', { method: 'POST', body: { business_id: business.id, paths: [] } });
    expect(error.context.status).toBe(503);
    expect((await error.context.json()).code).toBe('not_configured');
  });

  it('istemci taslak işi oluşturamaz; başkası onaylayamaz', async () => {
    const ins = await owner.client.from('menu_import_jobs').insert({ business_id: business.id, status: 'ready', provider: 'x', source_paths: [] });
    expect(ins.error).not.toBeNull();
    const foreign = await other.client.rpc('apply_menu_import', { p_job_id: jobId, p_items: [{ name: 'X', price_cents: 1 }] });
    expect(foreign.error?.code).toBe('42501');
    expect((await other.client.from('menu_import_jobs').select('id').eq('id', jobId)).data).toEqual([]);
  });

  it('fiyatsız ürün onaylanamaz', async () => {
    const r = await owner.client.rpc('apply_menu_import', { p_job_id: jobId, p_items: [{ category: 'Tatlılar', name: 'Baklava', price_cents: null }] });
    expect(r.error?.message).toMatch(/fiyat girilmemiş/);
  });

  it('onaylanan ürünler varsayılan olarak gizli eklenir; iş tekrar uygulanamaz', async () => {
    const { data } = await must(owner.client.rpc('apply_menu_import', {
      p_job_id: jobId,
      p_items: [
        { category: 'Tatlılar', name: 'Baklava', description: 'Fıstıklı', price_cents: 18000 },
        { category: 'kahveler', name: 'Latte (AI)', variants: [{ name: 'Küçük', price_cents: 9000 }, { name: 'Büyük', price_cents: 11000 }] },
      ],
    }));
    expect(data).toBe(2);
    const { rows } = await db.query(
      `select i.name, i.price_cents, i.is_hidden, i.has_variants, c.name as cat from public.menu_items i join public.menu_categories c on c.id = i.category_id
       where i.business_id = $1 and i.name in ('Baklava', 'Latte (AI)') order by i.name`, [business.id]);
    expect(rows).toEqual([
      { name: 'Baklava', price_cents: 18000, is_hidden: true, has_variants: false, cat: 'Tatlılar' },
      { name: 'Latte (AI)', price_cents: 9000, is_hidden: true, has_variants: true, cat: 'Kahveler' }, // mevcut kategori eşleşti
    ]);
    const visitor = anon();
    const again = await owner.client.rpc('apply_menu_import', { p_job_id: jobId, p_items: [{ name: 'X', price_cents: 1 }] });
    expect(again.error?.message).toMatch(/zaten uygulanmış/);
    expect(visitor).toBeTruthy();
  });
});
