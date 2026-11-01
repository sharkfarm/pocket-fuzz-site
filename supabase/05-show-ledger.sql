-- Apply in Supabase SQL Editor before deploying the show ledger.
-- Entries supplement existing expenses, orders and member payouts; those tables
-- remain the authoritative source for automatically displayed activity.
create table if not exists public.show_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  entry_date date not null,
  category text not null check (category in (
    'ticket_receipt','merch_receipt','venue_settlement','other_income',
    'spending','processing_fee','refund','bank_deposit','account_transfer')),
  amount numeric(10,2) not null check (amount > 0),
  account text not null check (length(trim(account)) between 1 and 120),
  to_account text,
  description text not null check (length(trim(description)) between 1 and 300),
  reference text check (length(reference) <= 200),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid references auth.users(id),
  constraint ledger_transfer_accounts check (
    (category in ('bank_deposit','account_transfer')
      and to_account is not null and length(trim(to_account)) between 1 and 120
      and lower(trim(account)) <> lower(trim(to_account)))
    or (category not in ('bank_deposit','account_transfer') and to_account is null)
  ),
  constraint ledger_void_details check (
    (voided_at is null and void_reason is null and voided_by is null)
    or (voided_at is not null and void_reason is not null and length(trim(void_reason)) between 1 and 300 and voided_by is not null)
  )
);
create index if not exists show_ledger_show_date_idx
  on public.show_ledger_entries(show_id, entry_date, created_at);
alter table public.show_ledger_entries enable row level security;
revoke all on public.show_ledger_entries from anon;
grant select, insert, update on public.show_ledger_entries to authenticated;

drop policy if exists "Admins read show ledger" on public.show_ledger_entries;
create policy "Admins read show ledger" on public.show_ledger_entries for select to authenticated using (true);
drop policy if exists "Admins post show ledger" on public.show_ledger_entries;
create policy "Admins post show ledger" on public.show_ledger_entries for insert to authenticated
with check (created_by = auth.uid() and voided_at is null and void_reason is null and voided_by is null);
drop policy if exists "Admins void show ledger" on public.show_ledger_entries;
create policy "Admins void show ledger" on public.show_ledger_entries for update to authenticated
using (voided_at is null)
with check (voided_at is not null and voided_by = auth.uid());

-- Preserve original entries; corrections require voiding and posting a replacement.
create or replace function public.protect_show_ledger_entry()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.voided_at is not null then raise exception 'Voided entries cannot be changed'; end if;
  if (to_jsonb(new) - array['voided_at','void_reason','voided_by'])
     is distinct from (to_jsonb(old) - array['voided_at','void_reason','voided_by']) then
    raise exception 'Post a correction instead of editing the original ledger entry';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_show_ledger_entry on public.show_ledger_entries;
create trigger protect_show_ledger_entry before update on public.show_ledger_entries
for each row execute function public.protect_show_ledger_entry();
