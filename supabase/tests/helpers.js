// Test yardımcıları: gerçek yerel Supabase yığınına (Auth + PostgREST + Storage) bağlanır.
// Service role anahtarı YALNIZCA test kullanıcılarını oluşturmak için burada kullanılır.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: process.env.SUPABASE_ENV_FILE ?? join(here, '../../infra/local-supabase/.env') });

export const API_URL = process.env.SUPABASE_URL ?? `http://localhost:${process.env.API_PORT ?? 54321}`;
export const ANON_KEY = process.env.ANON_KEY;
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY;
export const MAILPIT_URL = `http://localhost:${process.env.MAILPIT_PORT ?? 54324}`;

if (!ANON_KEY || !SERVICE_KEY) {
  throw new Error('ANON_KEY / SERVICE_ROLE_KEY bulunamadı. Önce infra/local-supabase/scripts/up.sh çalıştırın.');
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const anon = () => createClient(API_URL, ANON_KEY, opts);
export const service = createClient(API_URL, SERVICE_KEY, opts);

export const db = new pg.Pool({
  host: '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 54322),
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: 'postgres',
  max: 3,
});

export const uniq = (p = 'u') => `${p}-${randomUUID().slice(0, 8)}`;

/** E-postası doğrulanmış bir test kullanıcısı oluşturur ve oturum açmış istemci döner. */
export async function createUser(prefix = 'user') {
  const email = `${uniq(prefix)}@test.menuatlasi.local`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = anon();
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { id: data.user.id, email, password, client };
}

export async function makeAdmin(userId) {
  await db.query('insert into public.admin_users (user_id, note) values ($1, $2) on conflict do nothing', [userId, 'test']);
}

/** Konum: Kadıköy civarı (test koordinatları). */
export const KADIKOY = { lat: 40.9903, lng: 29.0290 };

/** Yayına hazır taslak işletme oluşturur (saat, kategori, ürün dahil). */
export async function createReadyBusiness(owner, overrides = {}) {
  const c = owner.client;
  const { data: b, error } = await c
    .from('businesses')
    .insert({
      name: overrides.name ?? `Test Kafe ${uniq('b')}`,
      type: overrides.type ?? 'cafe',
      phone: '+90 216 555 00 00',
      address_line: 'Moda Cad. No:1',
      district: overrides.district ?? 'Kadıköy',
      city: overrides.city ?? 'İstanbul',
      latitude: overrides.lat ?? KADIKOY.lat,
      longitude: overrides.lng ?? KADIKOY.lng,
    })
    .select()
    .single();
  if (error) throw error;
  await must(c.from('business_hours').insert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ business_id: b.id, weekday, opens_at: '08:00', closes_at: '23:00' })),
  ));
  const { data: cat } = await must(
    c.from('menu_categories').insert({ business_id: b.id, name: 'Kahveler', sort_order: 0 }).select().single(),
  );
  const items = overrides.items ?? [{ name: 'Latte', price_cents: 9500 }];
  const { data: createdItems } = await must(
    c.from('menu_items')
      .insert(items.map((i, idx) => ({ business_id: b.id, category_id: cat.id, sort_order: idx, ...i })), { defaultToNull: false })
      .select(),
  );
  return { business: b, category: cat, items: createdItems };
}

export async function publish(owner, admin, businessId) {
  await must(owner.client.rpc('submit_business_for_review', { p_business_id: businessId }));
  await must(admin.client.rpc('admin_review_business', { p_business_id: businessId, p_approve: true }));
}

export async function must(promise) {
  const res = await promise;
  if (res.error) throw new Error(`${res.error.code ?? ''} ${res.error.message}`);
  return res;
}
