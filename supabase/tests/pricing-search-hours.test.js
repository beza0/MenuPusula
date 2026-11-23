// Kabul kriterleri 9, 10, 12 ve fiyat hesaplama
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, createReadyBusiness, createUser, db, makeAdmin, must, publish, uniq } from './helpers.js';

let owner, admin, user, visitor;

beforeAll(async () => {
  owner = await createUser('owner');
  admin = await createUser('admin');
  user = await createUser('user');
  await makeAdmin(admin.id);
  visitor = anon();
});

afterAll(async () => {
  await db.end();
});

const calc = async (old, mode, value, round = 1) => {
  const { rows } = await db.query('select public.calc_new_price($1, $2, $3, $4) as v', [old, mode, value, round]);
  return rows[0].v;
};

describe('fiyat hesaplama (kuruş, tam sayı)', () => {
  it('yüzde artış ve yuvarlama', async () => {
    expect(await calc(9500, 'percent', 10)).toBe(10450);
    expect(await calc(3333, 'percent', 10)).toBe(3666); // 3666.3 → 3666
    expect(await calc(3335, 'percent', 10)).toBe(3669); // 3668.5 → 3669 (yarım yukarı)
    expect(await calc(9500, 'percent', 7, 100)).toBe(10200); // 10165 → 10200 (tam lira)
    expect(await calc(9500, 'percent', 7, 50)).toBe(10150);
    expect(await calc(9500, 'percent', -10)).toBe(8550);
  });

  it('sabit tutar (kuruş) ve hatalı girişler', async () => {
    expect(await calc(9500, 'fixed', 500)).toBe(10000);
    expect(await calc(9500, 'fixed', -500)).toBe(9000);
    await expect(calc(100, 'fixed', -500)).rejects.toThrow(/negatif/);
    await expect(calc(100, 'fixed', 1.5)).rejects.toThrow(/tam sayı/);
    await expect(calc(100, 'percent', 900)).rejects.toThrow(/-90 ile 500/);
    await expect(calc(100, 'percent', 10, 3)).rejects.toThrow(/yuvarlama/);
    await expect(calc(100, 'zam', 10)).rejects.toThrow(/Geçersiz/);
  });

  it('kayan nokta hatası yok: 0.1 + 0.2 senaryosu', async () => {
    expect(await calc(10, 'fixed', 20)).toBe(30);
    expect(await calc(1999, 'percent', 15)).toBe(2299); // 2298.85 → 2299
  });
});

describe('toplu fiyat güncelleme ve varyantlar', () => {
  it('önizleme yazmaz, onay sonrası yazar; varyantlı ürünün başlangıç fiyatı senkron kalır', async () => {
    const { business, items } = await createReadyBusiness(owner, {
      items: [{ name: 'Filtre Kahve', price_cents: 6000 }, { name: 'Latte', price_cents: 9000 }, { name: 'Çay', price_cents: 2500 }],
    });
    const latte = items.find((i) => i.name === 'Latte');
    await must(owner.client.from('menu_item_variants').insert([
      { item_id: latte.id, name: 'Küçük', price_cents: 8000, sort_order: 0 },
      { item_id: latte.id, name: 'Büyük', price_cents: 11000, sort_order: 1 },
    ]));
    let { data: l } = await owner.client.from('menu_items').select('price_cents, has_variants').eq('id', latte.id).single();
    expect(l).toEqual({ price_cents: 8000, has_variants: true });

    const ids = items.filter((i) => i.name !== 'Çay').map((i) => i.id);
    const preview = await must(owner.client.rpc('bulk_update_prices', {
      p_business_id: business.id, p_item_ids: ids, p_mode: 'percent', p_value: 10, p_round_to: 50, p_apply: false,
    }));
    expect(preview.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ item_name: 'Filtre Kahve', variant_name: null, old_price_cents: 6000, new_price_cents: 6600 }),
      expect.objectContaining({ item_name: 'Latte', variant_name: 'Küçük', old_price_cents: 8000, new_price_cents: 8800 }),
      expect.objectContaining({ item_name: 'Latte', variant_name: 'Büyük', old_price_cents: 11000, new_price_cents: 12100 }),
    ]));
    expect(preview.data).toHaveLength(3);
    const { rows: unchanged } = await db.query('select price_cents from public.menu_items where id = $1', [ids[0]]);
    expect(unchanged[0].price_cents).toBe(6000);

    await must(owner.client.rpc('bulk_update_prices', {
      p_business_id: business.id, p_item_ids: ids, p_mode: 'percent', p_value: 10, p_round_to: 50, p_apply: true,
    }));
    const { data: after } = await owner.client.from('menu_items').select('name, price_cents').eq('business_id', business.id).order('name');
    expect(after).toEqual([
      { name: 'Çay', price_cents: 2500 },
      { name: 'Filtre Kahve', price_cents: 6600 },
      { name: 'Latte', price_cents: 8800 }, // başlangıç fiyatı = en düşük varyant
    ]);

    // Varyant silinirse ürün varyantsız hale gelir
    await must(owner.client.from('menu_item_variants').delete().eq('item_id', latte.id));
    ({ data: l } = await owner.client.from('menu_items').select('has_variants').eq('id', latte.id).single());
    expect(l.has_variants).toBe(false);
  });

  it('negatif fiyata yol açan toplu güncelleme hiçbir şeyi değiştirmez', async () => {
    const { business, items } = await createReadyBusiness(owner, { items: [{ name: 'A', price_cents: 1000 }, { name: 'B', price_cents: 100 }] });
    const res = await owner.client.rpc('bulk_update_prices', {
      p_business_id: business.id, p_item_ids: items.map((i) => i.id), p_mode: 'fixed', p_value: -500, p_apply: true,
    });
    expect(res.error?.message).toMatch(/negatif/);
    const { rows } = await db.query('select price_cents from public.menu_items where business_id = $1 order by name', [business.id]);
    expect(rows.map((r) => r.price_cents)).toEqual([1000, 100]);
  });
});

describe('ürün araması', () => {
  let near, far, hidden, tag;

  beforeAll(async () => {
    tag = uniq('Flatte').replace('-', '');
    // Yakın ama pahalı
    near = await createReadyBusiness(owner, {
      name: `Yakın ${tag}`, lat: 40.9905, lng: 29.0292,
      items: [{ name: `${tag} Latte`, price_cents: 15000 }],
    });
    // Uzak ama ucuz, varyantlı
    far = await createReadyBusiness(owner, {
      name: `Uzak ${tag}`, lat: 41.0400, lng: 29.0000,
      items: [{ name: `Buzlu ${tag} LATTE`, price_cents: 0 }],
    });
    await must(owner.client.from('menu_item_variants').insert([
      { item_id: far.items[0].id, name: 'Orta', price_cents: 9000 },
      { item_id: far.items[0].id, name: 'Büyük', price_cents: 12000 },
    ]));
    // Yayında olmayan işletme
    hidden = await createReadyBusiness(owner, { name: `Taslak ${tag}`, items: [{ name: `${tag} Latte`, price_cents: 100 }] });
    await publish(owner, admin, near.business.id);
    await publish(owner, admin, far.business.id);
  });

  const search = (params) => visitor.rpc('search_menu_items', { p_query: tag, ...params });

  it('yalnızca yayınlanmış işletmelerin ürünleri; büyük/küçük harf ve Türkçe karakter duyarsız', async () => {
    const { data, error } = await search({});
    expect(error).toBeNull();
    expect(data.map((r) => r.business_id).sort()).toEqual([near.business.id, far.business.id].sort());
    expect(data.some((r) => r.business_id === hidden.business.id)).toBe(false);
    const up = await visitor.rpc('search_menu_items', { p_query: tag.toUpperCase() });
    expect(up.data).toHaveLength(2);
  });

  it('fiyata göre sıralama ve varyantlı üründe başlangıç fiyatı', async () => {
    const { data } = await search({ p_sort: 'price' });
    expect(data.map((r) => r.price_cents)).toEqual([9000, 15000]);
    expect(data[0]).toMatchObject({ has_variants: true, business_name: `Uzak ${tag}` });
  });

  it('mesafeye göre sıralama', async () => {
    const { data } = await search({ p_sort: 'distance', p_user_lat: 40.9903, p_user_lng: 29.029 });
    expect(data.map((r) => r.business_id)).toEqual([near.business.id, far.business.id]);
    expect(data[0].distance_m).toBeLessThan(100);
    expect(data[1].distance_m).toBeGreaterThan(5000);
  });

  it('bütçe üst sınırı', async () => {
    const { data } = await search({ p_max_price_cents: 10000 });
    expect(data.map((r) => r.business_id)).toEqual([far.business.id]);
    const none = await search({ p_max_price_cents: 5000 });
    expect(none.data).toEqual([]);
  });

  it('harita sınırlarıyla filtreleme', async () => {
    const { data } = await search({ p_min_lng: 29.02, p_min_lat: 40.98, p_max_lng: 29.04, p_max_lat: 41.0 });
    expect(data.map((r) => r.business_id)).toEqual([near.business.id]);
  });

  it('işletme araması: sınırlar, tür filtresi, mesafe ve sayfalama', async () => {
    const all = await visitor.rpc('search_businesses', { p_query: tag, p_user_lat: 40.9903, p_user_lng: 29.029 });
    expect(all.data.map((r) => r.id)).toEqual([near.business.id, far.business.id]);
    const page2 = await visitor.rpc('search_businesses', { p_query: tag, p_user_lat: 40.9903, p_user_lng: 29.029, p_limit: 1, p_offset: 1 });
    expect(page2.data.map((r) => r.id)).toEqual([far.business.id]);
    const within = await visitor.rpc('search_businesses', { p_query: tag, p_user_lat: 40.9903, p_user_lng: 29.029, p_max_distance_m: 1000 });
    expect(within.data.map((r) => r.id)).toEqual([near.business.id]);
    const restaurants = await visitor.rpc('search_businesses', { p_query: tag, p_types: ['restaurant'] });
    expect(restaurants.data).toEqual([]);
    const tooShort = await visitor.rpc('search_menu_items', { p_query: 'a' });
    expect(tooShort.error).not.toBeNull();
  });

  it('konum izni olmadan bölge listesi yayınlanmış verilerden gelir', async () => {
    const { data } = await visitor.rpc('list_regions');
    expect(data.find((r) => r.city === 'İstanbul' && r.district === 'Kadıköy')).toBeTruthy();
    const byCity = await visitor.rpc('search_businesses', { p_query: 'kadikoy' });
    expect(byCity.data.length).toBeGreaterThan(0);
  });
});

describe('çalışma saatleri (gece yarısını geçen aralıklar)', () => {
  let businessId;

  beforeAll(async () => {
    const { data } = await must(owner.client.from('businesses').insert({ name: 'Gece Barı Kafe', type: 'cafe' }).select().single());
    businessId = data.id;
    // Cuma (5) 18:00 → Cumartesi 02:00; Pazar (7) 00:00–24:00 (tam gün)
    await must(owner.client.from('business_hours').insert([
      { business_id: businessId, weekday: 5, opens_at: '18:00', closes_at: '02:00' },
      { business_id: businessId, weekday: 1, opens_at: '09:00', closes_at: '12:00' },
      { business_id: businessId, weekday: 1, opens_at: '14:00', closes_at: '18:00' },
      { business_id: businessId, weekday: 7, opens_at: '00:00', closes_at: '24:00' },
    ]));
  });

  const isOpen = async (ts) => {
    const { rows } = await db.query('select public.business_is_open_at($1, $2) as v', [businessId, ts]);
    return rows[0].v;
  };

  it('aynı gün içindeki aralıklar', async () => {
    // 2026-11-23 Pazartesi (İstanbul UTC+3)
    expect(await isOpen('2026-11-23T10:00:00+03:00')).toBe(true);
    expect(await isOpen('2026-11-23T13:00:00+03:00')).toBe(false);
    expect(await isOpen('2026-11-23T12:00:00+03:00')).toBe(false); // kapanış anı hariç
    expect(await isOpen('2026-11-23T14:00:00+03:00')).toBe(true);
  });

  it('gece yarısını geçen aralık ertesi güne taşar', async () => {
    // 2026-11-27 Cuma
    expect(await isOpen('2026-11-27T17:59:00+03:00')).toBe(false);
    expect(await isOpen('2026-11-27T23:30:00+03:00')).toBe(true);
    expect(await isOpen('2026-11-28T01:30:00+03:00')).toBe(true); // Cumartesi gece
    expect(await isOpen('2026-11-28T02:00:00+03:00')).toBe(false);
    expect(await isOpen('2026-11-28T20:00:00+03:00')).toBe(false); // Cumartesi kayıt yok
  });

  it('tam gün açık ve saat dilimi', async () => {
    expect(await isOpen('2026-11-29T23:59:00+03:00')).toBe(true); // Pazar
    // UTC 21:30 Pazar = İstanbul 00:30 Pazartesi → kapalı
    expect(await isOpen('2026-11-29T21:30:00Z')).toBe(false);
  });

  it('istisna günleri (özel kapanış / özel saat)', async () => {
    await must(owner.client.from('business_hour_exceptions').insert([
      { business_id: businessId, date: '2026-11-27', is_closed: true, note: 'Bakım' },
      { business_id: businessId, date: '2026-11-30', is_closed: false, opens_at: '20:00', closes_at: '03:00' },
    ]));
    expect(await isOpen('2026-11-27T23:30:00+03:00')).toBe(false); // Cuma kapalı
    expect(await isOpen('2026-11-28T01:30:00+03:00')).toBe(false); // önceki gün kapalı olduğu için taşma yok
    expect(await isOpen('2026-11-30T10:00:00+03:00')).toBe(false); // Pazartesi normal saat istisnayla değişti
    expect(await isOpen('2026-12-01T02:30:00+03:00')).toBe(true);  // istisna gece yarısını geçer
  });

  it('geçersiz aralıklar reddedilir', async () => {
    const same = await owner.client.from('business_hours').insert({ business_id: businessId, weekday: 2, opens_at: '10:00', closes_at: '10:00' });
    expect(same.error).not.toBeNull();
    const badDay = await owner.client.from('business_hours').insert({ business_id: businessId, weekday: 8, opens_at: '10:00', closes_at: '11:00' });
    expect(badDay.error).not.toBeNull();
  });
});

describe('favoriler, bildirimler, istatistik, hesap silme', () => {
  let business;

  beforeAll(async () => {
    ({ business } = await createReadyBusiness(owner));
    await publish(owner, admin, business.id);
  });

  it('favoriye ekleme/çıkarma kalıcıdır, tekrar eklenemez', async () => {
    await must(user.client.from('favorites').insert({ business_id: business.id }));
    const dup = await user.client.from('favorites').insert({ business_id: business.id });
    expect(dup.error?.code).toBe('23505');
    // Yeni oturumla (kalıcılık) kontrol
    const again = anon();
    await again.auth.signInWithPassword({ email: user.email, password: user.password });
    const { data } = await again.from('favorites').select('business_id');
    expect(data.map((f) => f.business_id)).toContain(business.id);
    await must(again.from('favorites').delete().eq('business_id', business.id));
    const { data: after } = await user.client.from('favorites').select('business_id');
    expect(after).toEqual([]);
    // Ziyaretçi favori ekleyemez, başkasının favorisi görünmez
    const anonFav = await visitor.from('favorites').insert({ business_id: business.id });
    expect(anonFav.error).not.toBeNull();
  });

  it('yayında olmayan işletme favorilenemez', async () => {
    const { business: draft } = await createReadyBusiness(owner);
    const r = await user.client.from('favorites').insert({ business_id: draft.id });
    expect(r.error).not.toBeNull();
  });

  it('bildirim: kullanıcı oluşturur, başkası göremez, yönetici sonuçlandırır', async () => {
    const { data: rep } = await must(user.client.from('reports')
      .insert({ business_id: business.id, reason: 'wrong_price', message: 'Latte fiyatı farklı' }).select().single());
    expect(rep.status).toBe('open');
    expect(rep.reporter_id).toBe(user.id);
    const ownerView = await owner.client.from('reports').select('id').eq('id', rep.id);
    expect(ownerView.data).toEqual([]);
    const selfResolve = await user.client.from('reports').update({ status: 'resolved' }).eq('id', rep.id).select();
    expect(selfResolve.error).not.toBeNull();
    await must(admin.client.rpc('admin_resolve_report', { p_report_id: rep.id, p_status: 'resolved', p_note: 'Fiyat güncellendi' }));
    const { data: mine } = await user.client.from('reports').select('status').eq('id', rep.id).single();
    expect(mine.status).toBe('resolved');
    const anonReport = await visitor.from('reports').insert({ business_id: business.id, reason: 'other' });
    expect(anonReport.error).not.toBeNull();
  });

  it('istatistik: gerçek olaylar, tekrar sayım engeli, taslak sayılmaz, yalnızca üyeler görür', async () => {
    const clientId = `test-client-${uniq('c')}-0000`;
    const first = await visitor.rpc('log_event', { p_business_id: business.id, p_event_type: 'menu_view', p_source: 'web', p_client_id: clientId });
    expect(first.data).toBe(true);
    const dup = await visitor.rpc('log_event', { p_business_id: business.id, p_event_type: 'menu_view', p_source: 'web', p_client_id: clientId });
    expect(dup.data).toBe(false);
    await visitor.rpc('log_event', { p_business_id: business.id, p_event_type: 'business_view', p_source: 'app', p_client_id: clientId });
    // Sahip kendi görüntülemesini saymaz
    const ownView = await owner.client.rpc('log_event', { p_business_id: business.id, p_event_type: 'menu_view', p_source: 'web', p_client_id: `${clientId}-x` });
    expect(ownView.data).toBe(false);

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    const { data: stats } = await must(owner.client.rpc('get_business_stats', { p_business_id: business.id, p_from: today, p_to: today }));
    expect(stats).toEqual([{ day: today, business_views: 1, menu_views: 1 }]);
    const foreign = await user.client.rpc('get_business_stats', { p_business_id: business.id, p_from: today, p_to: today });
    expect(foreign.error?.code).toBe('42501');
    const raw = await visitor.from('analytics_events').select('*');
    expect(raw.error).not.toBeNull();
  });

  it('hesap silme: tek sahibi olunan işletme varsa engellenir', async () => {
    const { data: blockers } = await owner.client.rpc('account_deletion_blockers');
    expect(blockers.length).toBeGreaterThan(0);
    const { data: none } = await user.client.rpc('account_deletion_blockers');
    expect(none).toEqual([]);
  });
});
