
-- Add invoice_status to delivery_trip_stores
-- Migration: 20260204000001_add_invoice_status_to_trip_stores.sql

ALTER TABLE public.delivery_trip_stores 
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20) DEFAULT 'pending';

COMMENT ON COLUMN public.delivery_trip_stores.invoice_status IS 'สถานะการออกใบแจ้งหนี้ (pending, issued)';
