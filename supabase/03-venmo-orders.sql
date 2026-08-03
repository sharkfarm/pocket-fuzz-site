-- Pocket Fuzz Venmo-first website integration
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.shows
  add column if not exists public_slug text,
  add column if not exists is_public boolean not null default false,
  add column if not exists public_description text,
  add column if not exists flyer_url text;

create unique index if not exists shows_public_slug_unique
  on public.shows(public_slug)
  where public_slug is not null;

create table if not exists public.merch_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.venmo_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  show_id uuid not null references public.shows(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  venmo_username text,
  expected_amount numeric(10,2) not null default 0 check (expected_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','submitted','approved','declined','cancelled')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.venmo_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.venmo_orders(id) on delete cascade,
  item_kind text not null check (item_kind in ('ticket','merch')),
  ticket_sale_id uuid references public.ticket_sales(id) on delete restrict,
  merch_product_id uuid references public.merch_products(id) on delete restrict,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) generated always as (unit_price * quantity) stored
);

alter table public.merch_products enable row level security;
alter table public.venmo_orders enable row level security;
alter table public.venmo_order_items enable row level security;

drop policy if exists "Public reads active merch" on public.merch_products;
create policy "Public reads active merch"
on public.merch_products for select
to anon, authenticated
using (active = true);

drop policy if exists "Authenticated manage merch catalog" on public.merch_products;
create policy "Authenticated manage merch catalog"
on public.merch_products for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public creates Venmo orders" on public.venmo_orders;
create policy "Public creates Venmo orders"
on public.venmo_orders for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "Public reads own pending order by id" on public.venmo_orders;
create policy "Public reads pending order"
on public.venmo_orders for select
to anon, authenticated
using (status in ('pending','submitted'));

drop policy if exists "Public submits pending order" on public.venmo_orders;
create policy "Public submits pending order"
on public.venmo_orders for update
to anon, authenticated
using (status = 'pending')
with check (status = 'submitted');

drop policy if exists "Authenticated manage Venmo orders" on public.venmo_orders;
create policy "Authenticated manage Venmo orders"
on public.venmo_orders for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public creates Venmo order items" on public.venmo_order_items;
create policy "Public creates Venmo order items"
on public.venmo_order_items for insert
to anon, authenticated
with check (true);

drop policy if exists "Public reads Venmo order items" on public.venmo_order_items;
create policy "Public reads Venmo order items"
on public.venmo_order_items for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated manage Venmo order items" on public.venmo_order_items;
create policy "Authenticated manage Venmo order items"
on public.venmo_order_items for all
to authenticated
using (true)
with check (true);

create or replace function public.approve_venmo_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.venmo_orders%rowtype;
  v_item public.venmo_order_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_order
  from public.venmo_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'submitted' then
    raise exception 'Only submitted orders can be approved';
  end if;

  for v_item in
    select * from public.venmo_order_items where order_id = p_order_id
  loop
    if v_item.item_kind = 'ticket' then
      update public.ticket_sales
      set actual_quantity = actual_quantity + v_item.quantity
      where id = v_item.ticket_sale_id
        and show_id = v_order.show_id;

      if not found then
        raise exception 'Ticket row not found for order item %', v_item.id;
      end if;
    elsif v_item.item_kind = 'merch' then
      insert into public.merch_sales (
        show_id,
        item_name,
        quantity_sold,
        unit_price,
        unit_cost,
        payment_method
      )
      values (
        v_order.show_id,
        v_item.item_name,
        v_item.quantity,
        v_item.unit_price,
        v_item.unit_cost,
        'venmo'
      );
    end if;
  end loop;

  update public.venmo_orders
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_order_id;
end;
$$;

revoke all on function public.approve_venmo_order(uuid) from public;
grant execute on function public.approve_venmo_order(uuid) to authenticated;

-- Starter merch catalog. Edit or delete these rows in Supabase as needed.
insert into public.merch_products (name, description, price, unit_cost)
select 'T-Shirt', 'Pocket Fuzz shirt', 15, 0
where not exists (select 1 from public.merch_products where name = 'T-Shirt');

insert into public.merch_products (name, description, price, unit_cost)
select 'Sticker', 'Pocket Fuzz sticker', 1, 0
where not exists (select 1 from public.merch_products where name = 'Sticker');

insert into public.merch_products (name, description, price, unit_cost)
select 'Button', 'Pocket Fuzz button', 1, 0
where not exists (select 1 from public.merch_products where name = 'Button');

-- V2 additions: shirt size and public-read policies
alter table public.venmo_order_items
  add column if not exists item_option text;

alter table public.merch_sales
  add column if not exists size text;

alter table public.shows
  add column if not exists featured boolean not null default false;

drop policy if exists "Public reads public shows" on public.shows;
create policy "Public reads public shows"
on public.shows for select
to anon, authenticated
using (is_public = true);

drop policy if exists "Public reads tickets for public shows" on public.ticket_sales;
create policy "Public reads tickets for public shows"
on public.ticket_sales for select
to anon, authenticated
using (
  exists (
    select 1 from public.shows
    where shows.id = ticket_sales.show_id
      and shows.is_public = true
  )
);

drop policy if exists "Public reads venues for public shows" on public.venues;
create policy "Public reads venues for public shows"
on public.venues for select
to anon, authenticated
using (
  exists (
    select 1 from public.shows
    where shows.venue_id = venues.id
      and shows.is_public = true
  )
);

create or replace function public.approve_venmo_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.venmo_orders%rowtype;
  v_item public.venmo_order_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_order
  from public.venmo_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'submitted' then
    raise exception 'Only submitted orders can be approved';
  end if;

  for v_item in
    select * from public.venmo_order_items where order_id = p_order_id
  loop
    if v_item.item_kind = 'ticket' then
      update public.ticket_sales
      set actual_quantity = actual_quantity + v_item.quantity
      where id = v_item.ticket_sale_id
        and show_id = v_order.show_id;

      if not found then
        raise exception 'Ticket row not found for order item %', v_item.id;
      end if;
    elsif v_item.item_kind = 'merch' then
      insert into public.merch_sales (
        show_id,
        item_name,
        size,
        quantity_sold,
        unit_price,
        unit_cost,
        payment_method
      ) values (
        v_order.show_id,
        v_item.item_name,
        v_item.item_option,
        v_item.quantity,
        v_item.unit_price,
        v_item.unit_cost,
        'venmo'
      );
    end if;
  end loop;

  update public.venmo_orders
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_order_id;
end;
$$;
