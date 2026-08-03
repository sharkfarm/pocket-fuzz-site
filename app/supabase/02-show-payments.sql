create table if not exists public.show_payments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  member_name text not null,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.show_payments enable row level security;

drop policy if exists "Authenticated users manage show payments" on public.show_payments;
create policy "Authenticated users manage show payments"
on public.show_payments
for all
to authenticated
using (true)
with check (true);
