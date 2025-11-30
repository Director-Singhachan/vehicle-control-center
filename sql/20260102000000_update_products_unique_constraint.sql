-- ========================================
-- Update Products Table to Support Multiple Units per Product Code
-- ========================================
-- This migration updates the products table to allow multiple units for the same product_code
-- Instead of unique constraint on product_code alone, we use (product_code, unit) as unique

-- Drop the existing unique constraint on product_code
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_product_code_key;

-- Add unique constraint on (product_code, unit) combination
-- This allows the same product_code to have different units (e.g., ถาด, กระป๋อง, ลัง)
ALTER TABLE public.products
ADD CONSTRAINT products_product_code_unit_key UNIQUE (product_code, unit);

-- Update index
DROP INDEX IF EXISTS idx_products_product_code;
CREATE INDEX IF NOT EXISTS idx_products_product_code_unit ON public.products(product_code, unit);

-- Add comment
COMMENT ON CONSTRAINT products_product_code_unit_key ON public.products IS 
'อนุญาตให้รหัสสินค้าเดียวกันมีหลายหน่วยได้ (เช่น รหัส 1000018 อาจมีหน่วย ถาด, กระป๋อง, ลัง)';

