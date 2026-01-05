-- Fix inventory table trigger issue
-- The trigger tries to set 'updated_at' but inventory table has 'last_updated_at'

-- Drop the old problematic trigger
DROP TRIGGER IF EXISTS update_inventory_updated_at ON public.inventory;

-- Drop the new trigger if it exists (for re-running this migration)
DROP TRIGGER IF EXISTS update_inventory_last_updated_at_trigger ON public.inventory;

-- Create function that updates 'last_updated_at' instead of 'updated_at'
CREATE OR REPLACE FUNCTION update_inventory_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the correct trigger
CREATE TRIGGER update_inventory_last_updated_at_trigger
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION update_inventory_last_updated_at();

-- Grant necessary permissions
GRANT UPDATE ON public.inventory TO authenticated;
