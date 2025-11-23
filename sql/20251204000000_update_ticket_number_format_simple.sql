-- Update ticket number format to YYMM-XXX (e.g., 6811-001)
-- Simple version - run this in Supabase SQL Editor

-- Step 1: Drop old function if exists
DROP FUNCTION IF EXISTS public.generate_ticket_number(text, integer);

-- Step 2: Create new function
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_month text;
    month_prefix text;
    next_seq integer;
    formatted text;
BEGIN
    -- Get current month in YYMM format (e.g., 2412 for December 2024)
    current_month := to_char(CURRENT_DATE, 'YYMM');
    
    -- Create sequence name for this month (e.g., ticket_seq_2412)
    month_prefix := 'ticket_seq_' || current_month;
    
    -- Create sequence for this month if it doesn't exist
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I INCREMENT BY 1 MINVALUE 1 START WITH 1', month_prefix);
    
    -- Get next value from this month's sequence
    EXECUTE format('SELECT nextval(%I)', month_prefix) INTO next_seq;
    
    -- Format as YYMM-XXX (e.g., 2412-001)
    formatted := current_month || '-' || lpad(next_seq::text, 3, '0');
    
    RETURN formatted;
END;
$$;

-- Step 3: Add comment
COMMENT ON FUNCTION public.generate_ticket_number IS 'Generates ticket number in format YYMM-XXX (e.g., 2412-001). Sequence resets each month.';

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_ticket_number() TO authenticated, service_role;

