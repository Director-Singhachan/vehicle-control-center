-- Create storage bucket for ticket attachments
-- Run this in Supabase SQL Editor
-- 
-- NOTE: If this doesn't work, create the bucket manually via Supabase Dashboard:
-- 1. Go to Storage → New bucket
-- 2. Name: ticket-attachments
-- 3. Public: Yes
-- 4. File size limit: 52428800 (50MB)
-- 5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf, video/mp4, video/quicktime

-- Step 1: Create the bucket (if it doesn't exist)
-- Note: Some Supabase versions require bucket creation via Dashboard
-- If this fails, create the bucket manually via Dashboard first, then run the policies below
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  true, -- Public bucket (files are publicly accessible)
  52428800, -- 50MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to ticket attachments" ON storage.objects;

-- Step 3: Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 4: Create policy to allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 5: Create policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update ticket attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 6: Create policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete ticket attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 7: Allow public read access (since bucket is public)
CREATE POLICY "Allow public read access to ticket attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ticket-attachments');

