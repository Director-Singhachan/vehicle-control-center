-- Enable RLS and add policies for inventory_transactions table

-- Enable RLS (if not already enabled)
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Authorized users can insert inventory transactions" ON public.inventory_transactions;

-- Policy: Anyone can view inventory transactions
CREATE POLICY "Anyone can view inventory transactions" 
  ON public.inventory_transactions FOR SELECT TO authenticated USING (true);

-- Policy: Authorized users can insert inventory transactions
CREATE POLICY "Authorized users can insert inventory transactions" 
  ON public.inventory_transactions FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'user'))
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.inventory_transactions TO authenticated;
