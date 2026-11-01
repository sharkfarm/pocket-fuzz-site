-- Standalone band-wide register. Does not require migration 05.
-- Legacy manual receipts/payments are copied once below; no inferred show activity is copied.
create table if not exists public.band_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  entry_date date not null,
  payee text not null check (length(trim(payee)) between 1 and 300),
  category text not null check (category in (
    'opening_balance','ticket_sales','merch_sales','venue_payout','expense',
    'member_payout','deposit','venmo','processing_fee','refund','transfer','other')),
  show_id uuid references public.shows(id) on delete set null,
  show_label text,
  memo text check (length(memo) <= 2000),
  payment numeric(10,2) not null default 0 check (payment >= 0),
  deposit numeric(10,2) not null default 0 check (deposit >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid references auth.users(id),
  constraint band_ledger_one_amount check (
    (payment > 0 and deposit = 0) or (deposit > 0 and payment = 0)),
  constraint band_ledger_void_details check (
    (voided_at is null and void_reason is null and voided_by is null)
    or (voided_at is not null and void_reason is not null
      and length(trim(void_reason)) between 1 and 300 and voided_by is not null))
);
create index if not exists band_ledger_date_idx on public.band_ledger_entries(entry_date, sequence);
create index if not exists band_ledger_show_idx on public.band_ledger_entries(show_id);
alter table public.band_ledger_entries enable row level security;
revoke all on public.band_ledger_entries from anon;
grant select, insert, update on public.band_ledger_entries to authenticated;
grant usage, select on sequence public.band_ledger_entries_sequence_seq to authenticated;

drop policy if exists "Admins read band ledger" on public.band_ledger_entries;
create policy "Admins read band ledger" on public.band_ledger_entries
for select to authenticated using (true);
drop policy if exists "Admins post band ledger" on public.band_ledger_entries;
create policy "Admins post band ledger" on public.band_ledger_entries
for insert to authenticated with check (
  created_by = auth.uid() and voided_at is null and void_reason is null and voided_by is null);
drop policy if exists "Admins void band ledger" on public.band_ledger_entries;
create policy "Admins void band ledger" on public.band_ledger_entries
for update to authenticated using (voided_at is null)
with check (voided_at is not null and voided_by = auth.uid());

create or replace function public.protect_band_ledger_entry()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Permit FK cleanup if a linked show is deleted, retaining its label snapshot.
  if old.show_id is not null and new.show_id is null
     and (to_jsonb(new) - 'show_id') = (to_jsonb(old) - 'show_id') then
    return new;
  end if;
  if old.voided_at is not null then raise exception 'Voided entries cannot be changed'; end if;
  if (to_jsonb(new) - array['voided_at','void_reason','voided_by'])
      is distinct from (to_jsonb(old) - array['voided_at','void_reason','voided_by']) then
    raise exception 'Void the entry and post a corrected replacement';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_band_ledger_entry on public.band_ledger_entries;
create trigger protect_band_ledger_entry before update on public.band_ledger_entries
for each row execute function public.protect_band_ledger_entry();


-- Optional upgrade from migration 05. Copy only explicitly posted cash movements,
-- not automatically derived orders, expenses, payouts or internal transfers.
-- Original IDs prevent duplicates when this migration is rerun.
do $$
begin
  if to_regclass('public.show_ledger_entries') is not null then
    execute $copy$
      insert into public.band_ledger_entries (
        id, entry_date, payee, category, show_id, show_label, memo,
        payment, deposit, created_at, created_by, voided_at, void_reason, voided_by
      )
      select e.id, e.entry_date, e.description,
        case e.category
          when 'ticket_receipt' then 'ticket_sales'
          when 'merch_receipt' then 'merch_sales'
          when 'venue_settlement' then 'venue_payout'
          when 'spending' then 'expense'
          when 'processing_fee' then 'processing_fee'
          when 'refund' then 'refund'
          else 'other'
        end,
        e.show_id,
        s.show_date::text || ' · ' || coalesce(s.show_name, 'Pocket Fuzz show'),
        left(concat_ws(E'\n', e.notes, 'Account: ' || e.account,
          case when e.reference is not null then 'Reference: ' || e.reference end,
          'Imported from previous show ledger'), 2000),
        case when e.category in ('spending','processing_fee','refund') then e.amount else 0 end,
        case when e.category in ('ticket_receipt','merch_receipt','venue_settlement','other_income') then e.amount else 0 end,
        e.created_at, e.created_by, e.voided_at, e.void_reason, e.voided_by
      from public.show_ledger_entries e
      left join public.shows s on s.id = e.show_id
      where e.category not in ('bank_deposit','account_transfer')
      order by e.entry_date, e.created_at, e.id
      on conflict (id) do nothing
    $copy$;
  end if;
end;
$$;
