-- ============================================================
-- Fix: Supabase linter 0010_security_definer_view
-- Views order_item_remaining_quantities / order_remaining_summary
-- must use security_invoker so RLS applies to the querying user.
-- Safe to re-run (idempotent).
-- ============================================================

ALTER VIEW public.order_item_remaining_quantities SET (security_invoker = true);
ALTER VIEW public.order_remaining_summary SET (security_invoker = true);
