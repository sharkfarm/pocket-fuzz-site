-- Pocket Fuzz Admin: Phase 2 (Band), Phase 3 (Venues), Phase 4 (Booking CRM)

create table if not exists public.band_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  venmo_handle text,
  instrument text,
  default_split_percent numeric(6,3) not null default 0 check (default_split_percent >= 0 and default_split_percent <= 100),
  active boolean not null default true,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues
  add column if not exists website text,
  add column if not exists booking_email text,
  add column if not exists booking_phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists default_doors_time time,
  add column if not exists default_start_time time,
  add column if not exists default_end_time time,
  add column if not exists default_ticket_goal integer,
  add column if not exists default_number_of_acts integer,
  add column if not exists radius_clause_weeks integer,
  add column if not exists radius_clause_miles integer,
  add column if not exists food_discount_percent numeric(5,2),
  add column if not exists meals_included_ticket_threshold integer,
  add column if not exists pa_provided boolean,
  add column if not exists sound_engineer_provided boolean,
  add column if not exists box_office_provided boolean,
  add column if not exists load_in_notes text,
  add column if not exists parking_notes text,
  add column if not exists stage_notes text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.booking_leads (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete set null,
  venue_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'researching' check (status in ('researching','not_contacted','contacted','waiting','interested','hold','confirmed','declined','closed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  last_contact_date date,
  follow_up_date date,
  next_action text,
  proposed_date date,
  proposed_guarantee numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_activities (
  id uuid primary key default gen_random_uuid(),
  booking_lead_id uuid not null references public.booking_leads(id) on delete cascade,
  activity_type text not null default 'note' check (activity_type in ('email','call','text','meeting','note','follow_up')),
  activity_date timestamptz not null default now(),
  summary text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists band_members_set_updated_at on public.band_members;
create trigger band_members_set_updated_at before update on public.band_members
for each row execute function public.set_updated_at();

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at before update on public.venues
for each row execute function public.set_updated_at();

drop trigger if exists booking_leads_set_updated_at on public.booking_leads;
create trigger booking_leads_set_updated_at before update on public.booking_leads
for each row execute function public.set_updated_at();

alter table public.band_members enable row level security;
alter table public.booking_leads enable row level security;
alter table public.booking_activities enable row level security;

-- Venues should already have RLS enabled from the original migration.
alter table public.venues enable row level security;

drop policy if exists "Authenticated users manage band members" on public.band_members;
create policy "Authenticated users manage band members" on public.band_members
for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage booking leads" on public.booking_leads;
create policy "Authenticated users manage booking leads" on public.booking_leads
for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage booking activities" on public.booking_activities;
create policy "Authenticated users manage booking activities" on public.booking_activities
for all to authenticated using (true) with check (true);

-- Keep the existing venues policy if present. This creates it only when absent.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'venues'
      and policyname = 'Authenticated users manage venues'
  ) then
    create policy "Authenticated users manage venues" on public.venues
    for all to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists booking_leads_follow_up_date_idx on public.booking_leads(follow_up_date);
create index if not exists booking_leads_status_idx on public.booking_leads(status);
create index if not exists booking_activities_lead_idx on public.booking_activities(booking_lead_id, activity_date desc);
