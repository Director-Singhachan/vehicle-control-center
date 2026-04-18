import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockQuery {
  table: string;
  operation: 'select' | 'update';
  filters: Record<string, unknown>;
  updatePayload?: unknown;
}

const executedQueries: MockQuery[] = [];
const queryPlans: Array<{
  when: (query: MockQuery) => boolean;
  result: { data?: unknown; error?: unknown };
}> = [];
const mockGetUser = vi.fn();

function resetMockDb() {
  executedQueries.length = 0;
  queryPlans.length = 0;
}

function planQuery(
  when: (query: MockQuery) => boolean,
  result: { data?: unknown; error?: unknown }
) {
  queryPlans.push({ when, result });
}

function resolveQuery(query: MockQuery) {
  executedQueries.push({
    ...query,
    filters: { ...query.filters },
  });

  const plan = queryPlans.find((entry) => entry.when(query));
  if (!plan) {
    throw new Error(`Unexpected query: ${query.operation} ${query.table} ${JSON.stringify(query.filters)}`);
  }

  return Promise.resolve({
    data: plan.result.data ?? null,
    error: plan.result.error ?? null,
  });
}

function createChain(table: string) {
  const query: MockQuery = {
    table,
    operation: 'select',
    filters: {},
  };

  const chain: any = {
    select: () => {
      query.operation = 'select';
      return chain;
    },
    update: (payload: unknown) => {
      query.operation = 'update';
      query.updatePayload = payload;
      return chain;
    },
    eq: (column: string, value: unknown) => {
      query.filters[`eq:${column}`] = value;
      return chain;
    },
    in: (column: string, value: unknown) => {
      query.filters[`in:${column}`] = value;
      return chain;
    },
    lte: (column: string, value: unknown) => {
      query.filters[`lte:${column}`] = value;
      return chain;
    },
    gte: (column: string, value: unknown) => {
      query.filters[`gte:${column}`] = value;
      return chain;
    },
    lt: (column: string, value: unknown) => {
      query.filters[`lt:${column}`] = value;
      return chain;
    },
    is: (column: string, value: unknown) => {
      query.filters[`is:${column}`] = value;
      return chain;
    },
    neq: (column: string, value: unknown) => {
      query.filters[`neq:${column}`] = value;
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolveQuery(query).then(onFulfilled, onRejected),
  };

  return chain;
}

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    from: (table: string) => createChain(table),
  },
}));

import { tripStatusService } from '../../../services/deliveryTrip/tripStatusService';

describe('tripStatusService.syncStatusWithTripLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('does not guess by vehicle+date when multiple pending trips share the same vehicle/date', async () => {
    planQuery(
      (query) =>
        query.table === 'delivery_trips' &&
        query.operation === 'select' &&
        Array.isArray(query.filters['in:status']),
      {
        data: [
          {
            id: 'trip-1',
            trip_number: 'DT-1',
            vehicle_id: 'vehicle-1',
            driver_id: 'driver-1',
            planned_date: '2026-04-16',
            status: 'planned',
            odometer_start: null,
            odometer_end: null,
          },
          {
            id: 'trip-2',
            trip_number: 'DT-2',
            vehicle_id: 'vehicle-1',
            driver_id: 'driver-1',
            planned_date: '2026-04-16',
            status: 'in_progress',
            odometer_start: null,
            odometer_end: null,
          },
        ],
      }
    );

    planQuery(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'select' &&
        query.filters['eq:delivery_trip_id'] === 'trip-1',
      { data: [] }
    );

    planQuery(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'select' &&
        query.filters['eq:delivery_trip_id'] === 'trip-2',
      { data: [] }
    );

    const syncQuantityDeliveredForCompletedTrip = vi.fn();
    const result = await tripStatusService.syncStatusWithTripLogs.call({
      syncQuantityDeliveredForCompletedTrip,
    });

    expect(result).toEqual({ updated: 0, details: [] });
    expect(syncQuantityDeliveredForCompletedTrip).not.toHaveBeenCalled();
    expect(
      executedQueries.some(
        (query) =>
          query.table === 'trip_logs' &&
          query.operation === 'select' &&
          query.filters['is:delivery_trip_id'] === null
      )
    ).toBe(false);
    expect(
      executedQueries.some(
        (query) => query.table === 'delivery_trips' && query.operation === 'update'
      )
    ).toBe(false);
  });

  it('uses a single unlinked checked-in trip log only when there is one pending trip for that vehicle/date', async () => {
    planQuery(
      (query) =>
        query.table === 'delivery_trips' &&
        query.operation === 'select' &&
        Array.isArray(query.filters['in:status']),
      {
        data: [
          {
            id: 'trip-1',
            trip_number: 'DT-1',
            vehicle_id: 'vehicle-1',
            driver_id: 'driver-1',
            planned_date: '2026-04-16',
            status: 'planned',
            odometer_start: null,
            odometer_end: null,
          },
        ],
      }
    );

    planQuery(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'select' &&
        query.filters['eq:delivery_trip_id'] === 'trip-1',
      { data: [] }
    );

    planQuery(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'select' &&
        query.filters['eq:vehicle_id'] === 'vehicle-1' &&
        query.filters['is:delivery_trip_id'] === null,
      {
        data: [
          {
            id: 'log-1',
            driver_id: 'driver-actual',
            odometer_start: 1000,
            odometer_end: 1100,
            checkout_time: '2026-04-16T08:00:00',
            checkin_time: '2026-04-16T10:00:00',
            status: 'checked_in',
            delivery_trip_id: null,
          },
        ],
      }
    );

    planQuery(
      (query) =>
        query.table === 'delivery_trips' &&
        query.operation === 'update' &&
        query.filters['eq:id'] === 'trip-1',
      { data: [] }
    );

    planQuery(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'update' &&
        query.filters['eq:id'] === 'log-1',
      { data: [] }
    );

    planQuery(
      (query) =>
        query.table === 'delivery_trip_stores' &&
        query.operation === 'update' &&
        query.filters['eq:delivery_trip_id'] === 'trip-1',
      { data: [] }
    );

    const syncQuantityDeliveredForCompletedTrip = vi.fn().mockResolvedValue(undefined);
    const result = await tripStatusService.syncStatusWithTripLogs.call({
      syncQuantityDeliveredForCompletedTrip,
    });

    expect(result.updated).toBe(1);
    expect(result.details[0]).toMatchObject({
      trip_id: 'trip-1',
      trip_number: 'DT-1',
      old_status: 'planned',
      new_status: 'completed',
    });
    expect(syncQuantityDeliveredForCompletedTrip).toHaveBeenCalledWith('trip-1');

    const tripLogLinkUpdate = executedQueries.find(
      (query) =>
        query.table === 'trip_logs' &&
        query.operation === 'update' &&
        query.filters['eq:id'] === 'log-1'
    );
    expect(tripLogLinkUpdate?.updatePayload).toEqual({ delivery_trip_id: 'trip-1' });
  });
});
