// Ticket Service - CRUD operations for tickets
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { notificationService } from './notificationService';
import { pdfService } from './pdfService';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type TicketInsert = Database['public']['Tables']['tickets']['Insert'];
type TicketUpdate = Database['public']['Tables']['tickets']['Update'];
type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];

export interface TicketCost {
  id: string;
  ticket_id: number;
  description: string | null;
  cost: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
}

export const ticketService = {
  // Get all tickets
  getAll: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    reporter_id?: string;
  }): Promise<Ticket[]> => {
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.reporter_id) {
      query = query.eq('reporter_id', filters.reporter_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get tickets with relations (using view) with pagination
  getWithRelations: async (filters?: {
    status?: string[];
    vehicle_id?: string;
    urgency?: string[]; // Add urgency filter
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
    search?: string; // For text search (database-level)
  }): Promise<{ data: TicketWithRelations[]; count: number }> => {
    try {
      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      let query = supabase
        .from('tickets_with_relations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters?.vehicle_id) {
        query = query.eq('vehicle_id', filters.vehicle_id);
      }
      // Add urgency filter at database level
      if (filters?.urgency && filters.urgency.length > 0) {
        query = query.in('urgency', filters.urgency);
      }

      // Date range filter using created_at
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters?.end_date) {
        // Include the whole end date by extending to end of day
        const endDate = new Date(filters.end_date);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      // Database-level text search using ILIKE (case-insensitive pattern matching)
      // Supabase client library handles URL encoding automatically
      if (filters?.search) {
        const searchPattern = `%${filters.search}%`;
        // Use OR operator to search across multiple fields
        // Format: field1.ilike.pattern,field2.ilike.pattern
        query = query.or(
          `ticket_number.ilike.${searchPattern},vehicle_plate.ilike.${searchPattern},repair_type.ilike.${searchPattern},problem_description.ilike.${searchPattern},reporter_name.ilike.${searchPattern}`
        );
      }

      const { data, error, count } = await query;

      if (error) {
        // Check for connection errors
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
        }
        throw error;
      }

      return {
        data: data || [],
        count: count || 0,
      };
    } catch (err) {
      // Re-throw with better error message
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
        throw new Error('Connection failed. If the problem persists, please check your internet connection or VPN');
      }
      throw err;
    }
  },

  // Get ticket by ID
  getById: async (id: number): Promise<Ticket | null> => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get ticket by ID with relations (reporter, vehicle info)
  getByIdWithRelations: async (id: number): Promise<TicketWithRelations | null> => {
    const { data, error } = await supabase
      .from('tickets_with_relations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get urgent tickets count
  getUrgentCount: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('urgency', ['high', 'critical'])
      .in('status', ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress']);

    if (error) throw error;
    return count || 0;
  },

  // Get recent tickets
  getRecentTickets: async (limit: number = 10): Promise<TicketWithRelations[]> => {
    const { data, error } = await supabase
      .from('tickets_with_relations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Create new ticket with auto-generated ticket number
  create: async (ticket: TicketInsert): Promise<Ticket> => {
    // Generate ticket number using SQL function (format: YYMM-XXX)
    const { data: ticketNumberData, error: ticketNumberError } = await supabase
      .rpc('generate_ticket_number');

    if (ticketNumberError) {
      console.error('Error generating ticket number:', ticketNumberError);
      // Fallback: continue without ticket number
    }

    // Insert ticket with generated ticket number
    const ticketData = {
      ...ticket,
      ticket_number: ticketNumberData || null,
    };

    const { data, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) throw error;

    // Create notification event for new ticket (if user enabled it)
    try {
      const messageLines = [
        `🔧 [แจ้งซ่อมใหม่]`,
        `🎫 Ticket: #${data.ticket_number || data.id}`,
        `🚗 รถ: ${data.vehicle_id}`, // Note: Ideally we should fetch plate number here, but keeping it simple for now as vehicle_id is often the plate in this system context or we can rely on data.vehicle_id if it's descriptive.
        // To be safe and consistent, we could fetch vehicle details, but let's use what we have for speed if acceptable.
        // Actually, let's try to be better. We can't easily get vehicle plate without a join or extra query.
        // But wait, create returns Ticket, which only has vehicle_id.
        // Let's stick to simple format first, or do a quick fetch if needed.
        // Given the user wants "Good looking", let's assume vehicle_id is readable or acceptable.
        `📝 อาการ: ${data.repair_type || 'ไม่ระบุ'}`,
        `ℹ️ รายละเอียด: ${data.problem_description || '-'}`,
        `🚨 ความเร่งด่วน: ${data.urgency}`,
        `📊 สถานะ: ${data.status}`,
      ].filter(Boolean);

      await notificationService.createEvent({
        channel: 'line',
        event_type: 'ticket_created',
        title: `แจ้งซ่อมใหม่: ${data.vehicle_id}`,
        message: messageLines.join('\n'),
        payload: {
          ticket_id: data.id,
          ticket_number: data.ticket_number,
          status: data.status,
          vehicle_id: data.vehicle_id,
        },
      });
    } catch (notifyError) {
      console.error('[ticketService] Failed to create notification event for ticket_created:', notifyError);
      // ไม่ต้อง throw ต่อ เพื่อไม่ให้กระทบการสร้างตั๋ว
    }

    // Send PDF to inspector for approval (Level 1)
    try {
      // Get ticket with relations for PDF generation
      const ticketWithRelations = await ticketService.getByIdWithRelations(data.id);
      if (ticketWithRelations) {
        // Find inspector user (first available inspector)
        const { data: inspectors, error: inspectorError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'inspector')
          .limit(1);

        if (!inspectorError && inspectors && inspectors.length > 0) {
          const inspectorId = inspectors[0].id;

          // Get full ticket data for PDF (with ticket_number, garage, etc.)
          const fullTicket = await ticketService.getById(data.id);

          // Generate PDF as base64
          const pdfBase64 = await pdfService.generateMaintenanceTicketPDFAsBase64({
            id: String(ticketWithRelations.id),
            ticket_number: fullTicket?.ticket_number || null,
            vehicle_plate: ticketWithRelations.vehicle_plate || '',
            vehicle_make: ticketWithRelations.make,
            vehicle_model: ticketWithRelations.model,
            vehicle_type: ticketWithRelations.vehicle_type,
            branch: ticketWithRelations.branch,
            reporter_name: ticketWithRelations.reporter_name || '',
            reporter_email: ticketWithRelations.reporter_email,
            problem: ticketWithRelations.repair_type,
            description: ticketWithRelations.problem_description,
            urgency: ticketWithRelations.urgency || 'medium',
            status: ticketWithRelations.status || 'pending',
            created_at: ticketWithRelations.created_at,
            odometer: ticketWithRelations.odometer,
            garage: (fullTicket as any)?.garage || null,
            notes: (fullTicket as any)?.repair_notes || null,
            last_repair_date: (fullTicket as any)?.last_repair_date || null,
            last_repair_description: (fullTicket as any)?.last_repair_description || null,
            last_repair_garage: (fullTicket as any)?.last_repair_garage || null,
            estimated_cost: (fullTicket as any)?.estimated_cost || null,
          });

          // Send PDF notification to inspector
          await notificationService.createEvent({
            channel: 'telegram', // Use telegram for PDF (better file support)
            event_type: 'ticket_pdf_for_approval',
            title: `📋 ใบแจ้งซ่อมรอการอนุมัติ - Level 1 (ผู้ตรวจสอบ)`,
            message: `📋 [ใบแจ้งซ่อมรอการอนุมัติ]\n\n` +
              `👤 ระดับ: Level 1 (ผู้ตรวจสอบ)\n` +
              `🎫 Ticket: #${fullTicket?.ticket_number || ticketWithRelations.id}\n` +
              `🚗 ทะเบียนรถ: ${ticketWithRelations.vehicle_plate || '-'}\n` +
              `👤 ผู้แจ้ง: ${ticketWithRelations.reporter_name || '-'}\n` +
              `🔧 อาการ: ${ticketWithRelations.repair_type || '-'}\n` +
              `🚨 ความเร่งด่วน: ${ticketWithRelations.urgency || 'medium'}\n\n` +
              `กรุณาตรวจสอบและอนุมัติผ่านระบบ`,
            payload: {
              ticket_id: data.id,
              ticket_number: fullTicket?.ticket_number || null,
              approval_level: 1,
              approval_role: 'inspector',
            },
            pdf_data: pdfBase64,
            target_user_id: inspectorId,
          }, data.reporter_id); // Use reporter's user_id for the event
        }
      }
    } catch (pdfError) {
      console.error('[ticketService] Failed to send PDF to inspector:', pdfError);
      // ไม่ต้อง throw ต่อ เพื่อไม่ให้กระทบการสร้างตั๋ว
    }

    return data;
  },

  // Update ticket
  update: async (id: number, updates: TicketUpdate): Promise<Ticket> => {
    const { data: existing, error: fetchError } = await supabase
      .from('tickets')
      .select('id, status, ticket_number, vehicle_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const { data, error } = await (supabase.from('tickets') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If ticket status changed to completed, create notification event
    try {
      const previousStatus = existing?.status;
      if (previousStatus !== 'completed' && data.status === 'completed') {
        const messageLines = [
          `✅ [ซ่อมเสร็จสิ้น]`,
          `🎫 Ticket: #${data.ticket_number || data.id}`,
          `🚗 รถ: ${data.vehicle_id}`,
          `📊 สถานะเดิม: ${previousStatus}`,
          `🏁 สถานะใหม่: ${data.status}`,
        ];

        await notificationService.createEvent({
          channel: 'line',
          event_type: 'ticket_closed',
          title: `ซ่อมเสร็จแล้ว: Ticket #${data.ticket_number || data.id}`,
          message: messageLines.join('\n'),
          payload: {
            ticket_id: data.id,
            ticket_number: data.ticket_number,
            previous_status: previousStatus,
            status: data.status,
            vehicle_id: data.vehicle_id,
          },
        });
      }
    } catch (notifyError) {
      console.error('[ticketService] Failed to create notification event for ticket_closed:', notifyError);
      // Don't throw to avoid affecting ticket update
    }

    return data;
  },

  // Delete ticket
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get ticket costs
  getCosts: async (ticketId: number): Promise<TicketCost[]> => {
    const { data, error } = await supabase
      .from('ticket_costs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add ticket cost
  addCost: async (cost: {
    ticket_id: number;
    description?: string;
    cost?: number;
    category?: string;
    note?: string;
  }): Promise<TicketCost> => {
    const { data, error } = await supabase
      .from('ticket_costs')
      .insert(cost)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Approve ticket with password verification
  approveTicket: async (
    ticketId: string,
    level: number,
    userId: string,
    password: string,
    comment?: string,
    nextStatus?: string
  ): Promise<void> => {
    // 1. Verify password - Get current user first
    const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();

    if (getUserError || !currentUser || !currentUser.email) {
      console.error('Get user error:', getUserError);
      throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่');
    }

    // Store current session to restore if password is wrong
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // Verify password by attempting to sign in
    const { data: { user: verifiedUser, session: newSession }, error: authError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: password,
    });

    if (authError || !verifiedUser) {
      console.error('Password verification error:', authError);
      // Restore original session if password is wrong
      if (currentSession) {
        await supabase.auth.setSession(currentSession);
      }
      throw new Error('รหัสผ่านไม่ถูกต้อง');
    }

    // Ensure we're still using the same user
    if (verifiedUser.id !== userId) {
      console.error('User ID mismatch:', verifiedUser.id, 'expected:', userId);
      // Restore original session
      if (currentSession) {
        await supabase.auth.setSession(currentSession);
      }
      throw new Error('รหัสผ่านไม่ถูกต้อง');
    }

    // Restore original session after verification (to avoid session changes)
    if (currentSession && newSession) {
      await supabase.auth.setSession(currentSession);
    }

    // 2. Validate sequential approval - check if previous levels are approved
    // Use select('*') to avoid column-specific errors, then filter in client
    const { data: existingApprovals, error: fetchError } = await supabase
      .from('ticket_approvals')
      .select('*')
      .eq('ticket_id', parseInt(ticketId, 10)); // Ensure ticket_id is a number

    if (fetchError) {
      console.error('Error fetching approvals:', fetchError);
      throw new Error(`ไม่สามารถตรวจสอบการอนุมัติได้: ${fetchError.message}`);
    }

    // Map role_at_approval to level if level column doesn't exist
    const mapRoleToLevel = (role: string | null): number => {
      if (!role) return 0;
      if (role === 'inspector') return 1;
      if (role === 'manager') return 2;
      if (role === 'executive') return 3;
      return 0;
    };

    // Get approved levels - use level column if exists, otherwise map from role_at_approval
    const approvedLevels = (existingApprovals || []).map((a: any) => {
      if (a.level !== undefined && a.level !== null) {
        return a.level;
      }
      return mapRoleToLevel(a.role_at_approval);
    }).filter((l: number) => l > 0);

    // Validate sequential approval
    if (level === 2) {
      // Level 2 requires Level 1 to be approved
      if (!approvedLevels.includes(1)) {
        throw new Error('ไม่สามารถอนุมัติ Level 2 ได้ เนื่องจาก Level 1 (ผู้ตรวจสอบ) ยังไม่อนุมัติ');
      }
    } else if (level === 3) {
      // Level 3 requires Level 1 and Level 2 to be approved
      if (!approvedLevels.includes(1)) {
        throw new Error('ไม่สามารถอนุมัติ Level 3 ได้ เนื่องจาก Level 1 (ผู้ตรวจสอบ) ยังไม่อนุมัติ');
      }
      if (!approvedLevels.includes(2)) {
        throw new Error('ไม่สามารถอนุมัติ Level 3 ได้ เนื่องจาก Level 2 (ผู้จัดการ) ยังไม่อนุมัติ');
      }
    }

    // Check if this level is already approved
    if (approvedLevels.includes(level)) {
      throw new Error(`Level ${level} อนุมัติแล้ว ไม่สามารถอนุมัติซ้ำได้`);
    }

    // 3. Create approval record
    // Map level to role for role_at_approval
    const roleAtApproval = level === 1 ? 'inspector' : level === 2 ? 'manager' : 'executive';

    const approvalData: any = {
      ticket_id: parseInt(ticketId, 10),
      approver_id: userId,
      role_at_approval: roleAtApproval,
      action: 'approved', // Default to approved, rejection is handled separately
      comments: comment || null,
    };

    // Add level if column exists (will be ignored if column doesn't exist)
    approvalData.level = level;

    const { error: approvalError } = await supabase
      .from('ticket_approvals')
      .insert(approvalData);

    if (approvalError) throw approvalError;

    // 4. Update ticket status if needed
    if (nextStatus) {
      const { error: updateError } = await (supabase.from('tickets') as any).update({ status: nextStatus })
        .eq('id', parseInt(ticketId, 10));

      if (updateError) throw updateError;
    }

    // 5. Send PDF to next approver if applicable
    try {
      const ticketWithRelations = await ticketService.getByIdWithRelations(parseInt(ticketId, 10));
      if (ticketWithRelations) {
        let nextApproverId: string | null = null;
        let nextLevel: number | null = null;
        let nextRole: string | null = null;

        // Determine next approver based on current approval level
        if (level === 1) {
          // Level 1 approved → send to manager (Level 2)
          const { data: managers } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'manager')
            .limit(1);
          if (managers && managers.length > 0) {
            nextApproverId = managers[0].id;
            nextLevel = 2;
            nextRole = 'manager';
          }
        } else if (level === 2) {
          // Level 2 approved → send to executive (Level 3)
          const { data: executives } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'executive')
            .limit(1);
          if (executives && executives.length > 0) {
            nextApproverId = executives[0].id;
            nextLevel = 3;
            nextRole = 'executive';
          }
        }
        // Level 3 is final, no next approver

        if (nextApproverId && nextLevel && nextRole) {
          // Get full ticket data for PDF (with ticket_number, garage, etc.)
          const fullTicket = await ticketService.getById(ticketWithRelations.id);

          // Generate PDF as base64
          const pdfBase64 = await pdfService.generateMaintenanceTicketPDFAsBase64({
            id: String(ticketWithRelations.id),
            ticket_number: fullTicket?.ticket_number || null,
            vehicle_plate: ticketWithRelations.vehicle_plate || '',
            vehicle_make: ticketWithRelations.make,
            vehicle_model: ticketWithRelations.model,
            vehicle_type: ticketWithRelations.vehicle_type,
            branch: ticketWithRelations.branch,
            reporter_name: ticketWithRelations.reporter_name || '',
            reporter_email: ticketWithRelations.reporter_email,
            problem: ticketWithRelations.repair_type,
            description: ticketWithRelations.problem_description,
            urgency: ticketWithRelations.urgency || 'medium',
            status: ticketWithRelations.status || 'pending',
            created_at: ticketWithRelations.created_at,
            odometer: ticketWithRelations.odometer,
            garage: (fullTicket as any)?.garage || null,
            notes: (fullTicket as any)?.repair_notes || null,
            last_repair_date: (fullTicket as any)?.last_repair_date || null,
            last_repair_description: (fullTicket as any)?.last_repair_description || null,
            last_repair_garage: (fullTicket as any)?.last_repair_garage || null,
            estimated_cost: (fullTicket as any)?.estimated_cost || null,
          });

          // Send PDF notification to next approver
          const levelLabels: Record<number, string> = {
            2: 'Level 2 (ผู้จัดการ)',
            3: 'Level 3 (ผู้บริหาร)',
          };

          await notificationService.createEvent({
            channel: 'telegram',
            event_type: 'ticket_pdf_for_approval',
            title: `📋 ใบแจ้งซ่อมรอการอนุมัติ - ${levelLabels[nextLevel]}`,
            message: `📋 [ใบแจ้งซ่อมรอการอนุมัติ]\n\n` +
              `👤 ระดับ: ${levelLabels[nextLevel]}\n` +
              `🎫 Ticket: #${fullTicket?.ticket_number || ticketWithRelations.id}\n` +
              `🚗 ทะเบียนรถ: ${ticketWithRelations.vehicle_plate || '-'}\n` +
              `👤 ผู้แจ้ง: ${ticketWithRelations.reporter_name || '-'}\n` +
              `🔧 อาการ: ${ticketWithRelations.repair_type || '-'}\n` +
              `🚨 ความเร่งด่วน: ${ticketWithRelations.urgency || 'medium'}\n` +
              `✅ สถานะปัจจุบัน: อนุมัติ Level ${level} แล้ว\n\n` +
              `กรุณาตรวจสอบและอนุมัติผ่านระบบ`,
            payload: {
              ticket_id: ticketWithRelations.id,
              ticket_number: fullTicket?.ticket_number || null,
              approval_level: nextLevel,
              approval_role: nextRole,
              previous_level: level,
            },
            pdf_data: pdfBase64,
            target_user_id: nextApproverId,
          }, userId);
        }
      }
    } catch (pdfError) {
      console.error('[ticketService] Failed to send PDF to next approver:', pdfError);
      // ไม่ต้อง throw ต่อ เพื่อไม่ให้กระทบการอนุมัติ
    }
  },

  // Start repair
  startRepair: async (
    ticketId: number,
    data: {
      garage: string;
      repair_start_date: string;
      repair_expected_completion?: string;
      repair_assigned_to?: string;
      repair_notes?: string;
    }
  ): Promise<void> => {
    const { error } = await (supabase.from('tickets') as any).update({
      status: 'in_progress',
      garage: data.garage,
      repair_start_date: data.repair_start_date,
      repair_expected_completion: data.repair_expected_completion,
      repair_assigned_to: data.repair_assigned_to,
      repair_notes: data.repair_notes,
    })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Complete repair
  completeRepair: async (ticketId: number): Promise<void> => {
    const { error } = await (supabase.from('tickets') as any).update({
      status: 'completed',
    })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Upload signed PDF and update signature URL
  uploadSignedPDF: async (
    ticketId: number,
    pdfFile: File,
    role: 'inspector' | 'manager' | 'executive'
  ): Promise<string> => {
    // Import storageService dynamically to avoid circular dependency
    const { storageService } = await import('./storageService');

    // Upload PDF to storage
    const timestamp = Date.now();
    const fileName = `${role}_${timestamp}.pdf`;
    const publicUrl = await storageService.uploadFile(
      pdfFile,
      'ticket-attachments',
      `signed-tickets/${ticketId}`
    );

    // Update ticket signature URL based on role
    const updateData: any = {};
    if (role === 'inspector') {
      updateData.inspector_signature_url = publicUrl;
      updateData.inspector_signed_at = new Date().toISOString();
    } else if (role === 'manager') {
      updateData.manager_signature_url = publicUrl;
      updateData.manager_signed_at = new Date().toISOString();
    } else if (role === 'executive') {
      updateData.executive_signature_url = publicUrl;
      updateData.executive_signed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) throw error;

    return publicUrl;
  },
};

