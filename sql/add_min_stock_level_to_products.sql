-- Add min_stock_level to products table
-- To support global minimum stock level alert settings in Product Management

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0;

COMMENT ON COLUMN public.products.min_stock_level IS 'Global minimum stock level for alert (default)';
