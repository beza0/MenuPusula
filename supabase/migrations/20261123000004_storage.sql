-- Menü Atlası — dosya depolama
-- Kova herkese açık DEĞİLDİR: taslak işletme görselleri yanlışlıkla yayınlanmaz.
-- Okuma RLS ile yalnızca yayınlanmış işletmeler (veya üyeler/yöneticiler) için izinlidir;
-- istemciler imzalı URL (createSignedUrl) ile görüntüler.
-- Yol düzeni: {business_id}/{logo|cover|items|documents}/{dosya}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-media', 'business-media', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('menu-imports', 'menu-imports', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_business_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select public.try_uuid(split_part(p_name, '/', 1))
$$;

create or replace function public.storage_media_path_ok(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select split_part(p_name, '/', 2) in ('logo', 'cover', 'items', 'documents')
     and p_name ~ '^[0-9a-f-]{36}/[a-z]+/[A-Za-z0-9._-]{1,120}$'
     -- PDF yalnızca "documents" klasöründe (ek menü belgesi)
     and (split_part(p_name, '/', 2) = 'documents') = (lower(p_name) like '%.pdf')
$$;

create policy business_media_read on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'business-media'
    and (
      public.business_is_public(public.storage_business_id(name))
      or public.is_business_member(public.storage_business_id(name))
      or public.is_admin()
    )
  );

create policy business_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-media'
    and public.is_business_member(public.storage_business_id(name))
    and public.storage_media_path_ok(name)
  );

create policy business_media_update on storage.objects for update to authenticated
  using (bucket_id = 'business-media' and public.is_business_member(public.storage_business_id(name)))
  with check (
    bucket_id = 'business-media'
    and public.is_business_member(public.storage_business_id(name))
    and public.storage_media_path_ok(name)
  );

create policy business_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-media' and public.is_business_member(public.storage_business_id(name)));

-- AI menü aktarma için yüklenen kaynak dosyalar: yalnızca üyeler.
create policy menu_imports_rw on storage.objects for all to authenticated
  using (bucket_id = 'menu-imports' and public.is_business_member(public.storage_business_id(name)))
  with check (bucket_id = 'menu-imports' and public.is_business_member(public.storage_business_id(name)));
