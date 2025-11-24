# Task: Optimize Supabase Connection and Eliminate Timeouts

- [ ] **Analyze & Configure Supabase Client** <!-- id: 0 -->
    - [ ] Review `lib/supabase.ts` client configuration (timeouts, retries). <!-- id: 1 -->
    - [ ] Optimize `auth` settings (autoRefreshToken, persistSession). <!-- id: 2 -->
- [ ] **Implement Robust Data Fetching** <!-- id: 3 -->
    - [ ] Increase timeouts in `useDashboard.ts` (30s -> 60s/90s) to accommodate slow networks. <!-- id: 4 -->
    - [ ] Implement retry logic for failed requests in `vehicleService.ts` and others. <!-- id: 5 -->
    - [ ] Optimize `getSummary` to be even lighter (remove unnecessary auth checks if possible or cache them). <!-- id: 6 -->
- [ ] **Verify & Polish** <!-- id: 7 -->
    - [ ] Test with simulated slow network. <!-- id: 8 -->
    - [ ] Ensure UI handles loading states gracefully without "flashing" errors. <!-- id: 9 -->
