-- Migration: Add item change flags to delivery_trips

ALTER TABLE public.delivery_trips
  ADD COLUMN IF NOT EXISTS has_item_changes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_item_change_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_delivery_trips_has_item_changes
  ON public.delivery_trips(has_item_changes);

COMMENT ON COLUMN public.delivery_trips.has_item_changes IS 'ระบุว่าทริปนี้เคยมีการแก้ไขรายการสินค้าแล้วหรือไม่';
COMMENT ON COLUMN public.delivery_trips.last_item_change_at IS 'เวลาล่าสุดที่มีการแก้ไขรายการสินค้าในทริปนี้';


