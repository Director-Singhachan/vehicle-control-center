-- Add image_url column to vehicles table
-- The existing view vehicles_with_status uses v.* so it will automatically include the new column
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_url TEXT;
