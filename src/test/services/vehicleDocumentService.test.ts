// Unit tests for vehicleDocumentService
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleDocumentService } from '../../../services/vehicleDocumentService';
import { supabase } from '../../../lib/supabase';

// Mock supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  },
}));

describe('vehicleDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByVehicle', () => {
    it('should fetch documents for a vehicle', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          vehicle_id: 'vehicle-1',
          document_type: 'tax',
          file_url: 'https://example.com/doc.pdf',
          file_name: 'tax-doc.pdf',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };

      // Mock the order chain to return resolved value on second call
      mockQueryChain.order
        .mockReturnValueOnce(mockQueryChain) // First order call
        .mockResolvedValueOnce({
          data: mockDocuments,
          error: null,
        }); // Second order call resolves

      (supabase.from as any).mockReturnValue(mockQueryChain);

      // Mock tax record query
      const mockTaxQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'tax-1', document_id: 'doc-1' },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain) // First call for documents
        .mockReturnValueOnce(mockTaxQueryChain); // Second call for tax record

      const result = await vehicleDocumentService.getByVehicle('vehicle-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-1');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('vehicle_id', 'vehicle-1');
    });

    it('should handle errors when fetching documents', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };

      // Mock the order chain to return error on second call
      mockQueryChain.order
        .mockReturnValueOnce(mockQueryChain) // First order call
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }); // Second order call resolves with error

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await expect(
        vehicleDocumentService.getByVehicle('vehicle-1')
      ).rejects.toThrow();
    });

    it('should handle insurance documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-2',
          vehicle_id: 'vehicle-1',
          document_type: 'insurance',
          file_url: 'https://example.com/insurance.pdf',
          file_name: 'insurance-doc.pdf',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };

      mockQueryChain.order
        .mockReturnValueOnce(mockQueryChain)
        .mockResolvedValueOnce({
          data: mockDocuments,
          error: null,
        });

      const mockInsuranceQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'ins-1', document_id: 'doc-2' },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockInsuranceQueryChain);

      const result = await vehicleDocumentService.getByVehicle('vehicle-1');

      expect(result).toHaveLength(1);
      expect(result[0].document_type).toBe('insurance');
    });
  });

  describe('getByVehicleAndType', () => {
    it('should fetch documents by type', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          vehicle_id: 'vehicle-1',
          document_type: 'tax',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };

      mockQueryChain.order
        .mockReturnValueOnce(mockQueryChain)
        .mockResolvedValueOnce({
          data: mockDocuments,
          error: null,
        });

      // Mock tax record query with single()
      const mockTaxQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'tax-1', document_id: 'doc-1' },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain) // First call for documents
        .mockReturnValueOnce(mockTaxQueryChain); // Second call for tax record

      const result = await vehicleDocumentService.getByVehicleAndType('vehicle-1', 'tax');

      expect(result).toHaveLength(1);
      expect(result[0].document_type).toBe('tax');
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await vehicleDocumentService.deleteDocument('doc-1');

      expect(mockQueryChain.delete).toHaveBeenCalled();
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'doc-1');
    });

    it('should handle errors when deleting', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Delete failed' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await expect(
        vehicleDocumentService.deleteDocument('doc-1')
      ).rejects.toThrow();
    });
  });
});
