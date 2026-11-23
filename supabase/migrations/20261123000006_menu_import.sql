-- Menü Atlası — İkinci aşama: AI ile menü aktarma
-- AI çıktısı yalnızca TASLAK olarak saklanır. İşletme düzeltip onaylamadan menüye hiçbir şey eklenmez.

create type public.menu_import_status as enum ('ready', 'failed', 'applied', 'discarded');

create table public.menu_import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  status public.menu_import_status not null,
  provider text not null,
  model text,
  source_paths text[] not null,
  page_count int not null default 0,
  draft jsonb,
  error text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index menu_import_jobs_business_idx on public.menu_import_jobs (business_id, created_at desc);

alter table public.menu_import_jobs enable row level security;
create policy menu_import_jobs_select on public.menu_import_jobs for select to authenticated
  using (public.is_business_member(business_id));
-- Yazma yalnızca sunucu (Edge Function, service role) ve aşağıdaki onay fonksiyonu ile.
revoke insert, update, delete, truncate on public.menu_import_jobs from anon, authenticated;

-- İşletmenin düzelttiği taslağı menüye uygular.
-- p_items: [{"category":"Kahveler","name":"Latte","description":null,"price_cents":9500,
--            "variants":[{"name":"Büyük","price_cents":11000}]}]
-- Fiyatı olmayan satır kabul edilmez (AI fiyat uyduramaz; işletme girmelidir).
create or replace function public.apply_menu_import(p_job_id uuid, p_items jsonb, p_hidden boolean default true)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.menu_import_jobs;
  v_item jsonb;
  v_variant jsonb;
  v_cat uuid;
  v_item_id uuid;
  v_count int := 0;
  v_cat_order int;
  v_name text;
  v_price int;
begin
  select * into v_job from public.menu_import_jobs where id = p_job_id for update;
  if v_job.id is null or not public.is_business_member(v_job.business_id) then
    raise exception 'Aktarım bulunamadı' using errcode = '42501';
  end if;
  if v_job.status <> 'ready' then
    raise exception 'Bu aktarım zaten uygulanmış veya geçersiz' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 500 then
    raise exception 'Uygulanacak 1–500 ürün seçin' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := nullif(trim(v_item ->> 'name'), '');
    if v_name is null then
      raise exception 'Adı boş ürün var' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'variants') = 'array' and jsonb_array_length(v_item -> 'variants') > 0 then
      v_price := null;
    else
      v_price := (v_item ->> 'price_cents')::int;
      if v_price is null or v_price < 0 then
        raise exception '“%” için fiyat girilmemiş', v_name using errcode = '22023';
      end if;
    end if;

    select id into v_cat from public.menu_categories
      where business_id = v_job.business_id
        and public.tr_normalize(name) = public.tr_normalize(coalesce(nullif(trim(v_item ->> 'category'), ''), 'Diğer'))
      limit 1;
    if v_cat is null then
      select coalesce(max(sort_order) + 1, 0) into v_cat_order from public.menu_categories where business_id = v_job.business_id;
      insert into public.menu_categories (business_id, name, sort_order)
      values (v_job.business_id, left(coalesce(nullif(trim(v_item ->> 'category'), ''), 'Diğer'), 80), v_cat_order)
      returning id into v_cat;
    end if;

    insert into public.menu_items (business_id, category_id, name, description, price_cents, is_hidden, sort_order)
    values (v_job.business_id, v_cat, left(v_name, 120), left(nullif(trim(v_item ->> 'description'), ''), 500),
            coalesce(v_price, 0), p_hidden, 1000 + v_count)
    returning id into v_item_id;

    if v_price is null then
      for v_variant in select * from jsonb_array_elements(v_item -> 'variants') loop
        if nullif(trim(v_variant ->> 'name'), '') is null or (v_variant ->> 'price_cents') is null then
          raise exception '“%” seçeneklerinde eksik ad veya fiyat var', v_name using errcode = '22023';
        end if;
        insert into public.menu_item_variants (item_id, business_id, name, price_cents)
        values (v_item_id, v_job.business_id, left(trim(v_variant ->> 'name'), 60), (v_variant ->> 'price_cents')::int);
      end loop;
    end if;
    v_count := v_count + 1;
  end loop;

  update public.menu_import_jobs set status = 'applied', applied_at = now() where id = p_job_id;
  return v_count;
end;
$$;
revoke execute on function public.apply_menu_import(uuid, jsonb, boolean) from public, anon;
grant execute on function public.apply_menu_import(uuid, jsonb, boolean) to authenticated;
