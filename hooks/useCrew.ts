// Custom hooks for crew management
import { useState, useEffect, useCallback, useMemo } from 'react';
import { crewService, type CrewMemberWithDetails, type CommissionCalculationResult, type StaffCommissionDetail, type TripCommissionStatus } from '../services/crewService';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];
type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];
type CommissionLog = Database['public']['Tables']['commission_logs']['Row'];

/**
 * Hook to fetch crew members for a delivery trip
 * @param tripId - UUID of the delivery trip
 * @param activeOnly - If true, only fetch active crew members
 */
export function useCrewByTrip(tripId: string | null, activeOnly: boolean = false) {
    const [crew, setCrew] = useState<CrewMemberWithDetails[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tripId) {
            setCrew([]);
            return;
        }

        let cancelled = false;

        const fetchCrew = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await crewService.getCrewByTripId(tripId, activeOnly);
                if (!cancelled) {
                    setCrew(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error('Failed to fetch crew'));
                    console.error('[useCrewByTrip] Error:', err);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchCrew();

        return () => {
            cancelled = true;
        };
    }, [tripId, activeOnly]);

    const refresh = async () => {
        if (!tripId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await crewService.getCrewByTripId(tripId, activeOnly);
            setCrew(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to refresh crew'));
            console.error('[useCrewByTrip] Refresh error:', err);
        } finally {
            setLoading(false);
        }
    };

    return { crew, loading, error, refresh };
}

/**
 * Hook to fetch commission logs for a delivery trip
 * @param tripId - UUID of the delivery trip
 */
export function useCommissionLogs(tripId: string | null) {
    const [logs, setLogs] = useState<CommissionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tripId) {
            setLogs([]);
            return;
        }

        let cancelled = false;

        const fetchLogs = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await crewService.getCommissionLogsByTripId(tripId);
                if (!cancelled) {
                    setLogs(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error('Failed to fetch commission logs'));
                    console.error('[useCommissionLogs] Error:', err);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchLogs();

        return () => {
            cancelled = true;
        };
    }, [tripId]);

    const refresh = async () => {
        if (!tripId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await crewService.getCommissionLogsByTripId(tripId);
            setLogs(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to refresh commission logs'));
            console.error('[useCommissionLogs] Refresh error:', err);
        } finally {
            setLoading(false);
        }
    };

    return { logs, loading, error, refresh };
}

/**
 * Hook for crew management operations
 * Provides functions for assigning, swapping, and managing crew
 */
export function useCrewManagement() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const assignCrew = async (
        tripId: string,
        staffIds: string[],
        role: 'driver' | 'helper'
    ): Promise<CrewMemberWithDetails[] | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.assignCrewToTrip(tripId, staffIds, role);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to assign crew');
            setError(error);
            console.error('[useCrewManagement] Assign error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const swapCrew = async (
        tripId: string,
        oldStaffId: string,
        newStaffId: string,
        reason: string
    ): Promise<CrewMemberWithDetails | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.swapCrewMember(tripId, oldStaffId, newStaffId, reason);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to swap crew member');
            setError(error);
            console.error('[useCrewManagement] Swap error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const removeCrew = async (
        tripId: string,
        staffId: string,
        reason: string
    ): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            await crewService.removeCrewMember(tripId, staffId, reason);
            return true;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to remove crew member');
            setError(error);
            console.error('[useCrewManagement] Remove error:', err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        assignCrew,
        swapCrew,
        removeCrew,
        loading,
        error,
    };
}

/**
 * Hook for commission calculation
 * Provides functions to calculate and save commissions
 */
export function useCommissionCalculation() {
    const [calculation, setCalculation] = useState<CommissionCalculationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const calculateCommission = async (tripId: string): Promise<CommissionCalculationResult | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await crewService.calculateCommission(tripId);
            setCalculation(result);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to calculate commission');
            setError(error);
            setCalculation(null);
            console.error('[useCommissionCalculation] Calculate error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const saveCommission = async (
        calculationResult: CommissionCalculationResult
    ): Promise<CommissionLog[] | null> => {
        setLoading(true);
        setError(null);

        try {
            const logs = await crewService.saveCommissionLogs(calculationResult);
            return logs;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save commission');
            setError(error);
            console.error('[useCommissionCalculation] Save error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const calculateAndSave = async (tripId: string): Promise<CommissionLog[] | null> => {
        setLoading(true);
        setError(null);

        try {
            // Use Edge Function instead of client-side calculation to avoid RLS and concurrency issues
            const result = await crewService.calculateCommissionViaFunction(tripId);
            
            if (!result.success) {
                // Get more detailed error message from result
                const errorMessage = result.reason === 'trip_not_completed'
                    ? 'ทริปยังไม่เสร็จสมบูรณ์ กรุณาเช็คอินทริปก่อน'
                    : result.reason === 'no_items'
                    ? 'ไม่มีสินค้าที่ส่งแล้วในทริปนี้'
                    : result.reason === 'no_rate'
                    ? 'ไม่พบอัตราค่าคอมมิชชั่นที่เหมาะสม กรุณาตรวจสอบการตั้งค่าอัตราค่าคอม'
                    : result.reason === 'zero_commission'
                    ? 'ค่าคอมมิชชั่นที่คำนวณได้เป็นศูนย์ ไม่มีข้อมูลที่จะบันทึก'
                    : result.reason === 'no_crew'
                    ? 'ไม่พบข้อมูลพนักงานในทริปนี้'
                    : result.message || 'การคำนวณล้มเหลว กรุณาตรวจสอบข้อมูลทริป';
                
                throw new Error(errorMessage);
            }

            // After successful calculation via function, fetch the logs to show in UI
            const logs = await crewService.getCommissionLogsByTripId(tripId);
            
            // Also refresh local state if needed (optional since we return logs)
            // But we can't easily set calculation result from logs here without more mapping
            
            return logs;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to calculate and save commission');
            setError(error);
            setCalculation(null);
            console.error('[useCommissionCalculation] Calculate and save error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        calculation,
        calculateCommission,
        saveCommission,
        calculateAndSave,
        loading,
        error,
    };
}

/**
 * Hook to fetch trips pending commission calculation
 */
export function usePendingCommissionTrips() {
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchTrips = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await crewService.getPendingCommissionTrips();
            setTrips(data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch pending trips'));
            console.error('[usePendingCommissionTrips] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrips();
    }, []);

    return { trips, loading, error, refresh: fetchTrips };
}

/**
 * Hook to fetch detailed commission data grouped by staff with trip-level breakdown.
 * Used for the commission dashboard staff summary tab.
 */
export function useDetailedCommissionByStaff(startDate: Date, endDate: Date) {
    const [data, setData] = useState<StaffCommissionDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const depKey = useMemo(
        () => `${startDate.getTime()}-${endDate.getTime()}`,
        [startDate.getTime(), endDate.getTime()]
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await crewService.getDetailedCommissionByStaff(startDate, endDate);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch detailed commission data'));
            console.error('[useDetailedCommissionByStaff] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [depKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch all trips with their commission calculation status.
 * Used for the trip verification tab.
 */
export function useTripsWithCommissionStatus(startDate: Date, endDate: Date) {
    const [trips, setTrips] = useState<TripCommissionStatus[]>([]);
    const [stats, setStats] = useState({ total: 0, calculated: 0, pending: 0, totalCommission: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const depKey = useMemo(
        () => `${startDate.getTime()}-${endDate.getTime()}`,
        [startDate.getTime(), endDate.getTime()]
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await crewService.getTripsWithCommissionStatus(startDate, endDate);
            setTrips(result.trips);
            setStats(result.stats);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch trip commission status'));
            console.error('[useTripsWithCommissionStatus] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [depKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { trips, stats, loading, error, refresh: fetchData };
}

/**
 * Hook for batch commission calculation with progress tracking.
 */
export function useBatchCommission() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const batchCalculate = useCallback(async (tripIds: string[]) => {
        if (tripIds.length === 0) return null;

        setLoading(true);
        setError(null);
        setResult(null);
        setProgress({ current: 0, total: tripIds.length });

        try {
            const res = await crewService.batchCalculatePending(
                tripIds,
                (current, total) => {
                    setProgress({ current, total });
                }
            );
            setResult(res);
            return res;
        } catch (err) {
            const e = err instanceof Error ? err : new Error('Batch calculation failed');
            setError(e);
            console.error('[useBatchCommission] Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setProgress({ current: 0, total: 0 });
        setResult(null);
        setError(null);
    }, []);

    return { batchCalculate, loading, progress, result, error, reset };
}