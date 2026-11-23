// Kabul kriterleri 1, 3, 4, 5, 7, 8, 11 — yayın durumları ve yetki sınırları
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, createReadyBusiness, createUser, db, makeAdmin, must, publish } from './helpers.js';

let owner, other, admin, visitor;

beforeAll(async () => {
  owner = await createUser('owner');
  other = await createUser('other');
  admin = await createUser('admin');
  await makeAdmin(admin.id);
  visitor = anon();
});

afterAll(async () => {
  await db.end();
});

describe('işletme oluşturma ve yayın durumu', () => {
  it('istemci "published" göndererek yayın durumunu atlayamaz; kayıt taslak olarak oluşur', async () => {
    const { data, error } = await owner.client
      .from('businesses')
      .insert({ name: 'Hileli Kafe', type: 'cafe', status: 'published', is_verified: true })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.status).toBe('draft');
    expect(data.is_verified).toBe(false);
    const { data: members } = await owner.client.from('business_members').select('*').eq('business_id', data.id);
    expect(members).toEqual([expect.objectContaining({ user_id: owner.id, role: 'owner' })]);
  });

  it('eksik bilgiyle incelemeye gönderme sunucu tarafında reddedilir', async () => {
    const { data } = await must(owner.client.from('businesses').insert({ name: 'Eksik Kafe', type: 'cafe' }).select().single());
    const { error } = await owner.client.rpc('submit_business_for_review', { p_business_id: data.id });
    expect(error?.message).toMatch(/Eksik bilgiler: .*telefon.*adres.*harita konumu.*çalışma saatleri/);
  });

  it('onaylanmadan herkese açık sonuçlarda görünmez; onaydan sonra görünür', async () => {
    const { business } = await createReadyBusiness(owner, { name: 'Görünmez Kafe Testi' });

    const before = await visitor.from('businesses').select('id').eq('id', business.id);
    expect(before.data).toEqual([]);
    const pub0 = await visitor.rpc('get_public_business', { p_ref: business.public_id });
    expect(pub0.data).toBeNull();

    await must(owner.client.rpc('submit_business_for_review', { p_business_id: business.id }));
    const pending = await visitor.rpc('search_businesses', { p_query: 'Görünmez Kafe Testi' });
    expect(pending.data).toEqual([]);

    // Sahip kendi başvurusunu onaylayamaz
    const selfApprove = await owner.client.rpc('admin_review_business', { p_business_id: business.id, p_approve: true });
    expect(selfApprove.error?.code).toBe('42501');

    await must(admin.client.rpc('admin_review_business', { p_business_id: business.id, p_approve: true }));

    const after = await visitor.rpc('search_businesses', { p_query: 'görünmez kafe testi' });
    expect(after.data.map((r) => r.id)).toContain(business.id);
    expect(after.data[0].is_verified).toBe(false); // onay ≠ doğrulanmış rozeti
    const pub = await visitor.rpc('get_public_business', { p_ref: business.public_id });
    expect(pub.data.name).toBe('Görünmez Kafe Testi');
    expect(pub.data.categories[0].items[0]).toMatchObject({ name: 'Latte', price_cents: 9500 });

    const { data: logs } = await admin.client.from('admin_audit_logs').select('*').eq('target_id', business.id);
    expect(logs.map((l) => l.action)).toContain('business.approve');
  });

  it('sahip yayın/onay durumunu doğrudan güncelleyemez', async () => {
    const { business } = await createReadyBusiness(owner);
    const r1 = await owner.client.from('businesses').update({ status: 'published' }).eq('id', business.id).select();
    expect(r1.error?.code).toBe('42501');
    const r2 = await owner.client.from('businesses').update({ is_verified: true, verified_at: new Date().toISOString() }).eq('id', business.id).select();
    expect(r2.error?.code).toBe('42501');
    const r3 = await owner.client.from('businesses').update({ public_id: 'degistir123' }).eq('id', business.id).select();
    expect(r3.error?.code).toBe('42501');
  });

  it('ret gerekçe ister, reddedilen başvuru düzeltilip yeniden gönderilebilir', async () => {
    const { business } = await createReadyBusiness(owner);
    await must(owner.client.rpc('submit_business_for_review', { p_business_id: business.id }));
    const noReason = await admin.client.rpc('admin_review_business', { p_business_id: business.id, p_approve: false, p_reason: 'kısa' });
    expect(noReason.error?.message).toMatch(/gerekçe/);
    await must(admin.client.rpc('admin_review_business', {
      p_business_id: business.id, p_approve: false, p_reason: 'Adres bilgisi doğrulanamadı, lütfen kontrol edin.',
    }));
    const { data: b } = await owner.client.from('businesses').select('status, rejection_reason').eq('id', business.id).single();
    expect(b.status).toBe('rejected');
    expect(b.rejection_reason).toMatch(/Adres/);
    const again = await owner.client.rpc('submit_business_for_review', { p_business_id: business.id });
    expect(again.data).toBe('pending_review');
  });

  it('askıya alınan işletme ve QR menüsü herkese açık erişimden kalkar', async () => {
    const { business } = await createReadyBusiness(owner);
    await publish(owner, admin, business.id);
    await must(admin.client.rpc('admin_set_suspension', {
      p_business_id: business.id, p_suspend: true, p_reason: 'Kapanmış işletme bildirimi doğrulandı',
    }));
    expect((await visitor.rpc('get_public_business', { p_ref: business.public_id })).data).toBeNull();
    expect((await visitor.from('menu_items').select('id').eq('business_id', business.id)).data).toEqual([]);
    // Sahip kendi işletmesini görmeye devam eder ama askıyı kaldıramaz
    const { data: own } = await owner.client.from('businesses').select('status').eq('id', business.id).single();
    expect(own.status).toBe('suspended');
    const unsuspend = await owner.client.rpc('admin_set_suspension', { p_business_id: business.id, p_suspend: false });
    expect(unsuspend.error?.code).toBe('42501');
    await must(admin.client.rpc('admin_set_suspension', { p_business_id: business.id, p_suspend: false }));
    expect((await visitor.rpc('get_public_business', { p_ref: business.public_id })).data?.id).toBe(business.id);
  });
});

describe('başka işletmenin verisine erişim', () => {
  it('başka kullanıcı işletme bilgilerini veya menüyü değiştiremez', async () => {
    const { business, category, items } = await createReadyBusiness(owner);
    await publish(owner, admin, business.id);

    const upd = await other.client.from('businesses').update({ name: 'Ele geçirildi' }).eq('id', business.id).select();
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]); // RLS: satır etkilenmez

    const price = await other.client.from('menu_items').update({ price_cents: 1 }).eq('id', items[0].id).select();
    expect(price.data).toEqual([]);

    const del = await other.client.from('menu_items').delete().eq('id', items[0].id).select();
    expect(del.data).toEqual([]);

    const ins = await other.client.from('menu_items').insert({
      business_id: business.id, category_id: category.id, name: 'Sahte', price_cents: 1,
    });
    expect(ins.error?.code).toBe('42501');

    const join = await other.client.from('business_members').insert({ business_id: business.id, user_id: other.id, role: 'owner' });
    expect(join.error).not.toBeNull();

    const bulk = await other.client.rpc('bulk_update_prices', {
      p_business_id: business.id, p_item_ids: [items[0].id], p_mode: 'percent', p_value: -50, p_apply: true,
    });
    expect(bulk.error?.code).toBe('42501');

    const { rows } = await db.query('select name, price_cents from public.menu_items where id = $1', [items[0].id]);
    expect(rows[0]).toEqual({ name: 'Latte', price_cents: 9500 });
    const { rows: bRows } = await db.query('select name from public.businesses where id = $1', [business.id]);
    expect(bRows[0].name).not.toBe('Ele geçirildi');
  });

  it('ürün başka işletmenin kategorisine taşınamaz', async () => {
    const a = await createReadyBusiness(owner);
    const b = await createReadyBusiness(other);
    const res = await other.client.from('menu_items').insert({
      business_id: b.business.id, category_id: a.category.id, name: 'X', price_cents: 100,
    });
    expect(res.error).not.toBeNull();
  });

  it('başka işletmenin klasörüne dosya yüklenemez; taslak görseller herkese açık değildir', async () => {
    const { business } = await createReadyBusiness(owner);
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });

    const foreign = await other.client.storage.from('business-media').upload(`${business.id}/logo/x.png`, png);
    expect(foreign.error).not.toBeNull();

    const ok = await owner.client.storage.from('business-media').upload(`${business.id}/logo/logo.png`, png);
    expect(ok.error).toBeNull();

    const badPath = await owner.client.storage.from('business-media').upload(`${business.id}/secret/x.png`, png);
    expect(badPath.error).not.toBeNull();

    const exe = await owner.client.storage.from('business-media')
      .upload(`${business.id}/items/x.png`, new Blob(['MZ'], { type: 'application/x-msdownload' }));
    expect(exe.error).not.toBeNull();

    // Taslak: ziyaretçi imzalı URL alamaz
    const draftSigned = await visitor.storage.from('business-media').createSignedUrl(`${business.id}/logo/logo.png`, 60);
    expect(draftSigned.error).not.toBeNull();

    await publish(owner, admin, business.id);
    const pubSigned = await visitor.storage.from('business-media').createSignedUrl(`${business.id}/logo/logo.png`, 60);
    expect(pubSigned.error).toBeNull();
    const res = await fetch(pubSigned.data.signedUrl);
    expect(res.status).toBe(200);
  });
});

describe('yönetici yetkisi', () => {
  it('normal kullanıcı kendine admin yetkisi veremez', async () => {
    const ins = await other.client.from('admin_users').insert({ user_id: other.id });
    expect(ins.error).not.toBeNull();

    // Kullanıcı tarafından düzenlenebilen metadata yetki vermez
    await must(other.client.auth.updateUser({ data: { role: 'admin', is_admin: true } }));
    const { data: isAdmin } = await other.client.rpc('am_i_admin');
    expect(isAdmin).toBe(false);

    const { data: reports, error } = await other.client.from('admin_audit_logs').select('*');
    expect(error).toBeNull();
    expect(reports).toEqual([]);

    const verify = await other.client.rpc('admin_set_verified', {
      p_business_id: '00000000-0000-0000-0000-000000000000', p_verified: true, p_note: 'kendim',
    });
    expect(verify.error?.code).toBe('42501');
  });

  it('ziyaretçi yönetici fonksiyonlarını çağıramaz', async () => {
    const r = await visitor.rpc('admin_review_business', {
      p_business_id: '00000000-0000-0000-0000-000000000000', p_approve: true,
    });
    expect(r.error).not.toBeNull();
  });

  it('doğrulanmış rozeti yalnızca yöneticinin ayrı doğrulama kararıyla verilir', async () => {
    const { business } = await createReadyBusiness(owner);
    await publish(owner, admin, business.id);
    let { data } = await visitor.rpc('get_public_business', { p_ref: business.public_id });
    expect(data.is_verified).toBe(false);
    await must(admin.client.rpc('admin_set_verified', {
      p_business_id: business.id, p_verified: true, p_note: 'Vergi levhası ve telefon ile doğrulandı',
    }));
    ({ data } = await visitor.rpc('get_public_business', { p_ref: business.public_id }));
    expect(data.is_verified).toBe(true);
  });
});

describe('QR menü ve fiyat güncellemesi', () => {
  it('fiyat güncellemesi herkese açık menüye yansır, QR kimliği değişmez', async () => {
    const { business, items } = await createReadyBusiness(owner);
    await publish(owner, admin, business.id);
    const publicId = business.public_id;

    const before = await visitor.rpc('get_public_business', { p_ref: publicId });
    const menuUpdatedBefore = before.data.menu_updated_at;

    await must(owner.client.from('menu_items').update({ price_cents: 11000 }).eq('id', items[0].id));
    await must(owner.client.from('businesses').update({ name: 'Yeni Adlı Kafe' }).eq('id', business.id));

    const after = await visitor.rpc('get_public_business', { p_ref: publicId });
    expect(after.data.public_id).toBe(publicId);
    expect(after.data.name).toBe('Yeni Adlı Kafe');
    expect(after.data.categories[0].items[0].price_cents).toBe(11000);
    expect(new Date(after.data.menu_updated_at).getTime()).toBeGreaterThan(new Date(menuUpdatedBefore).getTime());

    // "Fiyatları kontrol ettim" ayrı kaydedilir
    expect(after.data.prices_checked_at).toBeNull();
    await must(owner.client.rpc('mark_prices_checked', { p_business_id: business.id }));
    const checked = await visitor.rpc('get_public_business', { p_ref: publicId });
    expect(checked.data.prices_checked_at).not.toBeNull();
    expect(checked.data.menu_updated_at).toBe(after.data.menu_updated_at);

    // Sahip menu_updated_at / prices_checked_at değerlerini elle değiştiremez
    await must(owner.client.from('businesses')
      .update({ menu_updated_at: '2000-01-01T00:00:00Z', prices_checked_at: '2000-01-01T00:00:00Z' })
      .eq('id', business.id));
    const { rows } = await db.query('select menu_updated_at, prices_checked_at from public.businesses where id = $1', [business.id]);
    expect(rows[0].menu_updated_at.getUTCFullYear()).not.toBe(2000);
    expect(rows[0].prices_checked_at.getUTCFullYear()).not.toBe(2000);
  });

  it('gizli ürün ve kategoriler herkese açık menüde görünmez', async () => {
    const { business, category, items } = await createReadyBusiness(owner, {
      items: [{ name: 'Görünür', price_cents: 100 }, { name: 'Gizli', price_cents: 200, is_hidden: true }],
    });
    await publish(owner, admin, business.id);
    const { data: cat2 } = await must(owner.client.from('menu_categories')
      .insert({ business_id: business.id, name: 'Gizli Kategori', is_visible: false }).select().single());
    await must(owner.client.from('menu_items').insert({ business_id: business.id, category_id: cat2.id, name: 'KategoriGizli', price_cents: 1 }));

    const { data } = await visitor.rpc('get_public_business', { p_ref: business.public_id });
    const names = data.categories.flatMap((c) => c.items.map((i) => i.name));
    expect(names).toEqual(['Görünür']);
    const direct = await visitor.from('menu_items').select('name').eq('business_id', business.id);
    expect(direct.data.map((r) => r.name)).toEqual(['Görünür']);
    expect(items).toHaveLength(2);
    expect(category.id).toBeTruthy();
  });
});
