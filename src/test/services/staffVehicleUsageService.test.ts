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
  });
});
