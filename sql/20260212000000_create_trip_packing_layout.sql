-- ============================================================
-- Migration: Create Trip Packing Layout Tables
-- Purpose: บันทึกการจัดเรียงสินค้าจริงหลังจบทริป
--   แต่ละพาเลท/พื้น มีสินค้าอะไรบ้าง จำนวนเท่าไร กี่ชั้น
--   รองรับ 2 โหมด:
--     1) โหมดง่าย: ใส่สินค้า + จำนวนชั้นรวม (layer_index = NULL)
--     2) โหมดละเอียด: ระบุสินค้าแต่ละชั้น (layer_index = 0, 1, 2...)
-- ============================================================

-- 1) ตาราง trip_packing_layout
-- แต่ละแถว = 1 พาเลท หรือ 1 โซนบนพื้น
CREATE TABLE IF NOT EXISTS public.trip_packing_layout (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_trip_id uuid NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  position_type   text NOT NULL DEFAULT 'pallet',  -- 'pallet' | 'floor'
  position_index  int  NOT NULL DEFAULT 1,          -- ลำดับพาเลท (1,2,3…) หรือโซนพื้น
  total_layers    int  NOT NULL DEFAULT 1,           -- จำนวนชั้นที่วางซ้อนกัน
  notes           text,                              -- หมายเหตุ
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_position_type CHECK (position_type IN ('pallet', 'floor')),
  CONSTRAINT chk_position_index_positive CHECK (position_index > 0),
  CONSTRAINT chk_total_layers_positive CHECK (total_layers > 0),
  CONSTRAINT uq_trip_position UNIQUE (delivery_trip_id, position_type, position_index)
);

COMMENT ON TABLE public.trip_packing_layout IS 'ตำแหน่งจัดเรียง (1 row = 1 พาเลท/พื้น) ต่อทริป';

-- 2) ตาราง trip_packing_layout_items
-- สินค้าแต่ละรายการที่วางในพาเลท/พื้นนั้น
-- layer_index = NULL → โหมดง่าย (สินค้าอยู่ระดับพาเลท ไม่ระบุชั้น)
-- layer_index = 0,1,2... → โหมดละเอียด (ระบุว่าอยู่ชั้นไหน, 0 = ชั้นล่างสุด)
CREATE TABLE IF NOT EXISTS public.trip_packing_layout_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_packing_layout_id   uuid NOT NULL REFERENCES public.trip_packing_layout(id) ON DELETE CASCADE,
  delivery_trip_item_id    uuid NOT NULL REFERENCES public.delivery_trip_items(id) ON DELETE CASCADE,
  quantity                 numeric NOT NULL DEFAULT 0,
  layer_index              int,     -- NULL = โหมดง่าย, 0+ = โหมดละเอียด (0=ล่างสุด)
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_layer_index_non_negative CHECK (layer_index IS NULL OR layer_index >= 0)
);

COMMENT ON TABLE public.trip_packing_layout_items IS 'สินค้าในแต่ละพาเลท/พื้น; layer_index=NULL คือโหมดง่าย, 0+ คือระบุชั้น';

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

DROP POLICY IF EXISTS tpl_select ON public.trip_packing_layout;
DROP POLICY IF EXISTS tpl_insert ON public.trip_packing_layout;
DROP POLICY IF EXISTS tpl_update ON public.trip_packing_layout;
DROP POLICY IF EXISTS tpl_delete ON public.trip_packing_layout;

CREATE POLICY tpl_select ON public.trip_packing_layout
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tpl_insert ON public.trip_packing_layout
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tpl_update ON public.trip_packing_layout
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tpl_delete ON public.trip_packing_layout
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS tpli_select ON public.trip_packing_layout_items;
DROP POLICY IF EXISTS tpli_insert ON public.trip_packing_layout_items;
DROP POLICY IF EXISTS tpli_update ON public.trip_packing_layout_items;
DROP POLICY IF EXISTS tpli_delete ON public.trip_packing_layout_items;

CREATE POLICY tpli_select ON public.trip_packing_layout_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tpli_insert ON public.trip_packing_layout_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tpli_update ON public.trip_packing_layout_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tpli_delete ON public.trip_packing_layout_items
  FOR DELETE TO authenticated USING (true);
