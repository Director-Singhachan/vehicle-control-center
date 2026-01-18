// Unit tests for searchUtils
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchWithMultipleFields } from '../../../utils/searchUtils';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('searchUtils', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };
  });

  describe('searchWithMultipleFields', () => {
    it('should return empty array when search term is empty', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await searchWithMultipleFields(
        mockSupabase as any,
        'products',
        '',
        ['product_name', 'product_code']
      );

      expect(result).toEqual([]);
    });

    it('should search across multiple fields and remove duplicates', async () => {
      const mockData1 = [{ id: '1', name: 'Product A' }];
      const mockData2 = [{ id: '1', name: 'Product A' }, { id: '2', name: 'Product B' }];

      const mockQuery1 = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: mockData1,
          error: null,
        }),
      };

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: mockData2,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockQuery1)
        .mockReturnValueOnce(mockQuery2);

      const result = await searchWithMultipleFields(
        mockSupabase as any,
        'products',
        'product',
        ['product_name', 'product_code']
      );

      // Should remove duplicate id '1'
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.id)).toEqual(['1', '2']);
    });

    it('should apply additional filters', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await searchWithMultipleFields(
        mockSupabase as any,
        'products',
        'test',
        ['product_name'],
        { is_active: true }
      );

      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should handle errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(
        searchWithMultipleFields(
          mockSupabase as any,
          'products',
          'test',
          ['product_name']
        )
      ).rejects.toThrow();
    });
  });
});
