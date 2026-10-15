-- Apply before deploying. Existing shows retain no cutoff.
alter table public.shows add column if not exists ticket_sales_cutoff timestamptz;
comment on column public.shows.ticket_sales_cutoff is
  'Optional online order cutoff. Admin enters America/Denver time; stored as an absolute instant.';

-- Guard direct Supabase insertion and races at the cutoff boundary.
-- Existing orders can still be confirmed and reviewed after cutoff.
-- Merch-only orders without a show are unaffected.
create or replace function public.enforce_show_ticket_sales()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_show public.shows%rowtype;
begin
  if new.show_id is null then return new; end if;
  select * into v_show from public.shows where id = new.show_id;
  if not found or not v_show.is_public
     or v_show.ticket_sales_status is distinct from 'on_sale'
     or v_show.status in ('cancelled', 'completed')
     or (v_show.ticket_sales_cutoff is not null and clock_timestamp() >= v_show.ticket_sales_cutoff) then
    raise exception 'Online Ticket Sales Closed';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_show_ticket_sales on public.venmo_orders;
create trigger enforce_show_ticket_sales before insert on public.venmo_orders
for each row execute function public.enforce_show_ticket_sales();
