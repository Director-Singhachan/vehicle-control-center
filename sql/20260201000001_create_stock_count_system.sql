-- ========================================
-- Stock Count System with SML Integration
-- ========================================
-- ระบบนับสต๊อกที่รองรับการเชื่อมต่อกับ SML และทำงานอัตโนมัติ
-- 
-- Features:
-- 1. Zero Manual Entry (Barcode scanning)
-- 2. Instant Comparison (Real-time variance)
-- 3. Traceability (Detailed logs)
-- 4. SML Integration (Snapshot & ID Mapping)
-- 5. AI Analysis (Variance prediction)

-- ========================================
-- 1. PRODUCT MAPPING TABLE (ID Mapping)
-- ========================================
-- จัดการรหัสสินค้าที่ซับซ้อนหรือล้าสมัยจาก SML
CREATE TABLE IF NOT EXISTS public.product_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- External System IDs
  sml_product_code TEXT,              -- รหัสสินค้าใน SML
  sml_product_name TEXT,              -- ชื่อสินค้าใน SML (ถ้าต่างจากระบบใหม่)
  external_system TEXT DEFAULT 'SML', -- ระบบภายนอก (SML, ERP, etc.)
  
  -- Mapping Metadata
  mapping_type TEXT DEFAULT 'exact' CHECK (mapping_type IN ('exact', 'fuzzy', 'manual', 'auto')),
  confidence_score NUMERIC(5,2) DEFAULT 100.00, -- ความมั่นใจในการ map (0-100)
  mapping_notes TEXT,                 -- หมายเหตุการ map
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,  -- ตรวจสอบแล้วหรือยัง
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(external_system, sml_product_code), -- ไม่ให้ซ้ำในระบบเดียวกัน
  UNIQUE(product_id, external_system)        -- สินค้า 1 ตัว map กับ external system 1 ตัว
);

CREATE INDEX IF NOT EXISTS idx_product_mappings_product_id ON public.product_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_sml_code ON public.product_mappings(sml_product_code);
CREATE INDEX IF NOT EXISTS idx_product_mappings_external_system ON public.product_mappings(external_system);

-- ========================================
-- 2. INVENTORY SNAPSHOTS TABLE
-- ========================================
-- เก็บสถานะสต็อก ณ เวลาที่ Export จาก SML
-- เพื่อให้สามารถย้อนกลับไปดูได้ว่าความผิดพลาดเกิดจากฝั่งไหน
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Snapshot Metadata
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('sml_export', 'pre_count', 'post_count', 'system_backup')),
  source_system TEXT DEFAULT 'SML',   -- ระบบต้นทาง (SML, Manual, System)
  
  -- File/Export Info
  export_file_name TEXT,              -- ชื่อไฟล์ที่ import
  export_file_hash TEXT,              -- Hash ของไฟล์ (เพื่อตรวจสอบความซ้ำ)
  export_timestamp TIMESTAMPTZ,       -- เวลาที่ export จาก SML
  
  -- Warehouse Context
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Snapshot Data (JSONB for flexibility)
  snapshot_data JSONB NOT NULL,       -- ข้อมูลสต็อกทั้งหมด ณ เวลานั้น
  -- Format: { "product_code": { "quantity": 100, "unit": "kg", ... }, ... }
  
  -- Statistics
  total_products INTEGER DEFAULT 0,   -- จำนวนสินค้าทั้งหมดใน snapshot
  total_quantity NUMERIC DEFAULT 0,   -- จำนวนรวมทั้งหมด
  
  -- Status
  is_validated BOOLEAN DEFAULT FALSE, -- ตรวจสอบความถูกต้องแล้วหรือยัง
  validation_notes TEXT,             -- หมายเหตุการตรวจสอบ
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_type ON public.inventory_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_warehouse ON public.inventory_snapshots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_export_timestamp ON public.inventory_snapshots(export_timestamp);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_file_hash ON public.inventory_snapshots(export_file_hash);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_created_at ON public.inventory_snapshots(created_at);

-- GIN Index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_data ON public.inventory_snapshots USING GIN (snapshot_data);

-- ========================================
-- 3. STOCK COUNT SESSIONS TABLE
-- ========================================
-- Session การนับสต๊อก
CREATE TABLE IF NOT EXISTS public.stock_count_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Session Info
  session_number TEXT UNIQUE,         -- เลขที่ session (เช่น SC-2026-001)
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  
  -- Count Details
  count_date DATE NOT NULL,           -- วันที่นับ
  count_type TEXT NOT NULL DEFAULT 'full' CHECK (count_type IN ('full', 'cycle', 'spot', 'sml_sync')),
  -- full: นับทั้งหมด, cycle: นับเป็นรอบ, spot: นับเฉพาะจุด, sml_sync: sync จาก SML
  
  -- SML Integration
  sml_snapshot_id UUID REFERENCES public.inventory_snapshots(id) ON DELETE SET NULL,
  -- Link กับ snapshot ที่ import จาก SML
  
  -- Status Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- เริ่มต้น
    'in_progress',     -- กำลังนับ
    'under_review',    -- อยู่ระหว่างตรวจสอบ (สำหรับรายการที่มีส่วนต่างสูง)
    'completed',       -- นับเสร็จแล้ว
    'approved',        -- อนุมัติแล้ว
    'rejected',        -- ปฏิเสธ
    'cancelled'        -- ยกเลิก
  )),
  
  -- Progress Tracking
  total_items INTEGER DEFAULT 0,     -- จำนวนรายการทั้งหมด
  counted_items INTEGER DEFAULT 0,    -- จำนวนรายการที่นับแล้ว
  pending_items INTEGER DEFAULT 0,    -- จำนวนรายการที่ยังไม่นับ
  variance_items INTEGER DEFAULT 0,   -- จำนวนรายการที่มีส่วนต่าง
  
  -- Variance Summary
  total_variance_amount NUMERIC DEFAULT 0,  -- จำนวนส่วนต่างรวม
  total_variance_value NUMERIC DEFAULT 0,   -- มูลค่าส่วนต่างรวม
  
  -- Notes
  notes TEXT,
  rejection_reason TEXT,              -- เหตุผลการปฏิเสธ
  
  -- People
  counted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_warehouse ON public.stock_count_sessions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_status ON public.stock_count_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_count_date ON public.stock_count_sessions(count_date);
CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_sml_snapshot ON public.stock_count_sessions(sml_snapshot_id);

-- ========================================
-- 4. STOCK COUNT ITEMS TABLE
-- ========================================
-- รายการสินค้าที่นับในแต่ละ session
CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  
  -- Product Info
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  -- Quantity Info
  system_quantity NUMERIC NOT NULL DEFAULT 0,  -- จำนวนในระบบ (ณ เวลาที่สร้าง session)
  sml_quantity NUMERIC,                        -- จำนวนจาก SML (ถ้ามี)
  counted_quantity NUMERIC,                    -- จำนวนที่นับได้จริง
  
  -- Variance Calculation
  variance_quantity NUMERIC GENERATED ALWAYS AS (
    COALESCE(counted_quantity, sml_quantity) - system_quantity
  ) STORED,
  variance_percentage NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN system_quantity > 0 THEN 
        ROUND((COALESCE(counted_quantity, sml_quantity) - system_quantity) / system_quantity * 100, 2)
      ELSE NULL
    END
  ) STORED,
  variance_value NUMERIC GENERATED ALWAYS AS (
    (COALESCE(counted_quantity, sml_quantity) - system_quantity) * 
    COALESCE((SELECT base_price FROM public.products WHERE id = product_id), 0)
  ) STORED,
  
  -- Variance Classification
  variance_severity TEXT GENERATED ALWAYS AS (
    CASE
      WHEN ABS(COALESCE(counted_quantity, sml_quantity) - system_quantity) = 0 THEN 'none'
      WHEN ABS(COALESCE(counted_quantity, sml_quantity) - system_quantity) <= 1 THEN 'minor'
      WHEN ABS(COALESCE(counted_quantity, sml_quantity) - system_quantity) <= 10 THEN 'moderate'
      WHEN ABS(COALESCE(counted_quantity, sml_quantity) - system_quantity) <= 50 THEN 'major'
      ELSE 'critical'
    END
  ) STORED,
  
  -- Variance Reason
  variance_reason TEXT,                -- สาเหตุส่วนต่าง (manual entry)
  variance_category TEXT,              -- ประเภทส่วนต่าง (damage, loss, miscount, etc.)
  
  -- Counting Method
  counting_method TEXT DEFAULT 'manual' CHECK (counting_method IN ('manual', 'barcode', 'qr_code', 'rfid', 'sml_import')),
  barcode_scanned TEXT,                -- Barcode ที่สแกน (ถ้าใช้)
  
  -- Status
  is_reviewed BOOLEAN DEFAULT FALSE,   -- ตรวจสอบแล้วหรือยัง
  review_notes TEXT,                   -- หมายเหตุการตรวจสอบ
  requires_approval BOOLEAN GENERATED ALWAYS AS (
    variance_severity IN ('major', 'critical')
  ) STORED,
  
  -- People
  counted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  counted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(session_id, product_id)      -- ไม่ให้นับสินค้าเดียวกันซ้ำใน session เดียว
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_session ON public.stock_count_items(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_product ON public.stock_count_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_variance_severity ON public.stock_count_items(variance_severity);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_requires_approval ON public.stock_count_items(requires_approval);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_barcode ON public.stock_count_items(barcode_scanned);

-- ========================================
-- 5. DATA TRANSFORMERS TABLE
-- ========================================
-- จัดการ Data Transformer สำหรับ Import ไฟล์หลายรูปแบบ
CREATE TABLE IF NOT EXISTS public.data_transformers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Transformer Info
  name TEXT NOT NULL UNIQUE,           -- ชื่อ transformer (เช่น 'SML Excel', 'ERP CSV')
  source_system TEXT NOT NULL,        -- ระบบต้นทาง (SML, ERP, etc.)
  file_format TEXT NOT NULL,           -- รูปแบบไฟล์ (xlsx, csv, json, xml)
  
  -- Configuration (JSONB for flexibility)
  config JSONB NOT NULL,
  -- Format: {
  --   "column_mapping": { "product_code": "A", "quantity": "B", ... },
  --   "skip_rows": 2,
  --   "date_format": "DD/MM/YYYY",
  --   "validation_rules": { ... }
  -- }
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,    -- ใช้เป็น default สำหรับระบบนี้
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_transformers_source_system ON public.data_transformers(source_system);
CREATE INDEX IF NOT EXISTS idx_data_transformers_file_format ON public.data_transformers(file_format);

-- ========================================
-- 6. VARIANCE ANALYSIS TABLE
-- ========================================
-- วิเคราะห์และทำนายส่วนต่าง (AI Analysis)
CREATE TABLE IF NOT EXISTS public.variance_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Analysis Context
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  
  -- Analysis Period
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  
  -- Statistics
  total_count_sessions INTEGER DEFAULT 0,      -- จำนวนครั้งที่นับ
  variance_occurrences INTEGER DEFAULT 0,      -- จำนวนครั้งที่มีส่วนต่าง
  variance_frequency NUMERIC(5,2) DEFAULT 0,   -- ความถี่ส่วนต่าง (%)
  
  -- Pattern Detection
  frequent_variance_pattern TEXT,             -- รูปแบบส่วนต่างที่พบบ่อย
  typical_variance_amount NUMERIC,            -- จำนวนส่วนต่างโดยทั่วไป
  variance_trend TEXT,                        -- แนวโน้ม (increasing, decreasing, stable)
  
  -- Time-based Patterns
  high_variance_days TEXT[],                 -- วันที่มีส่วนต่างสูง (เช่น ['Saturday', 'Sunday'])
  high_variance_periods TEXT[],              -- ช่วงเวลาที่มีส่วนต่างสูง (เช่น ['end_of_month'])
  
  -- AI Predictions
  predicted_variance_probability NUMERIC(5,2), -- ความน่าจะเป็นที่จะเกิดส่วนต่าง (0-100)
  predicted_variance_amount NUMERIC,          -- จำนวนส่วนต่างที่คาดการณ์
  prediction_confidence NUMERIC(5,2),        -- ความมั่นใจในการทำนาย (0-100)
  
  -- Recommendations
  recommendation TEXT,                       -- คำแนะนำ (เช่น 'ควรนับบ่อยขึ้น', 'ตรวจสอบความเสียหาย')
  priority_level TEXT DEFAULT 'low' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Metadata
  analysis_model_version TEXT,               -- เวอร์ชันโมเดลที่ใช้วิเคราะห์
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(product_id, warehouse_id, analysis_period_start, analysis_period_end)
);

CREATE INDEX IF NOT EXISTS idx_variance_analysis_product ON public.variance_analysis(product_id);
CREATE INDEX IF NOT EXISTS idx_variance_analysis_warehouse ON public.variance_analysis(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_variance_analysis_priority ON public.variance_analysis(priority_level);
CREATE INDEX IF NOT EXISTS idx_variance_analysis_predicted_prob ON public.variance_analysis(predicted_variance_probability);

-- ========================================
-- 7. AUTO-CREATE PRODUCT LOGS TABLE
-- ========================================
-- บันทึกการสร้างสินค้าอัตโนมัติเมื่อ import จาก SML
CREATE TABLE IF NOT EXISTS public.auto_create_product_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source Info
  source_system TEXT NOT NULL DEFAULT 'SML',
  source_product_code TEXT NOT NULL,
  source_product_name TEXT,
  
  -- Created Product
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Action
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'suggested', 'rejected')),
  -- created: สร้างแล้ว, suggested: แนะนำให้สร้าง, rejected: ปฏิเสธ
  
  -- Details
  created_data JSONB,                 -- ข้อมูลที่ใช้สร้างสินค้า
  rejection_reason TEXT,              -- เหตุผลการปฏิเสธ (ถ้ามี)
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,  -- ตรวจสอบแล้วหรือยัง
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_create_logs_source_code ON public.auto_create_product_logs(source_product_code);
CREATE INDEX IF NOT EXISTS idx_auto_create_logs_action_type ON public.auto_create_product_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_auto_create_logs_product_id ON public.auto_create_product_logs(product_id);

-- ========================================
-- 8. FUNCTIONS & TRIGGERS
-- ========================================

-- Function: Auto-generate session number
CREATE OR REPLACE FUNCTION generate_stock_count_session_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq INTEGER;
  v_session_number TEXT;
BEGIN
  -- Format: SC-YYMM-XXXX (เช่น SC-2601-0001)
  v_year := TO_CHAR(NOW(), 'YY');
  v_month := LPAD(TO_CHAR(NOW(), 'MM'), 2, '0');
  
  -- Get next sequence for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(session_number FROM 8) AS INTEGER)), 0) + 1
  INTO v_seq
  FROM public.stock_count_sessions
  WHERE session_number LIKE 'SC-' || v_year || v_month || '-%';
  
  v_session_number := 'SC-' || v_year || v_month || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  NEW.session_number := v_session_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER set_stock_count_session_number
  BEFORE INSERT ON public.stock_count_sessions
  FOR EACH ROW
  WHEN (NEW.session_number IS NULL)
  EXECUTE FUNCTION generate_stock_count_session_number();

-- Function: Update session progress
CREATE OR REPLACE FUNCTION update_stock_count_session_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_total_items INTEGER;
  v_counted_items INTEGER;
  v_variance_items INTEGER;
BEGIN
  -- Count items in session
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE counted_quantity IS NOT NULL),
    COUNT(*) FILTER (WHERE variance_quantity != 0)
  INTO v_total_items, v_counted_items, v_variance_items
  FROM public.stock_count_items
  WHERE session_id = NEW.session_id;
  
  -- Update session
  UPDATE public.stock_count_sessions
  SET 
    total_items = v_total_items,
    counted_items = v_counted_items,
    pending_items = v_total_items - v_counted_items,
    variance_items = v_variance_items,
    updated_at = NOW()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER update_session_progress_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_count_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_count_session_progress();

-- Function: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_stock_count_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER update_stock_count_sessions_updated_at
  BEFORE UPDATE ON public.stock_count_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_count_updated_at();

CREATE TRIGGER update_stock_count_items_updated_at
  BEFORE UPDATE ON public.stock_count_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_count_updated_at();

-- ========================================
-- 9. VIEWS
-- ========================================

-- View: Stock Count Summary
CREATE OR REPLACE VIEW public.stock_count_summary AS
SELECT
  scs.id,
  scs.session_number,
  scs.warehouse_id,
  w.name AS warehouse_name,
  scs.count_date,
  scs.count_type,
  scs.status,
  scs.total_items,
  scs.counted_items,
  scs.pending_items,
  scs.variance_items,
  scs.total_variance_amount,
  scs.total_variance_value,
  ROUND(scs.counted_items::NUMERIC / NULLIF(scs.total_items, 0) * 100, 2) AS progress_percentage,
  scs.created_at,
  scs.completed_at,
  scs.approved_at
FROM public.stock_count_sessions scs
LEFT JOIN public.warehouses w ON scs.warehouse_id = w.id;

GRANT SELECT ON public.stock_count_summary TO authenticated;

-- View: Variance Items Requiring Review
CREATE OR REPLACE VIEW public.variance_items_review AS
SELECT
  sci.id,
  sci.session_id,
  scs.session_number,
  sci.product_id,
  p.product_code,
  p.product_name,
  sci.system_quantity,
  sci.sml_quantity,
  sci.counted_quantity,
  sci.variance_quantity,
  sci.variance_percentage,
  sci.variance_value,
  sci.variance_severity,
  sci.variance_reason,
  sci.requires_approval,
  sci.is_reviewed,
  sci.review_notes
FROM public.stock_count_items sci
JOIN public.stock_count_sessions scs ON sci.session_id = scs.id
JOIN public.products p ON sci.product_id = p.id
WHERE sci.requires_approval = TRUE
  AND sci.is_reviewed = FALSE
  AND scs.status IN ('completed', 'under_review')
ORDER BY sci.variance_severity DESC, ABS(sci.variance_value) DESC;

GRANT SELECT ON public.variance_items_review TO authenticated;

-- ========================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE public.product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_transformers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variance_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_create_product_logs ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can view, admins/managers can modify
-- (Detailed policies can be added based on business requirements)

-- Product Mappings
CREATE POLICY product_mappings_select ON public.product_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY product_mappings_modify ON public.product_mappings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Inventory Snapshots
CREATE POLICY inventory_snapshots_select ON public.inventory_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY inventory_snapshots_modify ON public.inventory_snapshots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
  );

-- Stock Count Sessions
CREATE POLICY stock_count_sessions_select ON public.stock_count_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY stock_count_sessions_insert ON public.stock_count_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user')
    )
  );

CREATE POLICY stock_count_sessions_update ON public.stock_count_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector')
    )
    OR counted_by = auth.uid()  -- ผู้นับสามารถอัพเดท session ของตัวเองได้
  );

-- Stock Count Items
CREATE POLICY stock_count_items_select ON public.stock_count_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY stock_count_items_modify ON public.stock_count_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'inspector', 'user', 'driver')
    )
  );

-- Data Transformers
CREATE POLICY data_transformers_select ON public.data_transformers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY data_transformers_modify ON public.data_transformers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Variance Analysis
CREATE POLICY variance_analysis_select ON public.variance_analysis
  FOR SELECT TO authenticated USING (true);

-- Auto Create Product Logs
CREATE POLICY auto_create_logs_select ON public.auto_create_product_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY auto_create_logs_modify ON public.auto_create_product_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ========================================
-- 11. COMMENTS (Documentation)
-- ========================================

COMMENT ON TABLE public.product_mappings IS 'จัดการ mapping รหัสสินค้าระหว่างระบบใหม่กับระบบภายนอก (SML, ERP)';
COMMENT ON TABLE public.inventory_snapshots IS 'เก็บ snapshot สต็อก ณ เวลาที่ export จาก SML เพื่อตรวจสอบความผิดพลาด';
COMMENT ON TABLE public.stock_count_sessions IS 'Session การนับสต๊อก รองรับ workflow: draft -> in_progress -> under_review -> completed -> approved';
COMMENT ON TABLE public.stock_count_items IS 'รายการสินค้าที่นับในแต่ละ session พร้อมคำนวณส่วนต่างอัตโนมัติ';
COMMENT ON TABLE public.data_transformers IS 'Configuration สำหรับแปลงข้อมูลจากไฟล์หลายรูปแบบ (Excel, CSV, JSON)';
COMMENT ON TABLE public.variance_analysis IS 'วิเคราะห์และทำนายส่วนต่างของสินค้าแต่ละตัว (AI Analysis)';
COMMENT ON TABLE public.auto_create_product_logs IS 'บันทึกการสร้างสินค้าอัตโนมัติเมื่อ import จาก SML พบสินค้าใหม่';

COMMENT ON COLUMN public.stock_count_sessions.status IS 'Workflow: draft -> in_progress -> under_review (สำหรับส่วนต่างสูง) -> completed -> approved';
COMMENT ON COLUMN public.stock_count_items.variance_severity IS 'none, minor, moderate, major, critical - ใช้กำหนดว่าต้อง approval หรือไม่';
COMMENT ON COLUMN public.stock_count_items.requires_approval IS 'Auto-calculated: TRUE ถ้า variance_severity เป็น major หรือ critical';
