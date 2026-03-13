// vehicleTripUsageService.test.ts
// Unit tests for vehicleTripUsageService (mocks tripLogService)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────
// Mock tripLogService BEFORE importing the service
// ─────────────────────────────────────────────────
const mockGetTripHistory = vi.fn();
vi.mock('../../../services/tripLogService', () => ({
  tripLogService: {
    getTripHistory: (...args: any[]) => mockGetTripHistory(...args),
  },
}));

import { vehicleTripUsageService } from '../../../services/vehicleTripUsageService';

// ─────────────────────────────────────────────────
// Helpers to build fake TripLogWithRelations
// ─────────────────────────────────────────────────
function makeTrip(overrides: {
  id: string;
  checkout_time: string;
  checkin_time?: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  manual_distance_km?: number | null;
  driver_full_name?: string;
  delivery_trip_id?: string | null;
  trip_number?: string | null;
  status?: string;
}) {
  return {
    id: overrides.id,
    vehicle_id: 'vehicle-1',
    driver_id: 'driver-1',
    checkout_time: overrides.checkout_time,
    checkin_time: overrides.checkin_time ?? null,
    odometer_start: overrides.odometer_start ?? null,
    odometer_end: overrides.odometer_end ?? null,
    manual_distance_km: overrides.manual_distance_km ?? null,
    destination: null,
    route: null,
    notes: null,
    status: overrides.status ?? 'checked_in',
    delivery_trip_id: overrides.delivery_trip_id ?? null,
    driver: { full_name: overrides.driver_full_name ?? 'คนขับ A', email: '' },
    vehicle: { plate: 'ทะ-0001', make: 'Toyota', model: 'Hiace' },
    delivery_trip: overrides.delivery_trip_id
      ? { id: overrides.delivery_trip_id, trip_number: overrides.trip_number ?? 'T001', status: 'completed' }
      : null,
    created_at: overrides.checkout_time,
    updated_at: overrides.checkout_time,
  };
}

// ─────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────

describe('vehicleTripUsageService.getVehicleDailyUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when there are no trips', async () => {
    mockGetTripHistory.mockResolvedValue({ data: [], count: 0 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
    });

    expect(result).toEqual([]);
    expect(mockGetTripHistory).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle_id: 'vehicle-1' })
    );
  });

  it('groups trips by day (UTC+7) correctly', async () => {
    // Trip ออก 2025-01-01T17:00:00Z = 2025-01-02T00:00+07 (วันที่ 2)
    // Trip ออก 2025-01-01T06:00:00Z = 2025-01-01T13:00+07 (วันที่ 1)
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z', odometer_start: 1000, odometer_end: 1100 }),
      makeTrip({ id: 't2', checkout_time: '2025-01-01T17:00:00Z', odometer_start: 1100, odometer_end: 1200 }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 2 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
    });

    expect(result).toHaveLength(2);
    // เรียงจากใหม่ → เก่า
    expect(result[0].date).toBe('2025-01-02');
    expect(result[1].date).toBe('2025-01-01');
  });

  it('sums distances per day (odometer)', async () => {
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z', odometer_start: 1000, odometer_end: 1050 }),
      makeTrip({ id: 't2', checkout_time: '2025-01-01T09:00:00Z', odometer_start: 1050, odometer_end: 1100 }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 2 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
    });

    expect(result).toHaveLength(1);
    expect(result[0].trip_count).toBe(2);
    expect(result[0].total_distance_km).toBe(100);
  });

  it('uses manual_distance_km when available', async () => {
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z', manual_distance_km: 75 }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 1 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
    });

    expect(result[0].total_distance_km).toBe(75);
    expect(result[0].trips[0].is_manual_distance).toBe(true);
  });

  it('collects unique drivers per day', async () => {
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z', driver_full_name: 'นาย ก' }),
      makeTrip({ id: 't2', checkout_time: '2025-01-01T09:00:00Z', driver_full_name: 'นาย ก' }),
      makeTrip({ id: 't3', checkout_time: '2025-01-01T13:00:00Z', driver_full_name: 'นาย ข' }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 3 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
    });

    expect(result[0].drivers).toHaveLength(2);
    expect(result[0].drivers).toContain('นาย ก');
    expect(result[0].drivers).toContain('นาย ข');
  });

  it('includes trips without delivery_trip_id', async () => {
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z', delivery_trip_id: null }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 1 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
    });

    expect(result[0].trips[0].delivery_trip_id).toBeNull();
    expect(result[0].trips[0].trip_number).toBeNull();
  });

  it('handles multiple days and sorts newest first', async () => {
    const trips = [
      makeTrip({ id: 't1', checkout_time: '2025-01-01T06:00:00Z' }),
      makeTrip({ id: 't2', checkout_time: '2025-01-03T06:00:00Z' }),
      makeTrip({ id: 't3', checkout_time: '2025-01-02T06:00:00Z' }),
    ];
    mockGetTripHistory.mockResolvedValue({ data: trips, count: 3 });

    const result = await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01',
      endDate: '2025-01-03',
    });

    expect(result.map((r) => r.date)).toEqual(['2025-01-03', '2025-01-02', '2025-01-01']);
  });

  it('passes full ISO datetime when input is already a datetime string', async () => {
    mockGetTripHistory.mockResolvedValue({ data: [], count: 0 });

    await vehicleTripUsageService.getVehicleDailyUsage({
      vehicleId: 'vehicle-1',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-01-07T23:59:59.999Z',
    });

    const callArgs = mockGetTripHistory.mock.calls[0][0];
    expect(callArgs.start_date).toBe('2025-01-01T00:00:00.000Z');
    expect(callArgs.end_date).toBe('2025-01-07T23:59:59.999Z');
  });
});
