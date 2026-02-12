-- ============================================================
-- Migration: Create Trip Packing Layout Tables
-- Purpose: บันทึกการจัดเรียงสินค้าจริงหลังจบทริป
--   แต่ละพาเลท/พื้น มีสินค้าอะไรบ้าง จำนวนเท่าไร
-- ============================================================

-- 1) ตาราง trip_packing_layout
-- แต่ละแถว = 1 ตำแหน่ง (pallet + index + layer)
CREATE TABLE IF NOT EXISTS public.trip_packing_layout (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id uuid NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  position_type   text NOT NULL DEFAULT 'pallet',  -- 'pallet' | 'floor'
  position_index  int  NOT NULL DEFAULT 1,          -- ลำดับพาเลท (1,2,3…) หรือโซนพื้น
  layer_index     int  NOT NULL DEFAULT 0,          -- ชั้น (0 = ชั้นเดียว/ชั้นล่าง); Phase B ใช้เต็มที่
  notes           text,                              -- หมายเหตุต่อตำแหน่ง
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_position_type CHECK (position_type IN ('pallet', 'floor')),
  CONSTRAINT chk_position_index_positive CHECK (position_index > 0),
  CONSTRAINT chk_layer_index_non_negative CHECK (layer_index >= 0),
  CONSTRAINT uq_trip_position UNIQUE (delivery_trip_id, position_type, position_index, layer_index)
);

COMMENT ON TABLE public.trip_packing_layout IS 'ตำแหน่งจัดเรียง (1 row = 1 pallet/floor + layer) ต่อทริป';

-- 2) ตาราง trip_packing_layout_items
-- สินค้าแต่ละรายการที่วางในตำแหน่ง
CREATE TABLE IF NOT EXISTS public.trip_packing_layout_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_packing_layout_id   uuid NOT NULL REFERENCES public.trip_packing_layout(id) ON DELETE CASCADE,
  delivery_trip_item_id    uuid NOT NULL REFERENCES public.delivery_trip_items(id) ON DELETE CASCADE,
  quantity                 numeric NOT NULL DEFAULT 0,
  sequence_in_layer        int,           -- ลำดับในชั้นเดียวกัน (Phase B)
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_quantity_positive CHECK (quantity > 0)
);

COMMENT ON TABLE public.trip_packing_layout_items IS 'สินค้าในแต่ละตำแหน่งจัดเรียง (อ้างอิง delivery_trip_items)';

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_tpl_trip
  ON public.trip_packing_layout(delivery_trip_id);

CREATE INDEX IF NOT EXISTS idx_tpl_position
  ON public.trip_packing_layout(delivery_trip_id, position_type, position_index);

CREATE INDEX IF NOT EXISTS idx_tpli_layout
  ON public.trip_packing_layout_items(trip_packing_layout_id);

CREATE INDEX IF NOT EXISTS idx_tpli_item
  ON public.trip_packing_layout_items(delivery_trip_item_id);

-- 4) Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_trip_packing_layout_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_packing_layout_updated_at ON public.trip_packing_layout;
CREATE TRIGGER trg_trip_packing_layout_updated_at
  BEFORE UPDATE ON public.trip_packing_layout
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trip_packing_layout_updated_at();

-- 5) RLS Policies
ALTER TABLE public.trip_packing_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_packing_layout_items ENABLE ROW LEVEL SECURITY;

-- trip_packing_layout: SELECT (ทุกคนที่ authenticated)
CREATE POLICY tpl_select ON public.trip_packing_layout
  FOR SELECT TO authenticated
  USING (true);

-- trip_packing_layout: INSERT (authenticated)
CREATE POLICY tpl_insert ON public.trip_packing_layout
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- trip_packing_layout: UPDATE (authenticated)
CREATE POLICY tpl_update ON public.trip_packing_layout
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- trip_packing_layout: DELETE (authenticated)
CREATE POLICY tpl_delete ON public.trip_packing_layout
  FOR DELETE TO authenticated
  USING (true);

-- trip_packing_layout_items: SELECT
CREATE POLICY tpli_select ON public.trip_packing_layout_items
  FOR SELECT TO authenticated
  USING (true);

-- trip_packing_layout_items: INSERT
CREATE POLICY tpli_insert ON public.trip_packing_layout_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- trip_packing_layout_items: UPDATE
CREATE POLICY tpli_update ON public.trip_packing_layout_items
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- trip_packing_layout_items: DELETE
CREATE POLICY tpli_delete ON public.trip_packing_layout_items
  FOR DELETE TO authenticated
  USING (true);
