# Supabase Connection Timeout Fix

## Problem
The application was experiencing timeouts when fetching dashboard data. Logs showed that `vehicleService` was hanging at `Checking authentication...`, causing all parallel requests in `useDashboard` to time out after 30 seconds.

The root cause was identified as `supabase.auth.getSession()` hanging indefinitely in some scenarios, likely due to token refresh issues or client state desynchronization. Additionally, `authStore` was skipping session verification when cached data was present, potentially leaving the Supabase client in an uninitialized state.

## Changes Made

### 1. `stores/authStore.ts`
- **Modified**: Removed the early return in `initialize` when cached data is present.
- **Reason**: Ensures that `supabase.auth.getSession()` is always called (in the background) to verify the session and sync the Supabase client, even if we show cached data to the user immediately.

### 2. `services/vehicleService.ts`
- **Modified**: Added a 5-second timeout to `supabase.auth.getSession()`.
- **Modified**: Added a fallback mechanism to use the user from `useAuthStore` if `getSession` times out or fails.
- **Reason**: Prevents the dashboard data fetch from hanging indefinitely if the Supabase client is unresponsive. Allows the application to proceed with the cached user if available.

### 3. `lib/supabase.ts`
- **Modified**: Added a 5-second timeout to `getCurrentUser` (which calls `getSession`).
- **Reason**: Prevents other parts of the application (like profile fetching) from hanging if the Supabase client is unresponsive.

## Verification
- **Debug Script**: Verified that Supabase credentials and network connection are working correctly using a Node.js script.
- **Code Logic**: The new timeout logic ensures that the application will not hang for more than 5 seconds during auth checks, allowing it to fail gracefully or use fallback data instead of timing out the entire dashboard.

## Next Steps
- The user should reload the application.
- If the issue persists (e.g. actual network blocking), the application will now show a specific error or fallback state instead of an infinite loading spinner or generic timeout.
