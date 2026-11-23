// Hesap silme politikası (Edge Function: delete-account)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, createReadyBusiness, createUser, db, makeAdmin, must, publish } from './helpers.js';

let admin;
beforeAll(async () => {
  admin = await createUser('admin');
  await makeAdmin(admin.id);
});
afterAll(async () => {
  await db.end();
});

const invokeDelete = (client) => client.functions.invoke('delete-account', { method: 'POST' });

describe('hesap silme', () => {
  it('oturumsuz istek reddedilir', async () => {
    const { error } = await invokeDelete(anon());
    expect(error).not.toBeNull();
    expect(error.context.status).toBe(401);
  });

  it('işletmesi olmayan kullanıcı silinir; favoriler silinir, bildirimler anonimleşir', async () => {
    const owner = await createUser('owner');
    const { business } = await createReadyBusiness(owner);
    await publish(owner, admin, business.id);
    const user = await createUser('user');
    await must(user.client.from('favorites').insert({ business_id: business.id }));
    const { data: rep } = await must(user.client.from('reports').insert({ business_id: business.id, reason: 'other' }).select().single());

    const { data, error } = await invokeDelete(user.client);
    expect(error).toBeNull();
    expect(data).toEqual({ deleted: true });

    const { rows: u } = await db.query('select 1 from auth.users where id = $1', [user.id]);
    expect(u).toHaveLength(0);
    const { rows: fav } = await db.query('select 1 from public.favorites where user_id = $1', [user.id]);
    expect(fav).toHaveLength(0);
    const { rows: r } = await db.query('select reporter_id from public.reports where id = $1', [rep.id]);
    expect(r[0].reporter_id).toBeNull();

    const relogin = await anon().auth.signInWithPassword({ email: user.email, password: user.password });
    expect(relogin.error).not.toBeNull();
  });

  it('tek sahibi olunan işletme varsa silme engellenir; işletme silinince hesap silinebilir', async () => {
    const owner = await createUser('owner');
    const { business } = await createReadyBusiness(owner);
    const { error } = await invokeDelete(owner.client);
    expect(error.context.status).toBe(409);
    const body = await error.context.json();
    expect(body.code).toBe('sole_owner');
    expect(body.businesses.map((b) => b.business_id)).toEqual([business.id]);
    const { rows } = await db.query('select 1 from auth.users where id = $1', [owner.id]);
    expect(rows).toHaveLength(1);

    await must(owner.client.from('businesses').delete().eq('id', business.id));
    const ok = await invokeDelete(owner.client);
    expect(ok.error).toBeNull();
    expect(ok.data.deleted).toBe(true);
  });
});
