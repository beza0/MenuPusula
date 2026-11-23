-- =============================================================================
--  ÖRNEK VERİ — YALNIZCA YEREL GELİŞTİRME İÇİN
--  Bu dosyadaki işletmeler, menüler, fiyatlar ve kullanıcılar KURGUSALDIR.
--  Üretim veritabanına KESİNLİKLE uygulamayın. (supabase db reset / scripts/migrate.sh --seed)
--
--  Örnek hesaplar (şifre: OrnekSifre123!):
--    ornek-sahip@menuatlasi.local   → örnek işletmelerin sahibi
--    ornek-yonetici@menuatlasi.local → yönetici (admin_users)
--    ornek-kullanici@menuatlasi.local → normal kullanıcı
-- =============================================================================

do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_admin uuid := '22222222-2222-4222-8222-222222222222';
  v_user  uuid := '33333333-3333-4333-8333-333333333333';
  r record;
begin
  for r in select * from (values
    (v_owner, 'ornek-sahip@menuatlasi.local', 'Örnek Sahip'),
    (v_admin, 'ornek-yonetici@menuatlasi.local', 'Örnek Yönetici'),
    (v_user,  'ornek-kullanici@menuatlasi.local', 'Örnek Kullanıcı')
  ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
      extensions.crypt('OrnekSifre123!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', r.name), now(), now(),
      '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), r.id, r.id::text, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
  insert into public.admin_users (user_id, note) values (v_admin, 'ÖRNEK yerel yönetici') on conflict do nothing;
end $$;

-- Örnek işletmeler (postgres rolüyle eklendiği için doğrudan "published" olabilir)
insert into public.businesses (id, public_id, name, type, description, phone, address_line, district, city,
  latitude, longitude, status, published_at, submitted_at, reviewed_at, prices_checked_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'ornekmoda1', 'Örnek Moda Kahvecisi', 'cafe',
   'ÖRNEK VERİ: Kurgusal üçüncü dalga kahveci.', '+90 216 000 00 01', 'Örnek Sok. No:1', 'Kadıköy', 'İstanbul',
   40.98720, 29.02610, 'published', now(), now(), now(), now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000002', 'ornekkebap', 'Örnek Ocakbaşı', 'restaurant',
   'ÖRNEK VERİ: Kurgusal kebap restoranı.', '+90 216 000 00 02', 'Örnek Cad. No:2', 'Kadıköy', 'İstanbul',
   40.99050, 29.02900, 'published', now(), now(), now(), null),
  ('a0000000-0000-4000-8000-000000000003', 'ornekbesik', 'Örnek Beşiktaş Kafe', 'cafe',
   'ÖRNEK VERİ: Gece geç saate kadar açık kurgusal kafe.', '+90 212 000 00 03', 'Örnek Meydan No:3', 'Beşiktaş', 'İstanbul',
   41.04290, 29.00750, 'published', now(), now(), now(), null),
  ('a0000000-0000-4000-8000-000000000004', 'ornekankar', 'Örnek Kızılay Lokantası', 'restaurant',
   'ÖRNEK VERİ: Kurgusal esnaf lokantası.', '+90 312 000 00 04', 'Örnek Bulvar No:4', 'Çankaya', 'Ankara',
   39.92080, 32.85410, 'published', now(), now(), now(), null),
  ('a0000000-0000-4000-8000-000000000005', 'ornektasla', 'Örnek Taslak Kafe (yayında değil)', 'cafe',
   'ÖRNEK VERİ: Taslak durumda; herkese açık aramalarda görünmemeli.', '+90 216 000 00 05', 'Örnek Sok. No:5', 'Kadıköy', 'İstanbul',
   40.98900, 29.02700, 'draft', null, null, null, null)
on conflict (id) do nothing;

insert into public.business_members (business_id, user_id, role)
select id, '11111111-1111-4111-8111-111111111111', 'owner' from public.businesses
where id::text like 'a0000000-0000-4000-8000-00000000000%'
on conflict do nothing;

insert into public.business_cuisines (business_id, cuisine_id) values
  ('a0000000-0000-4000-8000-000000000001', 'coffee'), ('a0000000-0000-4000-8000-000000000001', 'dessert'),
  ('a0000000-0000-4000-8000-000000000002', 'kebab'), ('a0000000-0000-4000-8000-000000000002', 'turkish'),
  ('a0000000-0000-4000-8000-000000000003', 'coffee'), ('a0000000-0000-4000-8000-000000000003', 'breakfast'),
  ('a0000000-0000-4000-8000-000000000004', 'home_cooking'), ('a0000000-0000-4000-8000-000000000005', 'coffee')
on conflict do nothing;

-- Çalışma saatleri (Beşiktaş kafe gece yarısını geçer)
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b, d, o::time, c::time from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, '08:00', '22:00'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, '12:00', '23:30'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, '10:00', '02:00'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, '07:00', '16:00'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, '09:00', '18:00')
) h(b, o, c), generate_series(1, 7) d
on conflict do nothing;

-- Menüler
do $$
declare
  v_cat uuid;
  v_item uuid;
begin
  -- Moda Kahvecisi
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000001', 'Kahveler', 0) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, description, price_cents, sort_order)
    values ('a0000000-0000-4000-8000-000000000001', v_cat, 'Latte', 'ÖRNEK: Espresso ve buharla ısıtılmış süt', 9000, 0) returning id into v_item;
  insert into public.menu_item_variants (item_id, business_id, name, price_cents, sort_order) values
    (v_item, 'a0000000-0000-4000-8000-000000000001', 'Küçük', 9000, 0),
    (v_item, 'a0000000-0000-4000-8000-000000000001', 'Büyük', 11500, 1);
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000001', v_cat, 'Filtre Kahve', 7000, 1),
    ('a0000000-0000-4000-8000-000000000001', v_cat, 'Türk Kahvesi', 6000, 2);
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000001', 'Tatlılar', 1) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order, is_available, dietary_info_confirmed)
    values ('a0000000-0000-4000-8000-000000000001', v_cat, 'San Sebastian Cheesecake', 14500, 0, true, true) returning id into v_item;
  insert into public.menu_item_tags (item_id, tag) values (v_item, 'vegetarian'), (v_item, 'contains_milk'), (v_item, 'contains_egg');
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order, is_available)
    values ('a0000000-0000-4000-8000-000000000001', v_cat, 'Brownie', 9500, 1, false);

  -- Ocakbaşı
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000002', 'Ana Yemekler', 0) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, description, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000002', v_cat, 'Adana Kebap', 'ÖRNEK: Közlenmiş biber ve domates ile', 42000, 0),
    ('a0000000-0000-4000-8000-000000000002', v_cat, 'Lahmacun', null, 12000, 1);
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000002', 'İçecekler', 1) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000002', v_cat, 'Ayran', 4000, 0);

  -- Beşiktaş Kafe
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000003', 'Kahveler', 0) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000003', v_cat, 'Latte', 10500, 0),
    ('a0000000-0000-4000-8000-000000000003', v_cat, 'Buzlu Latte', 12000, 1),
    ('a0000000-0000-4000-8000-000000000003', v_cat, 'Americano', 8500, 2);
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000003', 'Kahvaltı', 1) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000003', v_cat, 'Serpme Kahvaltı (2 kişilik)', 65000, 0);

  -- Kızılay Lokantası
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000004', 'Günün Yemekleri', 0) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000004', v_cat, 'Kuru Fasulye', 15000, 0),
    ('a0000000-0000-4000-8000-000000000004', v_cat, 'Pilav', 7000, 1),
    ('a0000000-0000-4000-8000-000000000004', v_cat, 'Mercimek Çorbası', 8000, 2);

  -- Taslak kafe
  insert into public.menu_categories (business_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000005', 'Kahveler', 0) returning id into v_cat;
  insert into public.menu_items (business_id, category_id, name, price_cents, sort_order) values
    ('a0000000-0000-4000-8000-000000000005', v_cat, 'Latte', 5000, 0);
end $$;
