-- Create product_categories table from existing products.category data
-- This ensures categories match what's actually used in the system

-- Helper function to update updated_at timestamp (if not exists)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create product_categories table (matching types/database.ts structure)
create table if not exists public.product_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  color text not null default '#3b82f6',
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.product_categories enable row level security;

-- RLS Policies
drop policy if exists "product_categories read active" on public.product_categories;
create policy "product_categories read active" on public.product_categories
  for select using (is_active = true and auth.uid() is not null);

drop policy if exists "product_categories manage admin" on public.product_categories;
create policy "product_categories manage admin" on public.product_categories
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'manager')
    )
  ) with check (true);

-- Trigger to update updated_at timestamp
drop trigger if exists update_product_categories_updated_at on public.product_categories;
create trigger update_product_categories_updated_at
  before update on public.product_categories
  for each row execute procedure public.update_updated_at_column();

-- IMPORTANT: Populate categories from actual products.category data
-- This ensures the table matches what's currently used in the system
insert into public.product_categories (name, description)
select distinct
  category as name,
  null::text as description
from public.products
where category is not null and category <> ''
order by category
on conflict (name) do nothing;
