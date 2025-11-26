-- ========================================
-- Allow Drivers to View Other Drivers' Profile Names
-- แก้ไขให้พนักงานขับรถสามารถเห็นชื่อของพนักงานขับรถคนอื่นได้
-- ========================================

-- Drop existing policy
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

-- Create new policy that includes drivers
CREATE POLICY "Users can view basic profile info"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid() -- User can see themselves
    OR
    public.has_role(auth.uid(), ARRAY['manager', 'executive', 'admin', 'inspector']) -- Staff can see everyone
    OR
    public.has_role(auth.uid(), ARRAY['driver']) -- Drivers can see other drivers' names
  );

-- Comment
COMMENT ON POLICY "Users can view basic profile info" ON public.profiles IS 
  'Allows users to see their own profile, staff to see all profiles, and drivers to see other drivers names for trip coordination';
