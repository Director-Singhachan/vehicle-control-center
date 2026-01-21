-- Rollback: Remove product_categories table and related objects

-- Drop trigger
drop trigger if exists update_product_categories_updated_at on public.product_categories;

-- Drop policies
drop policy if exists "product_categories read active" on public.product_categories;
drop policy if exists "product_categories manage admin" on public.product_categories;

-- Drop table (cascade will drop dependent objects)
drop table if exists public.product_categories cascade;

-- Optional: Drop the helper function if no longer used by other tables
-- drop function if exists public.update_updated_at_column();
