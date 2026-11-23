-- Haftalık çalışma saatlerini tek işlemde (atomik) değiştirir.
-- p_hours: [{"weekday":1,"opens_at":"08:00","closes_at":"23:00"}, ...]
create or replace function public.set_business_hours(p_business_id uuid, p_hours jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Bu işletme üzerinde yetkiniz yok' using errcode = '42501';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 50 then
    raise exception 'Geçersiz çalışma saatleri' using errcode = '22023';
  end if;
  delete from public.business_hours where business_id = p_business_id;
  insert into public.business_hours (business_id, weekday, opens_at, closes_at)
  select p_business_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) h;
end;
$$;
revoke execute on function public.set_business_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_business_hours(uuid, jsonb) to authenticated;
