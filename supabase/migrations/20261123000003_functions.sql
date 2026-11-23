-- Menü Atlası — iş kuralları ve herkese açık sorgu fonksiyonları

-- ---------------------------------------------------------------------------
-- Çalışma saatleri (gece yarısını geçen aralıklar dahil)
-- ---------------------------------------------------------------------------

-- Belirli bir yerel tarih için geçerli aralıklar: o güne istisna varsa istisna,
-- yoksa haftalık düzen.
create or replace function public.business_day_intervals(p_business_id uuid, p_date date)
returns table (opens_at time, closes_at time)
language sql
stable
set search_path = ''
as $$
  with ex as (
    select e.is_closed, e.opens_at, e.closes_at
    from public.business_hour_exceptions e
    where e.business_id = p_business_id and e.date = p_date
  )
  select ex.opens_at, ex.closes_at from ex where not ex.is_closed
  union all
  select h.opens_at, h.closes_at
  from public.business_hours h
  where h.business_id = p_business_id
    and h.weekday = extract(isodow from p_date)::int
    and not exists (select 1 from ex)
$$;

create or replace function public.business_is_open_at(p_business_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text;
  v_local timestamp;
  v_date date;
  v_time time;
begin
  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  if v_tz is null then
    return null;
  end if;
  v_local := p_at at time zone v_tz;
  v_date := v_local::date;
  v_time := v_local::time;

  -- Bugün başlayan aralıklar
  if exists (
    select 1 from public.business_day_intervals(p_business_id, v_date) i
    where (i.opens_at < i.closes_at and v_time >= i.opens_at and v_time < i.closes_at)
       or (i.closes_at <= i.opens_at and v_time >= i.opens_at)
  ) then
    return true;
  end if;

  -- Dün başlayıp gece yarısını geçen aralıklar
  return exists (
    select 1 from public.business_day_intervals(p_business_id, v_date - 1) i
    where i.closes_at <= i.opens_at and v_time < i.closes_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- İşletme keşfi
-- ---------------------------------------------------------------------------
create or replace function public.search_businesses(
  p_min_lng double precision default null,
  p_min_lat double precision default null,
  p_max_lng double precision default null,
  p_max_lat double precision default null,
  p_query text default null,
  p_types public.business_type[] default null,
  p_cuisines text[] default null,
  p_open_now boolean default false,
  p_user_lng double precision default null,
  p_user_lat double precision default null,
  p_max_distance_m double precision default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  public_id text,
  name text,
  type public.business_type,
  description text,
  address_line text,
  district text,
  city text,
  latitude double precision,
  longitude double precision,
  logo_path text,
  cover_path text,
  is_verified boolean,
  cuisines text[],
  is_open_now boolean,
  distance_m double precision,
  menu_updated_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user extensions.geography;
  v_box extensions.geography;
  v_q text := nullif(public.tr_normalize(trim(coalesce(p_query, ''))), '');
begin
  if p_user_lng is not null and p_user_lat is not null then
    v_user := extensions.st_setsrid(extensions.st_makepoint(p_user_lng, p_user_lat), 4326)::extensions.geography;
  end if;
  if p_min_lng is not null and p_min_lat is not null and p_max_lng is not null and p_max_lat is not null then
    v_box := extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography;
  end if;
  if p_max_distance_m is not null and v_user is null then
    raise exception 'Mesafe filtresi için konum gerekir' using errcode = '22023';
  end if;
  if v_q is not null then
    v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  return query
  with base as (
    select b.*,
      case when v_user is not null then extensions.st_distance(b.location, v_user) end as dist
    from public.businesses b
    where b.status = 'published'
      and b.location is not null
      and (v_box is null or b.location operator(extensions.&&) v_box)
      and (p_types is null or cardinality(p_types) = 0 or b.type = any (p_types))
      and (p_cuisines is null or cardinality(p_cuisines) = 0 or exists (
        select 1 from public.business_cuisines bc where bc.business_id = b.id and bc.cuisine_id = any (p_cuisines)))
      and (p_max_distance_m is null or extensions.st_dwithin(b.location, v_user, p_max_distance_m))
      and (v_q is null
        or public.tr_normalize(b.name) like '%' || v_q || '%'
        or public.tr_normalize(b.district) like '%' || v_q || '%'
        or public.tr_normalize(b.city) like '%' || v_q || '%')
  )
  select base.id, base.public_id, base.name, base.type, base.description, base.address_line,
    base.district, base.city, base.latitude, base.longitude, base.logo_path, base.cover_path,
    base.is_verified,
    coalesce((select array_agg(bc.cuisine_id order by bc.cuisine_id) from public.business_cuisines bc where bc.business_id = base.id), '{}'),
    public.business_is_open_at(base.id, now()),
    base.dist,
    base.menu_updated_at
  from base
  where (not coalesce(p_open_now, false) or public.business_is_open_at(base.id, now()))
  order by base.dist asc nulls last, base.name asc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Ürün araması: yalnızca yayınlanmış işletmelerin görünür ürünleri.
create or replace function public.search_menu_items(
  p_query text,
  p_min_lng double precision default null,
  p_min_lat double precision default null,
  p_max_lng double precision default null,
  p_max_lat double precision default null,
  p_user_lng double precision default null,
  p_user_lat double precision default null,
  p_max_price_cents int default null,
  p_sort text default 'price',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  item_id uuid,
  item_name text,
  item_description text,
  price_cents int,
  currency char(3),
  has_variants boolean,
  is_available boolean,
  image_path text,
  business_id uuid,
  business_public_id text,
  business_name text,
  business_type public.business_type,
  district text,
  city text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user extensions.geography;
  v_box extensions.geography;
  v_q text := public.tr_normalize(trim(coalesce(p_query, '')));
begin
  if char_length(v_q) < 2 then
    raise exception 'Arama için en az 2 karakter girin' using errcode = '22023';
  end if;
  if p_sort not in ('price', 'distance') then
    raise exception 'Geçersiz sıralama' using errcode = '22023';
  end if;
  if p_max_price_cents is not null and p_max_price_cents < 0 then
    raise exception 'Bütçe negatif olamaz' using errcode = '22023';
  end if;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  if p_user_lng is not null and p_user_lat is not null then
    v_user := extensions.st_setsrid(extensions.st_makepoint(p_user_lng, p_user_lat), 4326)::extensions.geography;
  end if;
  if p_min_lng is not null and p_min_lat is not null and p_max_lng is not null and p_max_lat is not null then
    v_box := extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography;
  end if;

  return query
  select i.id, i.name, i.description, i.price_cents, i.currency, i.has_variants, i.is_available, i.image_path,
    b.id, b.public_id, b.name, b.type, b.district, b.city, b.latitude, b.longitude,
    case when v_user is not null then extensions.st_distance(b.location, v_user) end as dist
  from public.menu_items i
  join public.menu_categories c on c.id = i.category_id
  join public.businesses b on b.id = i.business_id
  where b.status = 'published'
    and c.is_visible
    and not i.is_hidden
    and b.location is not null
    and (v_box is null or b.location operator(extensions.&&) v_box)
    and (p_max_price_cents is null or i.price_cents <= p_max_price_cents)
    and public.tr_normalize(i.name) like '%' || v_q || '%'
  order by
    case when p_sort = 'price' then i.price_cents end asc nulls last,
    case when p_sort = 'distance' then
      case when v_user is not null then extensions.st_distance(b.location, v_user) end
    end asc nulls last,
    i.price_cents asc,
    b.name asc,
    i.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Konum izni olmadan bölge seçimi: yayınlanmış işletmelerden türetilen şehir/ilçeler.
create or replace function public.list_regions()
returns table (
  city text,
  district text,
  business_count bigint,
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
language sql
stable
set search_path = ''
as $$
  select b.city, b.district, count(*),
    min(b.longitude), min(b.latitude), max(b.longitude), max(b.latitude)
  from public.businesses b
  where b.status = 'published' and b.location is not null and b.city is not null
  group by b.city, b.district
  order by b.city, b.district nulls first
  limit 500
$$;

-- Tek çağrıda herkese açık işletme + menü (mobil, QR web menüsü ve önizleme ortak kullanır).
-- SECURITY INVOKER: RLS geçerlidir; anonim kullanıcı yalnızca yayınlanmış işletmeyi görür.
-- Gizli ürün/kategoriler üyelere de önizlemede gösterilmez (yayındaki görünüm).
create or replace function public.get_public_business(p_ref text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'public_id', b.public_id,
    'name', b.name,
    'type', b.type,
    'description', b.description,
    'phone', b.phone,
    'website_url', b.website_url,
    'instagram_url', b.instagram_url,
    'facebook_url', b.facebook_url,
    'address_line', b.address_line,
    'district', b.district,
    'city', b.city,
    'latitude', b.latitude,
    'longitude', b.longitude,
    'timezone', b.timezone,
    'currency', b.currency,
    'logo_path', b.logo_path,
    'cover_path', b.cover_path,
    'menu_pdf_path', b.menu_pdf_path,
    'status', b.status,
    'is_verified', b.is_verified,
    'menu_updated_at', b.menu_updated_at,
    'prices_checked_at', b.prices_checked_at,
    'is_open_now', public.business_is_open_at(b.id, now()),
    'cuisines', coalesce((
      select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name_tr) order by ct.sort_order)
      from public.business_cuisines bc join public.cuisine_types ct on ct.id = bc.cuisine_id
      where bc.business_id = b.id), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens_at', to_char(h.opens_at, 'HH24:MI'),
        'closes_at', to_char(h.closes_at, 'HH24:MI')) order by h.weekday, h.opens_at)
      from public.business_hours h where h.business_id = b.id), '[]'::jsonb),
    'hour_exceptions', coalesce((
      select jsonb_agg(jsonb_build_object('date', e.date, 'is_closed', e.is_closed,
        'opens_at', to_char(e.opens_at, 'HH24:MI'), 'closes_at', to_char(e.closes_at, 'HH24:MI'), 'note', e.note)
        order by e.date)
      from public.business_hour_exceptions e
      where e.business_id = b.id and e.date between current_date - 1 and current_date + 30), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'description', c.description,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'name', i.name, 'description', i.description,
            'price_cents', i.price_cents, 'currency', i.currency, 'has_variants', i.has_variants,
            'is_available', i.is_available, 'image_path', i.image_path,
            'variants', coalesce((
              select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price_cents', v.price_cents)
                order by v.sort_order, v.price_cents)
              from public.menu_item_variants v where v.item_id = i.id), '[]'::jsonb),
            'tags', case when i.dietary_info_confirmed then coalesce((
              select jsonb_agg(t.tag order by t.tag) from public.menu_item_tags t where t.item_id = i.id), '[]'::jsonb)
              else '[]'::jsonb end
          ) order by i.sort_order, i.name)
          from public.menu_items i where i.category_id = c.id and not i.is_hidden), '[]'::jsonb)
      ) order by c.sort_order, c.name)
      from public.menu_categories c where c.business_id = b.id and c.is_visible), '[]'::jsonb)
  )
  from public.businesses b
  where b.public_id = p_ref or b.id = public.try_uuid(p_ref)
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- İşletme sahibi işlemleri
-- ---------------------------------------------------------------------------

-- İncelemeye gönderme: zorunlu alanlar sunucuda doğrulanır.
create or replace function public.submit_business_for_review(p_business_id uuid)
returns public.business_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
  v_missing text[] := '{}';
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if b.status not in ('draft', 'rejected') then
    raise exception 'Yalnızca taslak veya reddedilmiş başvurular incelemeye gönderilebilir (mevcut durum: %)', b.status
      using errcode = 'P0001';
  end if;
  if coalesce(trim(b.phone), '') = '' then v_missing := array_append(v_missing, 'telefon'); end if;
  if coalesce(trim(b.address_line), '') = '' then v_missing := array_append(v_missing, 'adres'); end if;
  if coalesce(trim(b.city), '') = '' then v_missing := array_append(v_missing, 'şehir'); end if;
  if coalesce(trim(b.district), '') = '' then v_missing := array_append(v_missing, 'ilçe'); end if;
  if b.location is null then v_missing := array_append(v_missing, 'harita konumu'); end if;
  if not exists (select 1 from public.business_hours h where h.business_id = b.id) then
    v_missing := array_append(v_missing, 'çalışma saatleri');
  end if;
  if not exists (
    select 1 from public.menu_items i join public.menu_categories c on c.id = i.category_id
    where i.business_id = b.id and c.is_visible and not i.is_hidden
  ) then
    v_missing := array_append(v_missing, 'en az bir görünür menü ürünü');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'Eksik bilgiler: %', array_to_string(v_missing, ', ') using errcode = 'P0001';
  end if;

  update public.businesses
     set status = 'pending_review', submitted_at = now(), rejection_reason = null
   where id = p_business_id;
  return 'pending_review';
end;
$$;

-- "Fiyatları kontrol ettim": içerik düzenlemesinden ayrı kaydedilir.
create or replace function public.mark_prices_checked(p_business_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  update public.businesses set prices_checked_at = v_now where id = p_business_id;
  return v_now;
end;
$$;

-- Fiyat hesaplama: yüzde veya sabit tutar (kuruş), yuvarlama adımı (kuruş).
create or replace function public.calc_new_price(
  p_old_cents int, p_mode text, p_value numeric, p_round_to int default 1
)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw numeric;
  v_result numeric;
begin
  if p_round_to is null or p_round_to not in (1, 5, 10, 25, 50, 100, 500, 1000) then
    raise exception 'Geçersiz yuvarlama adımı' using errcode = '22023';
  end if;
  if p_mode = 'percent' then
    if p_value < -90 or p_value > 500 then
      raise exception 'Yüzde değişim -90 ile 500 arasında olmalı' using errcode = '22023';
    end if;
    v_raw := p_old_cents::numeric * (100 + p_value) / 100;
  elsif p_mode = 'fixed' then
    if p_value <> trunc(p_value) then
      raise exception 'Sabit tutar kuruş cinsinden tam sayı olmalı' using errcode = '22023';
    end if;
    v_raw := p_old_cents::numeric + p_value;
  else
    raise exception 'Geçersiz güncelleme türü' using errcode = '22023';
  end if;
  -- numeric round(): yarım değerler sıfırdan uzağa yuvarlanır
  v_result := round(v_raw / p_round_to) * p_round_to;
  if v_result < 0 then
    raise exception 'Güncelleme sonucunda negatif fiyat oluşuyor' using errcode = '22023';
  end if;
  if v_result > 100000000 then
    raise exception 'Fiyat üst sınırı aşıldı' using errcode = '22023';
  end if;
  return v_result::int;
end;
$$;

-- Toplu fiyat güncelleme. p_apply = false iken yalnızca önizleme döner (yazmaz).
-- SECURITY INVOKER: RLS geçerlidir; ayrıca üyelik açıkça kontrol edilir.
create or replace function public.bulk_update_prices(
  p_business_id uuid,
  p_item_ids uuid[],
  p_mode text,
  p_value numeric,
  p_round_to int default 1,
  p_apply boolean default false
)
returns table (
  item_id uuid,
  variant_id uuid,
  item_name text,
  variant_name text,
  old_price_cents int,
  new_price_cents int
)
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    raise exception 'En az bir ürün seçin' using errcode = '22023';
  end if;
  if cardinality(p_item_ids) > 1000 then
    raise exception 'Tek seferde en fazla 1000 ürün güncellenebilir' using errcode = '22023';
  end if;

  create temporary table if not exists _bulk_preview (
    item_id uuid, variant_id uuid, item_name text, variant_name text,
    old_price_cents int, new_price_cents int
  ) on commit drop;
  truncate _bulk_preview;

  insert into _bulk_preview
  select i.id, null::uuid, i.name, null::text, i.price_cents,
         public.calc_new_price(i.price_cents, p_mode, p_value, p_round_to)
  from public.menu_items i
  where i.business_id = p_business_id and i.id = any (p_item_ids) and not i.has_variants;

  insert into _bulk_preview
  select i.id, v.id, i.name, v.name, v.price_cents,
         public.calc_new_price(v.price_cents, p_mode, p_value, p_round_to)
  from public.menu_items i
  join public.menu_item_variants v on v.item_id = i.id
  where i.business_id = p_business_id and i.id = any (p_item_ids) and i.has_variants;

  if p_apply then
    update public.menu_items mi set price_cents = p.new_price_cents
      from _bulk_preview p where p.variant_id is null and mi.id = p.item_id;
    update public.menu_item_variants mv set price_cents = p.new_price_cents
      from _bulk_preview p where p.variant_id is not null and mv.id = p.variant_id;
  end if;

  return query
    select p.item_id, p.variant_id, p.item_name, p.variant_name, p.old_price_cents, p.new_price_cents
    from _bulk_preview p order by p.item_name, p.variant_name nulls first;
end;
$$;

-- Sıralama: verilen sıradaki kimliklere 0..n sıra numarası atar.
create or replace function public.reorder_menu(p_business_id uuid, p_kind text, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  if p_kind = 'categories' then
    update public.menu_categories c set sort_order = x.ord
      from unnest(p_ids) with ordinality as x(id, ord)
      where c.id = x.id and c.business_id = p_business_id;
  elsif p_kind = 'items' then
    update public.menu_items i set sort_order = x.ord
      from unnest(p_ids) with ordinality as x(id, ord)
      where i.id = x.id and i.business_id = p_business_id;
  else
    raise exception 'Geçersiz sıralama türü' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yönetici işlemleri (backend seviyesinde korunur ve audit log'a yazılır)
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.write_audit_log(p_action text, p_target_type text, p_target_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.write_audit_log(text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_review_business(p_business_id uuid, p_approve boolean, p_reason text default null)
returns public.business_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.business_status;
  v_new public.business_status;
begin
  perform public.assert_admin();
  select status into v_status from public.businesses where id = p_business_id for update;
  if v_status is null then
    raise exception 'İşletme bulunamadı' using errcode = 'P0002';
  end if;
  if v_status <> 'pending_review' then
    raise exception 'Yalnızca incelemedeki başvurular sonuçlandırılabilir (mevcut durum: %)', v_status using errcode = 'P0001';
  end if;
  if p_approve then
    v_new := 'published';
    update public.businesses
       set status = v_new, reviewed_at = now(), rejection_reason = null,
           published_at = coalesce(published_at, now())
     where id = p_business_id;
  else
    if char_length(trim(coalesce(p_reason, ''))) < 10 then
      raise exception 'Ret gerekçesi en az 10 karakter olmalı' using errcode = '22023';
    end if;
    v_new := 'rejected';
    update public.businesses
       set status = v_new, reviewed_at = now(), rejection_reason = trim(p_reason)
     where id = p_business_id;
  end if;
  perform public.write_audit_log(case when p_approve then 'business.approve' else 'business.reject' end,
    'business', p_business_id, jsonb_build_object('from', v_status, 'to', v_new, 'reason', p_reason));
  return v_new;
end;
$$;

create or replace function public.admin_set_suspension(p_business_id uuid, p_suspend boolean, p_reason text default null)
returns public.business_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.business_status;
  v_new public.business_status;
begin
  perform public.assert_admin();
  select status into v_status from public.businesses where id = p_business_id for update;
  if v_status is null then
    raise exception 'İşletme bulunamadı' using errcode = 'P0002';
  end if;
  if p_suspend then
    if v_status = 'suspended' then
      raise exception 'İşletme zaten askıda' using errcode = 'P0001';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) < 10 then
      raise exception 'Askıya alma gerekçesi en az 10 karakter olmalı' using errcode = '22023';
    end if;
    v_new := 'suspended';
    update public.businesses set status = v_new, suspension_reason = trim(p_reason), reviewed_at = now()
     where id = p_business_id;
  else
    if v_status <> 'suspended' then
      raise exception 'İşletme askıda değil' using errcode = 'P0001';
    end if;
    -- Daha önce hiç yayınlanmamışsa incelemeye döner, yayınlanmışsa yeniden yayına alınır.
    v_new := case when (select published_at from public.businesses where id = p_business_id) is null
                  then 'pending_review'::public.business_status else 'published'::public.business_status end;
    update public.businesses set status = v_new, suspension_reason = null, reviewed_at = now()
     where id = p_business_id;
  end if;
  perform public.write_audit_log(case when p_suspend then 'business.suspend' else 'business.unsuspend' end,
    'business', p_business_id, jsonb_build_object('from', v_status, 'to', v_new, 'reason', p_reason));
  return v_new;
end;
$$;

-- "Doğrulanmış" işareti yalnızca yöneticinin gerçek doğrulama (belge/telefon vb.)
-- sonrasında verdiği ayrı bir karardır; onay ile otomatik verilmez.
create or replace function public.admin_set_verified(p_business_id uuid, p_verified boolean, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_verified and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Doğrulama yöntemini not olarak yazın (en az 5 karakter)' using errcode = '22023';
  end if;
  update public.businesses
     set is_verified = p_verified, verified_at = case when p_verified then now() end
   where id = p_business_id;
  if not found then
    raise exception 'İşletme bulunamadı' using errcode = 'P0002';
  end if;
  perform public.write_audit_log(case when p_verified then 'business.verify' else 'business.unverify' end,
    'business', p_business_id, jsonb_build_object('note', p_note));
  return p_verified;
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_status = 'open' then
    raise exception 'Bildirim yeniden açılamaz' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status, resolution_note = nullif(trim(coalesce(p_note, '')), ''),
         resolved_by = auth.uid(), resolved_at = now()
   where id = p_report_id and status = 'open';
  if not found then
    raise exception 'Açık bildirim bulunamadı' using errcode = 'P0002';
  end if;
  perform public.write_audit_log('report.' || p_status::text, 'report', p_report_id, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- Ölçüm (istatistik) — kişisel veri ve konum tutulmaz
-- ---------------------------------------------------------------------------
create or replace function public.log_event(
  p_business_id uuid,
  p_event_type public.analytics_event_type,
  p_source public.analytics_source,
  p_client_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if p_client_id is null or char_length(p_client_id) not between 16 and 64 then
    raise exception 'Geçersiz istemci kimliği' using errcode = '22023';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id and b.status = 'published') then
    return false;  -- taslak önizlemeleri ve yayında olmayanlar sayılmaz
  end if;
  -- Üyelerin kendi işletmelerini görüntülemesi sayılmaz.
  if auth.uid() is not null and public.is_business_member(p_business_id) then
    return false;
  end if;
  -- Günlük değişen tuz: aynı istemci günler arasında ilişkilendirilemez.
  v_hash := encode(extensions.digest(p_client_id || ':' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD'), 'sha256'), 'hex');
  -- Tekrarlı sayım engeli: aynı istemci/işletme/olay için 30 dakikada bir.
  if exists (
    select 1 from public.analytics_events e
    where e.client_hash = v_hash and e.business_id = p_business_id and e.event_type = p_event_type
      and e.occurred_at > now() - interval '30 minutes'
  ) then
    return false;
  end if;
  -- Kötüye kullanım sınırı: istemci başına saatte 120 olay.
  if (select count(*) from public.analytics_events e
      where e.client_hash = v_hash and e.occurred_at > now() - interval '1 hour') >= 120 then
    return false;
  end if;
  insert into public.analytics_events (business_id, event_type, source, client_hash)
  values (p_business_id, p_event_type, p_source, v_hash);
  return true;
end;
$$;

create or replace function public.get_business_stats(p_business_id uuid, p_from date, p_to date)
returns table (day date, business_views bigint, menu_views bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_business_member(p_business_id) or public.is_admin()) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'Geçersiz tarih aralığı (en fazla 1 yıl)' using errcode = '22023';
  end if;
  return query
  select d::date,
    count(e.id) filter (where e.event_type = 'business_view'),
    count(e.id) filter (where e.event_type = 'menu_view')
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.analytics_events e
    on e.business_id = p_business_id
   and (e.occurred_at at time zone 'Europe/Istanbul')::date = d::date
  group by d
  order by d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hesap silme politikası
-- ---------------------------------------------------------------------------
-- Kullanıcı başka sahibi olmayan bir işletmenin tek sahibiyse hesap silinemez;
-- önce işletmeyi silmesi (veya ileride sahipliği devretmesi) gerekir.
create or replace function public.account_deletion_blockers()
returns table (business_id uuid, business_name text, status public.business_status)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.status
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and m.role = 'owner'
    and not exists (
      select 1 from public.business_members o
      where o.business_id = m.business_id and o.role = 'owner' and o.user_id <> auth.uid()
    )
$$;

-- ---------------------------------------------------------------------------
-- Fonksiyon yetkileri
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_review_business(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_suspension(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_verified(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_resolve_report(uuid, public.report_status, text) from public, anon;
revoke execute on function public.submit_business_for_review(uuid) from public, anon;
revoke execute on function public.mark_prices_checked(uuid) from public, anon;
revoke execute on function public.bulk_update_prices(uuid, uuid[], text, numeric, int, boolean) from public, anon;
revoke execute on function public.reorder_menu(uuid, text, uuid[]) from public, anon;
revoke execute on function public.get_business_stats(uuid, date, date) from public, anon;
revoke execute on function public.account_deletion_blockers() from public, anon;
grant execute on function public.admin_review_business(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.submit_business_for_review(uuid) to authenticated;
grant execute on function public.mark_prices_checked(uuid) to authenticated;
grant execute on function public.bulk_update_prices(uuid, uuid[], text, numeric, int, boolean) to authenticated;
grant execute on function public.reorder_menu(uuid, text, uuid[]) to authenticated;
grant execute on function public.get_business_stats(uuid, date, date) to authenticated;
grant execute on function public.account_deletion_blockers() to authenticated;
