# Supabase Connection Timeout Fix & Query Optimization

## Problem
The application was experiencing timeouts when fetching dashboard data. Logs showed that `vehicleService` was hanging at `Checking authentication...`, causing all parallel requests in `useDashboard` to time out after 30 seconds. Additionally, queries were fetching all columns (`select('*')`), which increased load and latency.

## Changes Made

### 1. `stores/authStore.ts`
- **Modified**: Removed the early return in `initialize` when cached data is present.
- **Reason**: Ensures that `supabase.auth.getSession()` is always called (in the background) to verify the session and sync the Supabase client, even if we show cached data to the user immediately.

### 2. `services/vehicleService.ts`
- **Modified**: Added a 5-second timeout to `supabase.auth.getSession()`.
- **Modified**: Added a fallback mechanism to use the user from `useAuthStore` if `getSession` times out or fails.
- **Optimized**: 
    - `getDashboardData`: Selected only necessary columns (`id, plate, status, fuel_level, battery_level, last_updated, location, speed, driver_name`).
    - `getSummary`: Used `Promise.all` to run count queries in parallel.
    - `getLocations`: Selected only necessary columns (`id, plate, make, model, status, lat, lng, last_fuel_efficiency`).

### 3. `services/reportsService.ts`
- **Optimized**:
    - `getFinancials`: Used `Promise.all` to fetch today's and yesterday's costs in parallel.
    - `getMaintenanceTrends`: Used `Promise.all` and selected only necessary columns (`cost`, `created_at`).

### 4. `services/usageService.ts`
- **Optimized**:
    - `getDailyUsage`: Selected only necessary columns (`day, active_vehicles`).

### 5. `lib/supabase.ts`
- **Modified**: Added a 5-second timeout to `getCurrentUser` (which calls `getSession`).
- **Reason**: Prevents other parts of the application (like profile fetching) from hanging if the Supabase client is unresponsive.

## Verification
- **Debug Script**: Verified that Supabase credentials and network connection are working correctly using a Node.js script.
- **Code Logic**: The new timeout logic ensures that the application will not hang for more than 5 seconds during auth checks.
- **Query Optimization**: Reduced payload size and improved concurrency for dashboard data fetching.

## Next Steps
- The user should reload the application.
- If the issue persists (e.g. actual network blocking), the application will now show a specific error or fallback state instead of an infinite loading spinner or generic timeout.
