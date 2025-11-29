-- Migration: Add LINE pending PDF and ticket number fields to notification_settings
-- This allows the LINE webhook to store pending PDFs and ticket numbers in the database
-- instead of using in-memory Maps that are lost on function restart

-- Add columns to notification_settings table
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS line_pending_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS line_pending_ticket_number TEXT,
ADD COLUMN IF NOT EXISTS line_pending_pdf_uploaded_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN notification_settings.line_pending_pdf_path IS 'Path to pending PDF file in Supabase Storage (pending-pdfs/{lineUserId}/{timestamp}.pdf)';
COMMENT ON COLUMN notification_settings.line_pending_ticket_number IS 'Ticket number waiting for PDF upload (when user sends ticket number first)';
COMMENT ON COLUMN notification_settings.line_pending_pdf_uploaded_at IS 'Timestamp when the pending PDF was uploaded to Storage';

-- Create index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_notification_settings_line_pending_pdf 
  ON notification_settings(line_user_id) 
  WHERE line_pending_pdf_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_settings_line_pending_ticket 
  ON notification_settings(line_user_id) 
  WHERE line_pending_ticket_number IS NOT NULL;

