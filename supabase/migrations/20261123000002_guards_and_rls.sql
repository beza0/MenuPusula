-- Menü Atlası — yetki yardımcıları, koruma tetikleyicileri ve RLS politikaları

-- ---------------------------------------------------------------------------
-- Yetki yardımcıları (SECURITY DEFINER: RLS döngüsünü önler, yalnızca okur)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid())
$$;

-- VOLATILE bilinçli: INSERT ... RETURNING sırasında aynı ifadede (BEFORE trigger ile)
-- eklenen sahiplik kaydının görülebilmesi için STABLE anlık görüntüsü kullanılmaz.
create or replace function public.is_business_member(p_business_id uuid, p_owner_only boolean default false)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and (not p_owner_only or m.role = 'owner')
  )
$$;

create or replace function public.business_is_public(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.status = 'published')
$$;

-- İstemci rolleri (anon / authenticated) mi çalıştırıyor? SECURITY DEFINER
-- fonksiyonların içinde current_user fonksiyon sahibidir, bu yüzden yönetim
-- fonksiyonları bu kontrolden muaf olur; doğrudan tablo yazımları olmaz.
create or replace function public.is_client_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated')
$$;

-- ---------------------------------------------------------------------------
-- İşletme koruması: durum, doğrulama ve sistem alanları istemciden değişmez.
-- ---------------------------------------------------------------------------
create or replace function public.businesses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Saat dilimi doğrulaması
  perform now() at time zone new.timezone;

  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Giriş yapmanız gerekiyor' using errcode = '42501';
    end if;
    select count(*) into v_count from public.business_members m where m.user_id = auth.uid() and m.role = 'owner';
    if v_count > 20 then  -- yeni kaydın sahipliği zaten eklendi
      raise exception 'Bir hesapla en fazla 20 işletme oluşturulabilir' using errcode = 'P0001';
    end if;
    new.public_id := public.generate_public_id();
    new.status := 'draft';
    new.is_verified := false;
    new.verified_at := null;
    new.rejection_reason := null;
    new.suspension_reason := null;
    new.submitted_at := null;
    new.reviewed_at := null;
    new.published_at := null;
    new.menu_updated_at := null;
    new.prices_checked_at := null;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status
     or new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.suspension_reason is distinct from old.suspension_reason
     or new.submitted_at is distinct from old.submitted_at
     or new.reviewed_at is distinct from old.reviewed_at
     or new.published_at is distinct from old.published_at
     or new.public_id is distinct from old.public_id then
    raise exception 'Yayın ve doğrulama durumu yalnızca inceleme süreciyle değiştirilebilir'
      using errcode = '42501';
  end if;
  -- Sistem zaman damgaları sessizce korunur.
  new.menu_updated_at := old.menu_updated_at;
  new.prices_checked_at := old.prices_checked_at;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_guard before insert or update on public.businesses
  for each row execute function public.businesses_guard();

create or replace function public.businesses_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.business_members (business_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- BEFORE INSERT: INSERT ... RETURNING için SELECT politikası sahipliği görebilsin.
create trigger businesses_add_owner before insert on public.businesses
  for each row execute function public.businesses_add_owner();

-- ---------------------------------------------------------------------------
-- Menü tutarlılığı ve "menü son güncelleme" zaman damgası
-- ---------------------------------------------------------------------------
create or replace function public.touch_menu_updated_at(p_business_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.businesses set menu_updated_at = now() where id = p_business_id;
$$;
revoke execute on function public.touch_menu_updated_at(uuid) from public, anon, authenticated;

create or replace function public.menu_touch_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  if tg_table_name = 'menu_item_tags' then
    select i.business_id into v_business from public.menu_items i
      where i.id = coalesce(new.item_id, old.item_id);
  elsif tg_op = 'DELETE' then
    v_business := old.business_id;
  else
    v_business := new.business_id;
  end if;
  if v_business is not null then
    perform public.touch_menu_updated_at(v_business);
  end if;
  return null;
end;
$$;

create trigger menu_categories_touch after insert or update or delete on public.menu_categories
  for each row execute function public.menu_touch_trigger();
create trigger menu_items_touch after insert or update or delete on public.menu_items
  for each row execute function public.menu_touch_trigger();
create trigger menu_item_variants_touch after insert or update or delete on public.menu_item_variants
  for each row execute function public.menu_touch_trigger();
create trigger menu_item_tags_touch after insert or delete on public.menu_item_tags
  for each row execute function public.menu_touch_trigger();

create trigger menu_categories_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();
create trigger menu_item_variants_updated_at before update on public.menu_item_variants
  for each row execute function public.set_updated_at();

-- Ürün: kategori aynı işletmeye ait olmalı; varyantlı üründe fiyat = en düşük varyant.
create or replace function public.menu_items_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cat_business uuid;
  v_min int;
begin
  select c.business_id into v_cat_business from public.menu_categories c where c.id = new.category_id;
  if v_cat_business is null or v_cat_business <> new.business_id then
    raise exception 'Kategori bu işletmeye ait değil' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.business_id <> old.business_id then
    raise exception 'Ürün başka işletmeye taşınamaz' using errcode = '42501';
  end if;
  select min(v.price_cents) into v_min from public.menu_item_variants v where v.item_id = new.id;
  new.has_variants := v_min is not null;
  if v_min is not null then
    new.price_cents := v_min;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger menu_items_consistency before insert or update on public.menu_items
  for each row execute function public.menu_items_consistency();

create or replace function public.menu_categories_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id <> old.business_id then
    raise exception 'Kategori başka işletmeye taşınamaz' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger menu_categories_consistency before update on public.menu_categories
  for each row execute function public.menu_categories_consistency();

create or replace function public.menu_variants_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select i.business_id into new.business_id from public.menu_items i where i.id = new.item_id;
  if new.business_id is null then
    raise exception 'Ürün bulunamadı' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger menu_variants_consistency before insert or update on public.menu_item_variants
  for each row execute function public.menu_variants_consistency();

-- Varyant değişince ürünün başlangıç fiyatı / has_variants alanını yeniden hesapla.
create or replace function public.menu_variants_sync_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
  v_min int;
begin
  select min(v.price_cents) into v_min from public.menu_item_variants v where v.item_id = v_item;
  update public.menu_items i
     set has_variants = (v_min is not null),
         price_cents = coalesce(v_min, i.price_cents)
   where i.id = v_item;
  if tg_op = 'UPDATE' and old.item_id <> new.item_id then
    select min(v.price_cents) into v_min from public.menu_item_variants v where v.item_id = old.item_id;
    update public.menu_items i
       set has_variants = (v_min is not null), price_cents = coalesce(v_min, i.price_cents)
     where i.id = old.item_id;
  end if;
  return null;
end;
$$;

create trigger menu_variants_sync_item after insert or update or delete on public.menu_item_variants
  for each row execute function public.menu_variants_sync_item();

-- ---------------------------------------------------------------------------
-- Bildirim (report) kötüye kullanım sınırı
-- ---------------------------------------------------------------------------
create or replace function public.reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.reporter_id := auth.uid();
    new.status := 'open';
    new.resolution_note := null;
    new.resolved_by := null;
    new.resolved_at := null;
    new.created_at := now();
    select count(*) into v_count from public.reports r
      where r.reporter_id = auth.uid() and r.created_at > now() - interval '24 hours';
    if v_count >= 10 then
      raise exception 'Günlük bildirim sınırına ulaştınız. Lütfen daha sonra tekrar deneyin.' using errcode = 'P0001';
    end if;
    if new.menu_item_id is not null and not exists (
      select 1 from public.menu_items i where i.id = new.menu_item_id and i.business_id = new.business_id
    ) then
      raise exception 'Ürün bu işletmeye ait değil' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_guard before insert on public.reports
  for each row execute function public.reports_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_hour_exceptions enable row level security;
alter table public.cuisine_types enable row level security;
alter table public.business_cuisines enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.menu_item_tags enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;
alter table public.analytics_events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- admin_users: kullanıcı yalnızca kendi kaydını görebilir; hiçbir istemci yazamaz.
create policy admin_users_select_self on public.admin_users for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.admin_users from anon, authenticated;

-- businesses
create policy businesses_select on public.businesses for select to anon, authenticated
  using (status = 'published' or public.is_business_member(id) or public.is_admin());
create policy businesses_insert on public.businesses for insert to authenticated
  with check (auth.uid() is not null);
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_business_member(id)) with check (public.is_business_member(id));
create policy businesses_delete on public.businesses for delete to authenticated
  using (public.is_business_member(id, true));

-- business_members: üyelikler sunucu tarafında yönetilir (istemci yazamaz).
create policy business_members_select on public.business_members for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id) or public.is_admin());
revoke insert, update, delete, truncate on public.business_members from anon, authenticated;

-- Çalışma saatleri, istisnalar, mutfaklar: yayınlanmışsa herkese açık; yazma yalnızca üyeler.
create policy business_hours_select on public.business_hours for select to anon, authenticated
  using (public.business_is_public(business_id) or public.is_business_member(business_id) or public.is_admin());
create policy business_hours_write on public.business_hours for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy business_hour_exceptions_select on public.business_hour_exceptions for select to anon, authenticated
  using (public.business_is_public(business_id) or public.is_business_member(business_id) or public.is_admin());
create policy business_hour_exceptions_write on public.business_hour_exceptions for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy cuisine_types_select on public.cuisine_types for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.cuisine_types from anon, authenticated;

create policy business_cuisines_select on public.business_cuisines for select to anon, authenticated
  using (public.business_is_public(business_id) or public.is_business_member(business_id) or public.is_admin());
create policy business_cuisines_write on public.business_cuisines for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- Menü: herkese açık okuma yalnızca yayınlanmış işletmenin görünür içeriği.
create policy menu_categories_select on public.menu_categories for select to anon, authenticated
  using (
    (is_visible and public.business_is_public(business_id))
    or public.is_business_member(business_id) or public.is_admin()
  );
create policy menu_categories_write on public.menu_categories for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy menu_items_select on public.menu_items for select to anon, authenticated
  using (
    (not is_hidden and public.business_is_public(business_id)
      and exists (select 1 from public.menu_categories c where c.id = category_id and c.is_visible))
    or public.is_business_member(business_id) or public.is_admin()
  );
create policy menu_items_write on public.menu_items for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy menu_item_variants_select on public.menu_item_variants for select to anon, authenticated
  using (exists (select 1 from public.menu_items i where i.id = item_id));
create policy menu_item_variants_write on public.menu_item_variants for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy menu_item_tags_select on public.menu_item_tags for select to anon, authenticated
  using (exists (select 1 from public.menu_items i where i.id = item_id));
create policy menu_item_tags_write on public.menu_item_tags for all to authenticated
  using (exists (select 1 from public.menu_items i where i.id = item_id and public.is_business_member(i.business_id)))
  with check (exists (select 1 from public.menu_items i where i.id = item_id and public.is_business_member(i.business_id)));

-- favorites
create policy favorites_select_own on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy favorites_insert_own on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.business_is_public(business_id));
create policy favorites_delete_own on public.favorites for delete to authenticated
  using (user_id = auth.uid());

-- reports: kullanıcı oluşturur ve kendi bildirimini görür; yönetici hepsini görür.
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.business_is_public(business_id));
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
revoke update, delete, truncate on public.reports from anon, authenticated;

-- analytics_events ve admin_audit_logs: yalnızca SECURITY DEFINER fonksiyonlarla yazılır.
create policy admin_audit_logs_select on public.admin_audit_logs for select to authenticated
  using (public.is_admin());
revoke all on public.analytics_events from anon, authenticated;
revoke insert, update, delete, truncate on public.admin_audit_logs from anon, authenticated;
