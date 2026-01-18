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

  describe('getById', () => {
    it('should fetch a document by ID with tax record', async () => {
      const mockDocument = {
        id: 'doc-1',
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'tax-doc.pdf',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      };

      const mockTaxQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'tax-1', document_id: 'doc-1' },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockTaxQueryChain);

      const result = await vehicleDocumentService.getById('doc-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('doc-1');
      expect(result?.tax_record).not.toBeNull();
    });

    it('should throw error when document not found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      // getById throws error when document not found (not return null)
      await expect(
        vehicleDocumentService.getById('doc-999')
      ).rejects.toThrow();
    });

    it('should handle insurance document type', async () => {
      const mockDocument = {
        id: 'doc-2',
        vehicle_id: 'vehicle-1',
        document_type: 'insurance',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      };

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

      const result = await vehicleDocumentService.getById('doc-2');

      expect(result?.document_type).toBe('insurance');
      expect(result?.insurance_record).not.toBeNull();
    });
  });

  describe('createDocument', () => {
    it('should create a document with tax record', async () => {
      const mockDocument = {
        id: 'doc-new',
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'tax-doc.pdf',
      };

      const mockTaxRecord = {
        id: 'tax-new',
        document_id: 'doc-new',
        vehicle_id: 'vehicle-1',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      };

      const mockTaxQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockTaxRecord,
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockTaxQueryChain);

      const result = await vehicleDocumentService.createDocument({
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'tax-doc.pdf',
        tax_number: 'TAX123',
        tax_amount: 5000,
      });

      expect(result.id).toBe('doc-new');
      expect(result.tax_record).not.toBeNull();
    });

    it('should create a document with insurance record', async () => {
      const mockDocument = {
        id: 'doc-ins',
        vehicle_id: 'vehicle-1',
        document_type: 'insurance',
        file_url: 'https://example.com/insurance.pdf',
        file_name: 'insurance-doc.pdf',
      };

      const mockInsuranceRecord = {
        id: 'ins-new',
        document_id: 'doc-ins',
        vehicle_id: 'vehicle-1',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      };

      const mockInsuranceQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInsuranceRecord,
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockInsuranceQueryChain);

      const result = await vehicleDocumentService.createDocument({
        vehicle_id: 'vehicle-1',
        document_type: 'insurance',
        file_url: 'https://example.com/insurance.pdf',
        file_name: 'insurance-doc.pdf',
        insurance_provider_name: 'ABC Insurance',
        insurance_policy_number: 'POL123',
        insurance_coverage_type: 'compulsory',
      });

      expect(result.id).toBe('doc-ins');
      expect(result.insurance_record).not.toBeNull();
    });

    it('should throw error when user not authenticated', async () => {
      (supabase.auth.getUser as any).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(
        vehicleDocumentService.createDocument({
          vehicle_id: 'vehicle-1',
          document_type: 'tax',
          file_url: 'https://example.com/doc.pdf',
          file_name: 'tax-doc.pdf',
        })
      ).rejects.toThrow('User not authenticated');
    });

    it('should handle tax record creation error gracefully', async () => {
      const mockDocument = {
        id: 'doc-new',
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'tax-doc.pdf',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDocument,
          error: null,
        }),
      };

      const mockTaxQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Tax record creation failed' },
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockTaxQueryChain);

      // Should not throw - document is created even if tax record fails
      const result = await vehicleDocumentService.createDocument({
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'tax-doc.pdf',
        tax_number: 'TAX123',
      });

      expect(result.id).toBe('doc-new');
      expect(result.tax_record).toBeNull();
    });
  });

  describe('updateDocument', () => {
    it('should update a document', async () => {
      const mockUpdatedDocument = {
        id: 'doc-1',
        vehicle_id: 'vehicle-1',
        document_type: 'tax',
        file_url: 'https://example.com/updated.pdf',
        file_name: 'updated-doc.pdf',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUpdatedDocument,
          error: null,
        }),
      };

      const mockTaxQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'tax-1', document_id: 'doc-1' },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(mockQueryChain)
        .mockReturnValueOnce(mockTaxQueryChain);

      const result = await vehicleDocumentService.updateDocument('doc-1', {
        file_name: 'updated-doc.pdf',
      });

      expect(result.id).toBe('doc-1');
      expect(result.file_name).toBe('updated-doc.pdf');
    });

    it('should throw error when document not found', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await expect(
        vehicleDocumentService.updateDocument('doc-999', {
          file_name: 'updated.pdf',
        })
      ).rejects.toThrow('Document not found');
    });
  });

  describe('getExpiryByMonth', () => {
    it('should return expiry statistics by month', async () => {
      const mockDocuments = [
        {
          expiry_date: '2024-01-15',
          status: 'active',
        },
        {
          expiry_date: '2024-02-20',
          status: 'expired',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: mockDocuments,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      const result = await vehicleDocumentService.getExpiryByMonth(6);

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('expired');
      expect(result).toHaveProperty('expiring');
      expect(Array.isArray(result.labels)).toBe(true);
    });

    it('should use default 6 months when not specified', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      const result = await vehicleDocumentService.getExpiryByMonth();

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('expired');
      expect(result).toHaveProperty('expiring');
    });

    it('should handle errors when fetching expiry data', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockQueryChain);

      await expect(
        vehicleDocumentService.getExpiryByMonth(6)
      ).rejects.toThrow();
    });
  });
});
