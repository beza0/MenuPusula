-- Menü Atlası — çekirdek şema
-- Fiyatlar kuruş cinsinden integer, konum PostGIS geography(Point,4326),
-- yayın durumları yalnızca sunucu tarafı fonksiyonlarla değiştirilebilir.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipler
-- ---------------------------------------------------------------------------
create type public.business_status as enum ('draft', 'pending_review', 'published', 'rejected', 'suspended');
create type public.business_type as enum ('restaurant', 'cafe');
create type public.member_role as enum ('owner', 'manager');
create type public.report_reason as enum ('wrong_price', 'closed_permanently', 'wrong_info', 'inappropriate', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.analytics_event_type as enum ('business_view', 'menu_view');
create type public.analytics_source as enum ('app', 'web');

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

-- Türkçe karakterleri sadeleştirerek büyük/küçük harf duyarsız arama sağlar.
create or replace function public.tr_normalize(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(p, ''), 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'iiissgguuooccaaiiuu'))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Kalıcı, tahmin edilmesi zor kısa herkese açık kimlik (QR menü URL'si için).
create or replace function public.generate_public_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
  bytes bytea := extensions.gen_random_bytes(10);
  i int;
begin
  for i in 0..9 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kullanıcılar
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Yönetici yetkisi kullanıcı tarafından düzenlenebilen metadata'dan DEĞİL,
-- istemcilerin yazamadığı bu tablodan belirlenir.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- İşletmeler
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.generate_public_id(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  type public.business_type not null,
  description text check (description is null or char_length(description) <= 1000),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  website_url text check (website_url is null or website_url ~* '^https?://'),
  instagram_url text check (instagram_url is null or instagram_url ~* '^https?://'),
  facebook_url text check (facebook_url is null or facebook_url ~* '^https?://'),
  address_line text check (address_line is null or char_length(address_line) <= 300),
  district text check (district is null or char_length(district) <= 80),
  city text check (city is null or char_length(city) <= 80),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  location extensions.geography(Point, 4326)
    generated always as (
      case when latitude is not null and longitude is not null
        then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
      end
    ) stored,
  timezone text not null default 'Europe/Istanbul',
  currency char(3) not null default 'TRY' check (currency = 'TRY'),
  logo_path text,
  cover_path text,
  menu_pdf_path text,
  status public.business_status not null default 'draft',
  is_verified boolean not null default false,
  verified_at timestamptz,
  rejection_reason text,
  suspension_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  menu_updated_at timestamptz,
  prices_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_lat_lng_pair check ((latitude is null) = (longitude is null)),
  constraint businesses_verified_consistency check (is_verified = (verified_at is not null))
);

create index businesses_location_idx on public.businesses using gist (location);
create index businesses_status_idx on public.businesses (status);
create index businesses_name_trgm_idx on public.businesses using gin (public.tr_normalize(name) extensions.gin_trgm_ops);
create index businesses_city_district_idx on public.businesses (public.tr_normalize(city), public.tr_normalize(district));

create table public.business_members (
  -- Ertelenebilir FK: sahiplik kaydı işletme satırından hemen önce (BEFORE INSERT) eklenir.
  business_id uuid not null references public.businesses (id) on delete cascade deferrable initially deferred,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- Hafta günü ISO: 1 = Pazartesi ... 7 = Pazar.
-- closes_at <= opens_at ise aralık gece yarısını geçer (ör. 18:00–02:00).
-- Tam gün için 00:00–24:00 kullanılır.
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  check (opens_at <> closes_at),
  check (opens_at < '24:00'),
  unique (business_id, weekday, opens_at)
);
create index business_hours_business_idx on public.business_hours (business_id, weekday);

create table public.business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  ),
  unique (business_id, date)
);

create table public.cuisine_types (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  name_tr text not null,
  sort_order int not null default 0
);

create table public.business_cuisines (
  business_id uuid not null references public.businesses (id) on delete cascade,
  cuisine_id text not null references public.cuisine_types (id) on delete restrict,
  primary key (business_id, cuisine_id)
);
create index business_cuisines_cuisine_idx on public.business_cuisines (cuisine_id);

-- ---------------------------------------------------------------------------
-- Menü
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_categories_business_idx on public.menu_categories (business_id, sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  -- Varyantsız üründe satış fiyatı; varyantlı üründe en düşük varyant fiyatı
  -- (tetikleyiciyle senkron tutulur, "başlangıç fiyatı").
  price_cents integer not null check (price_cents >= 0 and price_cents <= 100000000),
  currency char(3) not null default 'TRY' check (currency = 'TRY'),
  has_variants boolean not null default false,
  image_path text,
  is_available boolean not null default true,  -- false = tükendi
  is_hidden boolean not null default false,    -- geçici olarak gizli
  dietary_info_confirmed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create index menu_items_business_idx on public.menu_items (business_id);
create index menu_items_name_trgm_idx on public.menu_items using gin (public.tr_normalize(name) extensions.gin_trgm_ops);
create index menu_items_price_idx on public.menu_items (price_cents);

create table public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  price_cents integer not null check (price_cents >= 0 and price_cents <= 100000000),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, name)
);
create index menu_item_variants_item_idx on public.menu_item_variants (item_id, sort_order);

-- İşletmenin beyan ettiği ve doğruladığı beslenme / alerjen etiketleri.
create table public.menu_item_tags (
  item_id uuid not null references public.menu_items (id) on delete cascade,
  tag text not null check (tag in (
    'vegan', 'vegetarian', 'gluten_free', 'lactose_free', 'spicy', 'halal',
    'contains_gluten', 'contains_milk', 'contains_egg', 'contains_nuts', 'contains_peanuts',
    'contains_soy', 'contains_fish', 'contains_shellfish', 'contains_sesame', 'contains_celery',
    'contains_mustard', 'contains_sulphites'
  )),
  primary key (item_id, tag)
);

-- ---------------------------------------------------------------------------
-- Kullanıcı etkileşimleri
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index favorites_business_idx on public.favorites (business_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null default auth.uid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  reason public.report_reason not null,
  message text check (message is null or char_length(message) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

-- Kişisel veri ve konum içermeyen ölçüm kayıtları. client_hash günlük tuzla
-- hash'lenmiş anonim istemci kimliğidir; günler arası izleme yapılamaz.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event_type public.analytics_event_type not null,
  source public.analytics_source not null,
  client_hash text not null,
  occurred_at timestamptz not null default now()
);
create index analytics_events_business_idx on public.analytics_events (business_id, occurred_at);
create index analytics_events_dedup_idx on public.analytics_events (client_hash, occurred_at desc);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Referans veri: mutfak türleri (gerçek sınıflandırma, örnek veri değildir)
-- ---------------------------------------------------------------------------
insert into public.cuisine_types (id, name_tr, sort_order) values
  ('turkish', 'Türk Mutfağı', 10),
  ('kebab', 'Kebap & Izgara', 20),
  ('home_cooking', 'Ev Yemekleri', 30),
  ('seafood', 'Deniz Ürünleri', 40),
  ('pide_lahmacun', 'Pide & Lahmacun', 50),
  ('fast_food', 'Fast Food', 60),
  ('burger', 'Burger', 70),
  ('pizza', 'Pizza', 80),
  ('italian', 'İtalyan', 90),
  ('far_east', 'Uzak Doğu', 100),
  ('vegan', 'Vegan & Vejetaryen', 110),
  ('breakfast', 'Kahvaltı', 120),
  ('coffee', 'Kahve', 130),
  ('dessert', 'Tatlı & Pastane', 140),
  ('bakery', 'Fırın', 150),
  ('world', 'Dünya Mutfağı', 160);
