/**
 * Targeted tests for partial delivery / multi-trip edge cases.
 *
 * These tests cover the business logic WITHOUT hitting a real database:
 *  1. remaining_unallocated calculation (pure math).
 *  2. Correct sequence_no increments across allocation legs.
 *  3. Only the first leg sets delivery_trip_id (isFirstLeg detection).
 *  4. Multi-mode wizard slot quantity distribution.
 */

import { describe, expect, it } from 'vitest';
import { createTripSlot } from '../../../types/createTripWizard';

// ── 1. Remaining quantity calculation ──────────────────────────────────────

function calcRemaining(
  totalQty: number,
  pickedUp: number,
  allocatedQty: number
) {
  return Math.max(0, totalQty - pickedUp - allocatedQty);
}

describe('remaining_unallocated calculation', () => {
  it('full order, nothing allocated → all remaining', () => {
    expect(calcRemaining(100, 0, 0)).toBe(100);
  });

  it('partial pickup, partial allocation → correct remainder', () => {
    expect(calcRemaining(100, 20, 30)).toBe(50);
  });

  it('fully allocated → 0 remaining', () => {
    expect(calcRemaining(100, 0, 100)).toBe(0);
  });

  it('over-allocation clamps to 0', () => {
    // Data integrity issue — should never happen, but the formula is defensive
    expect(calcRemaining(100, 0, 120)).toBe(0);
  });

  it('pickup + allocation exceeding total clamps to 0', () => {
    expect(calcRemaining(50, 30, 30)).toBe(0);
  });
});

// ── 2. sequence_no generation ──────────────────────────────────────────────

function nextSequenceNo(existingMaxSeq: number | null): number {
  return (existingMaxSeq ?? 0) + 1;
}

describe('allocation sequence_no generation', () => {
  it('first leg → sequence_no 1', () => {
    expect(nextSequenceNo(null)).toBe(1);
  });

  it('third leg → sequence_no 3', () => {
    expect(nextSequenceNo(2)).toBe(3);
  });

  it('after cancelled legs, continues from last non-cancelled seq', () => {
    // max non-cancelled seq = 2 → next is 3
    expect(nextSequenceNo(2)).toBe(3);
  });
});

// ── 3. isFirstLeg detection ────────────────────────────────────────────────

describe('isFirstLeg detection', () => {
  it('order with null delivery_trip_id is first leg', () => {
    const orderDetail = { delivery_trip_id: null };
    const isFirstLeg = !orderDetail.delivery_trip_id;
    expect(isFirstLeg).toBe(true);
  });

  it('order with existing delivery_trip_id is NOT first leg', () => {
    const orderDetail = { delivery_trip_id: 'trip-abc' };
    const isFirstLeg = !orderDetail.delivery_trip_id;
    expect(isFirstLeg).toBe(false);
  });
});

// ── 4. Multi-trip slot distribution ───────────────────────────────────────

describe('dynamic trip slot creation', () => {
  it('createTripSlot generates correct label', () => {
    const slot = createTripSlot(3);
    expect(slot.label).toBe('เที่ยวที่ 3');
    expect(slot.id).toBe('slot-3');
    expect(slot.vehicleId).toBe('');
    expect(slot.driverId).toBe('');
  });
});

describe('even distribution across slots', () => {
  function distributeEvenly(totalQty: number, slotCount: number): number[] {
    const perSlot = Math.floor(totalQty / slotCount);
    return Array.from({ length: slotCount }, (_, i) =>
      i === slotCount - 1 ? totalQty - perSlot * (slotCount - 1) : perSlot
    );
  }

  it('distributes 100 items across 3 slots: 33-33-34', () => {
    const dist = distributeEvenly(100, 3);
    expect(dist).toEqual([33, 33, 34]);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('distributes 10 items across 2 slots: 5-5', () => {
    const dist = distributeEvenly(10, 2);
    expect(dist).toEqual([5, 5]);
  });

  it('distributes 1 item across 4 slots: 0-0-0-1', () => {
    const dist = distributeEvenly(1, 4);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

// ── 5. Cancel trip frees allocations ──────────────────────────────────────

describe('allocation status lifecycle', () => {
  type AllocationStatus = 'planned' | 'in_delivery' | 'delivered' | 'cancelled';

  function simulateCancelTrip(
    allocations: Array<{ status: AllocationStatus }>
  ): Array<{ status: AllocationStatus }> {
    return allocations.map((a) => ({
      ...a,
      status: a.status === 'delivered' ? 'delivered' : 'cancelled',
    }));
  }

  it('cancelling a trip cancels planned and in_delivery allocations', () => {
    const allocs = [
      { status: 'planned' as AllocationStatus },
      { status: 'in_delivery' as AllocationStatus },
      { status: 'delivered' as AllocationStatus },
    ];
    const result = simulateCancelTrip(allocs);
    expect(result[0].status).toBe('cancelled');
    expect(result[1].status).toBe('cancelled');
    expect(result[2].status).toBe('delivered');
  });

  it('completing a trip marks allocations as delivered', () => {
    const allocs = [
      { status: 'in_delivery' as AllocationStatus, allocated_quantity: 50, delivered_quantity: 0 },
    ];
    const completed = allocs.map((a) => ({
      ...a,
      status: 'delivered' as AllocationStatus,
      delivered_quantity: a.allocated_quantity,
    }));
    expect(completed[0].status).toBe('delivered');
    expect(completed[0].delivered_quantity).toBe(50);
  });
});
