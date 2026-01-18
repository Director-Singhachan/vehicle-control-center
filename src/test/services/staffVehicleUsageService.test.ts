// Unit tests for staffVehicleUsageService
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { staffVehicleUsageService } from '../../../services/staffVehicleUsageService';
import { supabase } from '../../../lib/supabase';

// Mock supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('staffVehicleUsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStaffVehicleUsage', () => {
    it('should return empty summary when no trips found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      expect(result.summary.total_trips).toBe(0);
      expect(result.summary.vehicles_used).toBe(0);
      expect(result.trips).toEqual([]);
    });

    it('should handle date range filters', async () => {
      // The actual code does: .select().eq().order().limit() then conditionally .gte()/.lte()
      // So limit() must return a chainable object, not a promise
      const mockChain = {
        select: vi.fn(),
        eq: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
      };

      // All methods return the chain for chaining
      mockChain.select.mockReturnValue(mockChain);
      mockChain.eq.mockReturnValue(mockChain);
      mockChain.gte.mockReturnValue(mockChain);
      mockChain.lte.mockReturnValue(mockChain);
      mockChain.order.mockReturnValue(mockChain);
      mockChain.limit.mockReturnValue(mockChain);

      // Make the final chain awaitable
      const finalPromise = Promise.resolve({ data: [], error: null });
      Object.assign(mockChain, {
        then: finalPromise.then.bind(finalPromise),
        catch: finalPromise.catch.bind(finalPromise),
      });

      (supabase.from as any).mockReturnValue(mockChain);

      await staffVehicleUsageService.getStaffVehicleUsage('staff-123', {
        from: '2024-01-01',
        to: '2024-12-31',
      });

      expect(mockChain.gte).toHaveBeenCalledWith('start_at', '2024-01-01');
      expect(mockChain.lte).toHaveBeenCalledWith('start_at', '2024-12-31');
    });

    it('should handle errors gracefully', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'DB_ERROR' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await expect(
        staffVehicleUsageService.getStaffVehicleUsage('staff-123')
      ).rejects.toThrow();
    });

    it('should calculate summary with trips and vehicles', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100,
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: 100,
          duration_hours: 10,
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T18:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };

      const finalPromise = Promise.resolve({ data: mockHistory, error: null });
      Object.assign(mockQueryChain, {
        then: finalPromise.then.bind(finalPromise),
        catch: finalPromise.catch.bind(finalPromise),
      });

      // Mock multiple calls to supabase.from
      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        callCount++;
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          const tripChain = { ...mockQueryChain };
          const tripPromise = Promise.resolve({ data: mockTrips, error: null });
          Object.assign(tripChain, {
            then: tripPromise.then.bind(tripPromise),
            catch: tripPromise.catch.bind(tripPromise),
          });
          return tripChain;
        } else if (table === 'trip_logs') {
          const logChain = { ...mockQueryChain };
          const logPromise = Promise.resolve({ data: mockTripLogs, error: null });
          Object.assign(logChain, {
            then: logPromise.then.bind(logPromise),
            catch: logPromise.catch.bind(logPromise),
          });
          return logChain;
        } else if (table === 'vehicles') {
          const vehicleChain = { ...mockQueryChain };
          const vehiclePromise = Promise.resolve({ data: mockVehicles, error: null });
          Object.assign(vehicleChain, {
            then: vehiclePromise.then.bind(vehiclePromise),
            catch: vehiclePromise.catch.bind(vehiclePromise),
          });
          return vehicleChain;
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      expect(result.summary.total_trips).toBe(1);
      expect(result.summary.vehicles_used).toBe(1);
      expect(result.summary.total_distance_km).toBe(100);
      expect(result.summary.total_duration_hours).toBe(10);
      expect(result.summary.role_counts.driver).toBe(1);
    });

    it('should calculate distance from trip odometer when log distance is missing', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100, // 100 km difference
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: null, // No distance in log
          manual_distance_km: null,
          duration_hours: 10,
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T18:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should calculate distance from odometer (1100 - 1000 = 100)
      expect(result.summary.total_distance_km).toBe(100);
      expect(result.trips[0].distance_km).toBe(100);
    });

    it('should use manual_distance_km when distance_km is missing', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: null,
          odometer_end: null,
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: null,
          manual_distance_km: 150, // Use manual distance
          duration_hours: 10,
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T18:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      expect(result.summary.total_distance_km).toBe(150);
      expect(result.trips[0].distance_km).toBe(150);
    });

    it('should return null distance when odometer_end < odometer_start', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1100,
          odometer_end: 1000, // Invalid: end < start
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: null,
          manual_distance_km: null,
          duration_hours: 10,
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T18:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should return null for invalid odometer reading
      expect(result.trips[0].distance_km).toBeNull();
      expect(result.summary.total_distance_km).toBe(0);
    });

    it('should calculate duration from checkout/checkin times when duration_hours is missing', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100,
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: 100,
          manual_distance_km: null,
          duration_hours: null, // No duration_hours
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T18:00:00Z', // 10 hours difference
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should calculate duration from checkout/checkin (10 hours)
      expect(result.summary.total_duration_hours).toBe(10);
      expect(result.trips[0].duration_hours).toBe(10);
    });

    it('should return null duration when checkout/checkin times are invalid', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100,
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: 100,
          manual_distance_km: null,
          duration_hours: null,
          checkout_time: '2024-01-01T18:00:00Z', // Invalid: checkout > checkin
          checkin_time: '2024-01-01T08:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should return null for invalid time range
      expect(result.trips[0].duration_hours).toBeNull();
      expect(result.summary.total_duration_hours).toBe(0);
    });

    it('should handle multiple trip logs and select the latest one', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100,
        },
      ];

      // Multiple trip logs - should select the one with latest checkout_time
      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: 50,
          duration_hours: 5,
          checkout_time: '2024-01-01T08:00:00Z',
          checkin_time: '2024-01-01T13:00:00Z',
          vehicle_id: 'vehicle-1',
        },
        {
          id: 'log-2',
          delivery_trip_id: 'trip-1',
          distance_km: 100, // This should be used (latest checkout_time)
          duration_hours: 10,
          checkout_time: '2024-01-01T09:00:00Z', // Later time
          checkin_time: '2024-01-01T19:00:00Z',
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should use the latest trip log (log-2 with distance 100)
      expect(result.summary.total_distance_km).toBe(100);
      expect(result.summary.total_duration_hours).toBe(10);
      expect(result.trips[0].distance_km).toBe(100);
    });

    it('should handle trip logs without checkout_time', async () => {
      const mockHistory = [
        {
          delivery_trip_id: 'trip-1',
          trip_number: 'T001',
          staff_id: 'staff-123',
          role: 'driver',
          status: 'completed',
          start_at: '2024-01-01T08:00:00Z',
          end_at: '2024-01-01T18:00:00Z',
        },
      ];

      const mockTrips = [
        {
          id: 'trip-1',
          trip_number: 'T001',
          planned_date: '2024-01-01',
          status: 'completed',
          vehicle_id: 'vehicle-1',
          odometer_start: 1000,
          odometer_end: 1100,
        },
      ];

      const mockTripLogs = [
        {
          id: 'log-1',
          delivery_trip_id: 'trip-1',
          distance_km: null,
          manual_distance_km: null,
          duration_hours: null,
          checkout_time: null, // No checkout time
          checkin_time: null,
          vehicle_id: 'vehicle-1',
        },
      ];

      const mockVehicles = [
        {
          id: 'vehicle-1',
          plate: 'ABC-1234',
          make: 'Toyota',
          model: 'Hiace',
        },
      ];

      const mockQueryChain = createMockChain({ data: mockHistory, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'delivery_trip_crew_history') {
          return mockQueryChain;
        } else if (table === 'delivery_trips') {
          return createMockChain({ data: mockTrips, error: null });
        } else if (table === 'trip_logs') {
          return createMockChain({ data: mockTripLogs, error: null });
        } else if (table === 'vehicles') {
          return createMockChain({ data: mockVehicles, error: null });
        }
        return mockQueryChain;
      });

      const result = await staffVehicleUsageService.getStaffVehicleUsage('staff-123');

      // Should fallback to odometer calculation when log has no times
      expect(result.summary.total_distance_km).toBe(100); // From odometer
      expect(result.trips[0].distance_km).toBe(100);
      expect(result.trips[0].duration_hours).toBeNull(); // No duration available
    });
  });
});

// Helper function to create mock chain
function createMockChain(result: { data: any; error: any }) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };

  const finalPromise = Promise.resolve(result);
  Object.assign(mockChain, {
    then: finalPromise.then.bind(finalPromise),
    catch: finalPromise.catch.bind(finalPromise),
  });

  return mockChain;
}
