-- Apply after migration 06, before deploying inline category editing.
-- Monetary values and other posted transaction fields remain protected.
create table if not exists public.band_ledger_category_changes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.band_ledger_entries(id) on delete cascade,
  old_category text not null,
  new_category text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id)
);
create index if not exists band_ledger_category_history_idx
  on public.band_ledger_category_changes(entry_id, changed_at);
alter table public.band_ledger_category_changes enable row level security;
revoke all on public.band_ledger_category_changes from anon, authenticated;
grant select on public.band_ledger_category_changes to authenticated;
drop policy if exists "Admins read category history" on public.band_ledger_category_changes;
create policy "Admins read category history" on public.band_ledger_category_changes
for select to authenticated using (true);

drop policy if exists "Admins void band ledger" on public.band_ledger_entries;
drop policy if exists "Admins update band ledger" on public.band_ledger_entries;
create policy "Admins update band ledger" on public.band_ledger_entries
for update to authenticated using (voided_at is null)
with check (
  (voided_at is null and voided_by is null and void_reason is null)
  or (voided_at is not null and voided_by = auth.uid())
);

create or replace function public.protect_band_ledger_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Allow foreign-key cleanup when the source show is actually deleted.
  if old.show_id is not null and new.show_id is null
     and not exists (select 1 from public.shows where id = old.show_id)
     and (to_jsonb(new) - 'show_id') = (to_jsonb(old) - 'show_id') then
    return new;
  end if;
  if old.voided_at is not null then raise exception 'Voided entries cannot be changed'; end if;
  if new.category is distinct from old.category then
    if auth.uid() is null then raise exception 'Authentication required for category changes'; end if;
    if (to_jsonb(new) - 'category') is distinct from (to_jsonb(old) - 'category') then
      raise exception 'A category change cannot alter other transaction fields';
    end if;
    insert into public.band_ledger_category_changes(entry_id, old_category, new_category, changed_by)
      values (old.id, old.category, new.category, auth.uid());
    return new;
  end if;
  if (to_jsonb(new) - array['voided_at','void_reason','voided_by'])
      is distinct from (to_jsonb(old) - array['voided_at','void_reason','voided_by']) then
    raise exception 'Void the entry and post a corrected replacement';
  end if;
  return new;
end;
$$;
