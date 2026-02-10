// Vehicle Document Service - CRUD operations for vehicle documents
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleDocument = Database['public']['Tables']['vehicle_documents']['Row'];
type VehicleDocumentInsert = Database['public']['Tables']['vehicle_documents']['Insert'];
type VehicleDocumentUpdate = Database['public']['Tables']['vehicle_documents']['Update'];
type VehicleTaxRecord = Database['public']['Tables']['vehicle_tax_records']['Row'];
type VehicleTaxRecordInsert = Database['public']['Tables']['vehicle_tax_records']['Insert'];
type VehicleInsuranceRecord = Database['public']['Tables']['vehicle_insurance_records']['Row'];
type VehicleInsuranceRecordInsert = Database['public']['Tables']['vehicle_insurance_records']['Insert'];

export interface CreateDocumentParams {
  vehicle_id: string;
  document_type: VehicleDocument['document_type'];
  file_url: string;
  file_name: string;
  mime_type?: string;
  issued_date?: string;
  expiry_date?: string;
  remind_before_days?: number;
  notes?: string;
  // Tax-specific fields
  tax_number?: string;
  tax_amount?: number;
  tax_paid_date?: string;
  tax_receipt_number?: string;
  // Insurance-specific fields
  insurance_provider_name?: string;
  insurance_policy_number?: string;
  insurance_coverage_type?: 'compulsory' | 'voluntary' | 'both';
  insurance_coverage_amount?: number;
  insurance_premium_amount?: number;
  insurance_contact_phone?: string;
}

export interface DocumentWithDetails extends VehicleDocument {
  tax_record?: VehicleTaxRecord | null;
  insurance_record?: VehicleInsuranceRecord | null;
  vehicle?: {
    id: string;
    plate: string;
    make?: string | null;
    model?: string | null;
    image_url?: string | null;
  } | null;
}

export const vehicleDocumentService = {
  /**
   * Get all documents for a vehicle
   */
  getByVehicle: async (vehicleId: string): Promise<DocumentWithDetails[]> => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('expiry_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch tax and insurance records for each document
    const documentsWithDetails: DocumentWithDetails[] = await Promise.all(
      (data || []).map(async (doc) => {
        const details: DocumentWithDetails = { ...doc };

        if (doc.document_type === 'tax') {
          const { data: taxData } = await supabase
            .from('vehicle_tax_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.tax_record = taxData || null;
        }

        if (doc.document_type === 'insurance') {
          const { data: insuranceData } = await supabase
            .from('vehicle_insurance_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.insurance_record = insuranceData || null;
        }

        return details;
      })
    );

    return documentsWithDetails;
  },

  /**
   * Get documents by type for a vehicle
   */
  getByVehicleAndType: async (
    vehicleId: string,
    documentType: VehicleDocument['document_type']
  ): Promise<DocumentWithDetails[]> => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('document_type', documentType)
      .order('expiry_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch tax and insurance records
    const documentsWithDetails: DocumentWithDetails[] = await Promise.all(
      (data || []).map(async (doc) => {
        const details: DocumentWithDetails = { ...doc };

        if (doc.document_type === 'tax') {
          const { data: taxData } = await supabase
            .from('vehicle_tax_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.tax_record = taxData || null;
        }

        if (doc.document_type === 'insurance') {
          const { data: insuranceData } = await supabase
            .from('vehicle_insurance_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.insurance_record = insuranceData || null;
        }

        return details;
      })
    );

    return documentsWithDetails;
  },

  /**
   * Get a single document by ID
   */
  getById: async (documentId: string): Promise<DocumentWithDetails | null> => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    if (!data) return null;

    const details: DocumentWithDetails = { ...data };

    if (data.document_type === 'tax') {
      const { data: taxData } = await supabase
        .from('vehicle_tax_records')
        .select('*')
        .eq('document_id', data.id)
        .maybeSingle();
      details.tax_record = taxData || null;
    }

    if (data.document_type === 'insurance') {
      const { data: insuranceData } = await supabase
        .from('vehicle_insurance_records')
        .select('*')
        .eq('document_id', data.id)
        .maybeSingle();
      details.insurance_record = insuranceData || null;
    }

    return details;
  },

  /**
   * Create a new document
   */
  createDocument: async (params: CreateDocumentParams): Promise<DocumentWithDetails> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Create document record
    const documentData: VehicleDocumentInsert = {
      vehicle_id: params.vehicle_id,
      document_type: params.document_type,
      file_url: params.file_url,
      file_name: params.file_name,
      mime_type: params.mime_type,
      issued_date: params.issued_date,
      expiry_date: params.expiry_date,
      remind_before_days: params.remind_before_days,
      notes: params.notes,
      status: 'active',
      created_by: user.id,
    };

    const { data: document, error: docError } = await supabase
      .from('vehicle_documents')
      .insert(documentData)
      .select()
      .single();

    if (docError) throw docError;
    if (!document) throw new Error('Failed to create document');

    const details: DocumentWithDetails = { ...document, tax_record: null, insurance_record: null };

    // Create tax record if applicable
    if (params.document_type === 'tax' && (
      params.tax_number ||
      params.tax_amount ||
      params.tax_paid_date ||
      params.tax_receipt_number
    )) {
      const taxData: VehicleTaxRecordInsert = {
        vehicle_id: params.vehicle_id,
        document_id: document.id,
        tax_number: params.tax_number,
        amount: params.tax_amount,
        paid_date: params.tax_paid_date,
        receipt_number: params.tax_receipt_number,
        notes: params.notes,
        created_by: user.id,
      };

      const { data: taxRecord, error: taxError } = await supabase
        .from('vehicle_tax_records')
        .insert(taxData)
        .select()
        .single();

      if (taxError) {
        console.error('Error creating tax record:', taxError);
        // Don't throw - document is already created
      } else {
        details.tax_record = taxRecord;
      }
    }

    // Create insurance record if applicable
    if (params.document_type === 'insurance' && (
      params.insurance_provider_name ||
      params.insurance_policy_number ||
      params.insurance_coverage_type
    )) {
      const insuranceData: VehicleInsuranceRecordInsert = {
        vehicle_id: params.vehicle_id,
        document_id: document.id,
        provider_name: params.insurance_provider_name,
        policy_number: params.insurance_policy_number,
        coverage_type: params.insurance_coverage_type,
        coverage_amount: params.insurance_coverage_amount,
        premium_amount: params.insurance_premium_amount,
        contact_phone: params.insurance_contact_phone,
        notes: params.notes,
        created_by: user.id,
      };

      const { data: insuranceRecord, error: insuranceError } = await supabase
        .from('vehicle_insurance_records')
        .insert(insuranceData)
        .select()
        .single();

      if (insuranceError) {
        console.error('Error creating insurance record:', insuranceError);
        // Don't throw - document is already created
      } else {
        details.insurance_record = insuranceRecord;
      }
    }

    return details;
  },

  /**
   * Update a document
   */
  updateDocument: async (
    documentId: string,
    updates: VehicleDocumentUpdate
  ): Promise<DocumentWithDetails> => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Document not found');

    const details: DocumentWithDetails = { ...data, tax_record: null, insurance_record: null };

    // Fetch related records
    if (data.document_type === 'tax') {
      const { data: taxData } = await supabase
        .from('vehicle_tax_records')
        .select('*')
        .eq('document_id', data.id)
        .maybeSingle();
      details.tax_record = taxData || null;
    }

    if (data.document_type === 'insurance') {
      const { data: insuranceData } = await supabase
        .from('vehicle_insurance_records')
        .select('*')
        .eq('document_id', data.id)
        .maybeSingle();
      details.insurance_record = insuranceData || null;
    }

    return details;
  },

  /**
   * Delete a document
   */
  deleteDocument: async (documentId: string): Promise<void> => {
    const { error } = await supabase
      .from('vehicle_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  /**
   * Get documents expiring soon
   */
  /**
   * Get document expiry statistics by month
   */
  getExpiryByMonth: async (months: number = 6): Promise<{
    labels: string[];
    expired: number[];
    expiring: number[];
  }> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('vehicle_documents')
      .select('expiry_date, status')
      .not('expiry_date', 'is', null)
      .gte('expiry_date', startDate.toISOString().split('T')[0])
      .lte('expiry_date', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Group by month
    const monthMap = new Map<string, { expired: number; expiring: number }>();
    
    // Initialize all months (past and future)
    for (let i = -months; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(monthKey, { expired: 0, expiring: 0 });
    }

    (data || []).forEach((doc) => {
      if (!doc.expiry_date) return;
      
      const expiryDate = new Date(doc.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const monthKey = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthMap.has(monthKey)) {
        const stats = monthMap.get(monthKey)!;
        if (expiryDate < today || doc.status === 'expired') {
          stats.expired++;
        } else {
          stats.expiring++;
        }
        monthMap.set(monthKey, stats);
      }
    });

    // Convert to arrays (only show last N months)
    const labels: string[] = [];
    const expired: number[] = [];
    const expiring: number[] = [];

    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    // Get last N months
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const stats = monthMap.get(monthKey) || { expired: 0, expiring: 0 };
      
      labels.push(`${monthNames[date.getMonth()]} ${date.getFullYear()}`);
      expired.push(stats.expired);
      expiring.push(stats.expiring);
    }

    return { labels, expired, expiring };
  },

  getExpiringSoon: async (days: number = 30): Promise<DocumentWithDetails[]> => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .select(`
        *,
        vehicles!vehicle_documents_vehicle_id_fkey (
          id,
          plate,
          make,
          model,
          image_url
        )
      `)
      .eq('status', 'active')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .order('expiry_date', { ascending: true });

    if (error) throw error;

    // Fetch tax and insurance records
    const documentsWithDetails: DocumentWithDetails[] = await Promise.all(
      (data || []).map(async (doc: any) => {
        const details: DocumentWithDetails = { 
          ...doc,
          vehicle: doc.vehicles ? {
            id: doc.vehicles.id,
            plate: doc.vehicles.plate,
            make: doc.vehicles.make,
            model: doc.vehicles.model,
            image_url: doc.vehicles.image_url,
          } : null,
        };

        if (doc.document_type === 'tax') {
          const { data: taxData } = await supabase
            .from('vehicle_tax_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.tax_record = taxData || null;
        }

        if (doc.document_type === 'insurance') {
          const { data: insuranceData } = await supabase
            .from('vehicle_insurance_records')
            .select('*')
            .eq('document_id', doc.id)
            .maybeSingle();
          details.insurance_record = insuranceData || null;
        }

        return details;
      })
    );

    return documentsWithDetails;
  },
};
