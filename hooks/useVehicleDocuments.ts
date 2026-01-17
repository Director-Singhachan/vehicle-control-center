// useVehicleDocuments - Hook for managing vehicle documents
import { useState, useEffect, useCallback } from 'react';
import { vehicleDocumentService, type DocumentWithDetails } from '../services/vehicleDocumentService';

interface UseVehicleDocumentsOptions {
  vehicleId: string | null;
  documentType?: 'registration' | 'tax' | 'insurance' | 'inspection' | 'other';
  autoFetch?: boolean;
}

export const useVehicleDocuments = ({
  vehicleId,
  documentType,
  autoFetch = true,
}: UseVehicleDocumentsOptions) => {
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!vehicleId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = documentType
        ? await vehicleDocumentService.getByVehicleAndType(vehicleId, documentType)
        : await vehicleDocumentService.getByVehicle(vehicleId);
      setDocuments(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch documents');
      setError(error);
      console.error('[useVehicleDocuments] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, documentType]);

  useEffect(() => {
    if (autoFetch) {
      fetchDocuments();
    }
  }, [autoFetch, fetchDocuments]);

  const refetch = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback((document: DocumentWithDetails) => {
    setDocuments((prev) => [document, ...prev]);
  }, []);

  const updateDocument = useCallback((documentId: string, updates: Partial<DocumentWithDetails>) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === documentId ? { ...doc, ...updates } : doc))
    );
  }, []);

  const removeDocument = useCallback((documentId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  }, []);

  return {
    documents,
    loading,
    error,
    refetch,
    addDocument,
    updateDocument,
    removeDocument,
  };
};

/**
 * Hook for getting documents expiring soon
 */
export const useExpiringDocuments = (days: number = 30) => {
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await vehicleDocumentService.getExpiringSoon(days);
      setDocuments(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch expiring documents');
      setError(error);
      console.error('[useExpiringDocuments] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchExpiring();
  }, [fetchExpiring]);

  return {
    documents,
    loading,
    error,
    refetch: fetchExpiring,
  };
};
