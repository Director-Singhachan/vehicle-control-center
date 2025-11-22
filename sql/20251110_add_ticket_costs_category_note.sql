-- Add missing columns for ticket_costs to store category and note
-- Safe to run multiple times due to IF NOT EXISTS

alter table if exists public.ticket_costs
  add column if not exists category text,
  add column if not exists note text;

-- Optional: basic check constraint to keep category simple (adjust as needed)
-- alter table public.ticket_costs
--   add constraint ticket_costs_category_check
--   check (category is null or category in ('fuel','repair','parts','maintenance','other'));

-- Ensure table remains queryable post change
comment on column public.ticket_costs.category is 'Expense category (fuel, repair, parts, maintenance, other)';
comment on column public.ticket_costs.note is 'Optional cost note/details';

