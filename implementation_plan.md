# Implementation Plan - Supabase Connection Optimization

## Goal
Eliminate persistent timeouts (30s/60s) and `getSession` hangs by optimizing the Supabase client configuration, implementing robust retry logic, and increasing fetch timeouts to accommodate slower network conditions.

## Proposed Changes

### 1. `lib/supabase.ts`
- **Configure Client**: Add `fetch` custom implementation with increased timeout.
- **Optimize Auth**: Adjust `autoRefreshToken` and `persistSession` settings if needed.
- **Timeout Adjustment**: Increase `getCurrentUser` timeout from 5s to 10s.

### 2. `services/vehicleService.ts` (and other services)
- **Retry Logic**: Implement a helper function `fetchWithRetry` to automatically retry failed requests (e.g., 3 attempts).
- **Optimization**: Ensure `getSummary` is as lightweight as possible.

### 3. `hooks/useDashboard.ts`
- **Increase Timeouts**: Increase individual API timeouts from 30s to 60s.
- **Global Timeout**: Increase global race timeout from 60s to 90s.
- **Staggered Loading**: (Optional) Consider loading critical data first (Summary) then others.

## Verification Plan

### Automated Verification
- **Unit Tests**: None available for network conditions.

### Manual Verification
- **Network Throttling**: Use browser dev tools to simulate "Slow 3G" and verify the app doesn't crash or hang indefinitely.
- **Disconnect/Reconnect**: Disconnect internet while loading, then reconnect to see if retries work.
- **Logs**: Check console for "Retry attempt X..." messages.
