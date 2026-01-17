-- ========================================
-- Create Vehicle Document Management System
-- ========================================
-- This migration creates tables for managing vehicle documents:
-- - vehicle_documents: Central table for all document types
-- - vehicle_tax_records: Specific fields for tax documents
-- - vehicle_insurance_records: Specific fields for insurance documents
-- - Adds owner_group field to vehicles table
-- ========================================

-- ========================================
-- 1. Add owner_group to vehicles table
-- ========================================

ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS owner_group TEXT 
CHECK (owner_group IN ('thaikit', 'sing_chanthaburi', 'rental'));

COMMENT ON COLUMN public.vehicles.owner_group IS 'กลุ่มเจ้าของรถ: thaikit=บริษัทไทยกิจ, sing_chanthaburi=บริษัทสิงห์จันทบุรีจำกัด, rental=รถเช่า';

-- ========================================
-- 2. Create vehicle_documents table (Central table)
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'registration',  -- ทะเบียนรถ
    'tax',           -- ภาษีรถ
    'insurance',     -- ประกัน
    'inspection',    -- พรบ./ตรวจสภาพ
    'other'          -- อื่นๆ
  )),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  issued_date DATE,
  expiry_date DATE,
  remind_before_days INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',    -- ใช้งานอยู่
    'expired',   -- หมดอายุ
    'pending',   -- รอการอนุมัติ
    'cancelled'  -- ยกเลิก
  )),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for vehicle_documents
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id 
  ON public.vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry_date 
  ON public.vehicle_documents(expiry_date) 
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_type 
  ON public.vehicle_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_status 
  ON public.vehicle_documents(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_created_by 
  ON public.vehicle_documents(created_by);

-- ========================================
-- 3. Create vehicle_tax_records table
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.vehicle_documents(id) ON DELETE SET NULL,
  tax_number TEXT,
  amount NUMERIC(12, 2),
  paid_date DATE,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for vehicle_tax_records
CREATE INDEX IF NOT EXISTS idx_vehicle_tax_records_vehicle_id 
  ON public.vehicle_tax_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_tax_records_document_id 
  ON public.vehicle_tax_records(document_id);

-- ========================================
-- 4. Create vehicle_insurance_records table
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_insurance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.vehicle_documents(id) ON DELETE SET NULL,
  provider_name TEXT,
  policy_number TEXT,
  coverage_type TEXT CHECK (coverage_type IN (
    'compulsory',  -- พรบ.
    'voluntary',   -- ประกันภัย
    'both'         -- ทั้งสองอย่าง
  )),
  coverage_amount NUMERIC(12, 2),
  premium_amount NUMERIC(12, 2),
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for vehicle_insurance_records
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_records_vehicle_id 
  ON public.vehicle_insurance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_records_document_id 
  ON public.vehicle_insurance_records(document_id);

-- ========================================
-- 5. Create updated_at trigger function
-- ========================================

CREATE OR REPLACE FUNCTION update_vehicle_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply trigger to vehicle_documents
DROP TRIGGER IF EXISTS trigger_update_vehicle_documents_updated_at ON public.vehicle_documents;
CREATE TRIGGER trigger_update_vehicle_documents_updated_at
  BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_documents_updated_at();

-- Apply trigger to vehicle_tax_records
DROP TRIGGER IF EXISTS trigger_update_vehicle_tax_records_updated_at ON public.vehicle_tax_records;
CREATE TRIGGER trigger_update_vehicle_tax_records_updated_at
  BEFORE UPDATE ON public.vehicle_tax_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_documents_updated_at();

-- Apply trigger to vehicle_insurance_records
DROP TRIGGER IF EXISTS trigger_update_vehicle_insurance_records_updated_at ON public.vehicle_insurance_records;
CREATE TRIGGER trigger_update_vehicle_insurance_records_updated_at
  BEFORE UPDATE ON public.vehicle_insurance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_documents_updated_at();

-- ========================================
-- 6. Enable RLS
-- ========================================

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_insurance_records ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 7. RLS Policies for vehicle_documents
-- ========================================

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "vehicle_documents_select_all_staff" ON public.vehicle_documents;
DROP POLICY IF EXISTS "vehicle_documents_insert_staff" ON public.vehicle_documents;
DROP POLICY IF EXISTS "vehicle_documents_update_staff" ON public.vehicle_documents;
DROP POLICY IF EXISTS "vehicle_documents_delete_staff" ON public.vehicle_documents;

-- SELECT: Admin, Manager, Inspector can see all; Drivers can see documents for their vehicles
CREATE POLICY "vehicle_documents_select_all_staff"
ON public.vehicle_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'executive')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.trip_logs tl
    WHERE tl.vehicle_id = vehicle_documents.vehicle_id
    AND tl.driver_id = auth.uid()
  )
);

-- INSERT: Admin, Manager can insert
CREATE POLICY "vehicle_documents_insert_staff"
ON public.vehicle_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
  AND created_by = auth.uid()
);

-- UPDATE: Admin, Manager can update
CREATE POLICY "vehicle_documents_update_staff"
ON public.vehicle_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- DELETE: Admin, Manager can delete
CREATE POLICY "vehicle_documents_delete_staff"
ON public.vehicle_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- 8. RLS Policies for vehicle_tax_records
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "vehicle_tax_records_select_all_staff" ON public.vehicle_tax_records;
DROP POLICY IF EXISTS "vehicle_tax_records_insert_staff" ON public.vehicle_tax_records;
DROP POLICY IF EXISTS "vehicle_tax_records_update_staff" ON public.vehicle_tax_records;
DROP POLICY IF EXISTS "vehicle_tax_records_delete_staff" ON public.vehicle_tax_records;

-- SELECT: Same as vehicle_documents
CREATE POLICY "vehicle_tax_records_select_all_staff"
ON public.vehicle_tax_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'executive')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.trip_logs tl
    WHERE tl.vehicle_id = vehicle_tax_records.vehicle_id
    AND tl.driver_id = auth.uid()
  )
);

-- INSERT: Admin, Manager can insert
CREATE POLICY "vehicle_tax_records_insert_staff"
ON public.vehicle_tax_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
  AND created_by = auth.uid()
);

-- UPDATE: Admin, Manager can update
CREATE POLICY "vehicle_tax_records_update_staff"
ON public.vehicle_tax_records
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- DELETE: Admin, Manager can delete
CREATE POLICY "vehicle_tax_records_delete_staff"
ON public.vehicle_tax_records
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- 9. RLS Policies for vehicle_insurance_records
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "vehicle_insurance_records_select_all_staff" ON public.vehicle_insurance_records;
DROP POLICY IF EXISTS "vehicle_insurance_records_insert_staff" ON public.vehicle_insurance_records;
DROP POLICY IF EXISTS "vehicle_insurance_records_update_staff" ON public.vehicle_insurance_records;
DROP POLICY IF EXISTS "vehicle_insurance_records_delete_staff" ON public.vehicle_insurance_records;

-- SELECT: Same as vehicle_documents
CREATE POLICY "vehicle_insurance_records_select_all_staff"
ON public.vehicle_insurance_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'executive')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.trip_logs tl
    WHERE tl.vehicle_id = vehicle_insurance_records.vehicle_id
    AND tl.driver_id = auth.uid()
  )
);

-- INSERT: Admin, Manager can insert
CREATE POLICY "vehicle_insurance_records_insert_staff"
ON public.vehicle_insurance_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
  AND created_by = auth.uid()
);

-- UPDATE: Admin, Manager can update
CREATE POLICY "vehicle_insurance_records_update_staff"
ON public.vehicle_insurance_records
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- DELETE: Admin, Manager can delete
CREATE POLICY "vehicle_insurance_records_delete_staff"
ON public.vehicle_insurance_records
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager')
  )
);

-- ========================================
-- 10. Create function to check document expiry and create alerts
-- ========================================

CREATE OR REPLACE FUNCTION check_vehicle_document_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_record RECORD;
  days_until_expiry INTEGER;
BEGIN
  -- Loop through documents that are active and have expiry dates
  FOR doc_record IN
    SELECT 
      vd.id,
      vd.vehicle_id,
      vd.document_type,
      vd.expiry_date,
      vd.remind_before_days,
      v.plate
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.status = 'active'
      AND vd.expiry_date IS NOT NULL
      AND vd.expiry_date <= CURRENT_DATE + (vd.remind_before_days || ' days')::INTERVAL
      AND vd.expiry_date > CURRENT_DATE
  LOOP
    days_until_expiry := doc_record.expiry_date - CURRENT_DATE;
    
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1
      FROM public.vehicle_alerts
      WHERE vehicle_id = doc_record.vehicle_id
        AND alert_type = 'document_expiry'
        AND message LIKE '%' || doc_record.document_type || '%'
        AND status = 'active'
    ) THEN
      -- Create alert
      INSERT INTO public.vehicle_alerts (
        vehicle_id,
        alert_type,
        severity,
        message,
        status
      ) VALUES (
        doc_record.vehicle_id,
        'document_expiry',
        CASE 
          WHEN days_until_expiry <= 7 THEN 'critical'
          WHEN days_until_expiry <= 30 THEN 'high'
          ELSE 'medium'
        END,
        'เอกสาร ' || doc_record.document_type || ' ของรถ ' || doc_record.plate || ' จะหมดอายุในอีก ' || days_until_expiry || ' วัน',
        'active'
      );
    END IF;
  END LOOP;
  
  -- Mark expired documents
  UPDATE public.vehicle_documents
  SET status = 'expired'
  WHERE status = 'active'
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE;
END;
$$;

COMMENT ON FUNCTION check_vehicle_document_expiry() IS 'ตรวจสอบเอกสารที่ใกล้หมดอายุและสร้าง alerts';

-- ========================================
-- 11. Create storage bucket for vehicle documents (if not exists)
-- ========================================

-- Note: Bucket creation via SQL may not work in all Supabase versions
-- If this fails, create the bucket manually via Supabase Dashboard:
-- 1. Go to Storage → New bucket
-- 2. Name: vehicle-documents
-- 3. Public: Yes (or No, depending on your security requirements)
-- 4. File size limit: 52428800 (50MB)
-- 5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, application/pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-documents',
  'vehicle-documents',
  true, -- Public bucket (files are publicly accessible)
  52428800, -- 50MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 12. Storage Policies for vehicle-documents bucket
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicle documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to vehicle documents" ON storage.objects;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload vehicle documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read vehicle documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-documents' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to update files
CREATE POLICY "Allow authenticated users to update vehicle documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicle-documents' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'vehicle-documents' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete vehicle documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vehicle-documents' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow public read access (if bucket is public)
CREATE POLICY "Allow public read access to vehicle documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vehicle-documents');
