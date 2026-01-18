import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleDocument = Database['public']['Tables']['vehicle_documents']['Row'];

type OwnerGroup = Database['public']['Tables']['vehicles']['Row']['owner_group'];

type DocumentType = VehicleDocument['document_type'];

type DocumentStatus = VehicleDocument['status'];

export type DocumentReportRow = VehicleDocument & {
  vehicle: {
    id: string;
    plate: string;
    make: string | null;
    model: string | null;
    owner_group: OwnerGroup;
    branch: string | null;
  } | null;
};

export interface VehicleDocumentReportFilters {
  documentType?: DocumentType | 'all';
  ownerGroup?: OwnerGroup | 'all';
  status?: DocumentStatus | 'all';
  includeExpired?: boolean;
  periodMonths?: 1 | 3 | 6;
}

const toISODate = (d: Date) => d.toISOString().split('T')[0];

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const vehicleDocumentReportService = {
  getDocumentsReport: async (filters: VehicleDocumentReportFilters): Promise<DocumentReportRow[]> => {
    const periodMonths = filters.periodMonths ?? 1;
    const includeExpired = filters.includeExpired ?? true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = addMonths(today, periodMonths);

    let query = supabase
      .from('vehicle_documents')
      .select(
        `
        *,
        vehicles!vehicle_documents_vehicle_id_fkey(
          id,
          plate,
          make,
          model,
          owner_group,
          branch
        )
      `
      )
      .not('expiry_date', 'is', null)
      .neq('status', 'cancelled')
      .lte('expiry_date', toISODate(endDate))
      .order('expiry_date', { ascending: true, nullsFirst: false });

    if (!includeExpired) {
      query = query.gte('expiry_date', toISODate(today));
    }

    if (filters.documentType && filters.documentType !== 'all') {
      query = query.eq('document_type', filters.documentType);
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.ownerGroup && filters.ownerGroup !== 'all') {
      query = query.eq('vehicles.owner_group', filters.ownerGroup);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      vehicle: row.vehicles
        ? {
            id: row.vehicles.id,
            plate: row.vehicles.plate,
            make: row.vehicles.make,
            model: row.vehicles.model,
            owner_group: row.vehicles.owner_group,
            branch: row.vehicles.branch,
          }
        : null,
    }));
  },
};
