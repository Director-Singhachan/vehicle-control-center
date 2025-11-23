-- Create storage policies for ticket-attachments bucket
-- Run this AFTER creating the bucket via Dashboard or the main migration
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to ticket attachments" ON storage.objects;

-- Step 2: Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 3: Create policy to allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 4: Create policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update ticket attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 5: Create policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete ticket attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.role() = 'authenticated'
);

-- Step 6: Allow public read access (since bucket is public)
CREATE POLICY "Allow public read access to ticket attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ticket-attachments');

