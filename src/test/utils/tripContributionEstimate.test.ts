import { describe, it, expect } from 'vitest';
import {
  deriveTripDateRangeFromForm,
  computeContributionTotals,
  computePersonnelCostForTrip,
  getTripRangeFromTripRow,
  getDatesInRange,
} from '../../../utils/tripContributionEstimate';

describe('tripContributionEstimate', () => {
  describe('deriveTripDateRangeFromForm', () => {
    it('uses start and end when both provided', () => {
      const r = deriveTripDateRangeFromForm('2025-01-15', '2025-01-10', '2025-01-12');
      expect(r.start).toBe('2025-01-10');
      expect(r.end).toBe('2025-01-12');
      expect(r.days).toBe(3);
    });

    it('falls back to planned_date single day when no range', () => {
      const r = deriveTripDateRangeFromForm('2025-03-01', '', '');
      expect(r.days).toBe(1);
      expect(r.start).toBe('2025-03-01');
      expect(r.end).toBe('2025-03-01');
    });
  });

  describe('getTripRangeFromTripRow', () => {
    it('uses trip_start_date and trip_end_date', () => {
      const r = getTripRangeFromTripRow({
        planned_date: '2025-01-01',
        trip_start_date: '2025-01-05',
        trip_end_date: '2025-01-07',
      });
      expect(r.days).toBe(3);
    });

    it('falls back to planned_date', () => {
      const r = getTripRangeFromTripRow({
        planned_date: '2025-02-01',
        trip_start_date: null,
        trip_end_date: null,
      });
      expect(r.days).toBe(1);
    });
  });

  describe('getDatesInRange', () => {
    it('includes both endpoints', () => {
      expect(getDatesInRange('2025-01-01', '2025-01-03')).toEqual([
        '2025-01-01',
        '2025-01-02',
        '2025-01-03',
      ]);
    });
  });

  describe('computeContributionTotals', () => {
    it('subtracts costs from revenue', () => {
      const r = computeContributionTotals({
        revenue: 10000,
        fixedCost: 2000,
        fuelCost: 500,
        personnelCost: 1500,
      });
      expect(r.totalCost).toBe(4000);
      expect(r.estimatedContribution).toBe(6000);
    });
  });

  describe('computePersonnelCostForTrip', () => {
    it('divides daily rate by trips same day (others + 1)', () => {
      const others = new Map<string, number>();
      others.set('s1:2025-01-01', 1);
      const salaryRows = [
        {
          staff_id: 's1',
          effective_from: '2025-01-01',
          effective_to: null,
          monthly_salary: 30000,
        },
      ];
      const cost = computePersonnelCostForTrip(['s1'], ['2025-01-01'], others, salaryRows);
      const daily = 30000 / 30;
      expect(cost).toBeCloseTo(daily / 2);
    });

    it('uses divisor 1 when no other trips', () => {
      const others = new Map<string, number>();
      const salaryRows = [
        {
          staff_id: 's1',
          effective_from: '2025-01-01',
          effective_to: null,
          monthly_salary: 30000,
        },
      ];
      const cost = computePersonnelCostForTrip(['s1'], ['2025-01-01'], others, salaryRows);
      const daily = 30000 / 30;
      expect(cost).toBeCloseTo(daily);
    });
  });
});
