// Notification Service - LINE / Telegram notification settings and events
import { supabase } from '../lib/supabase';

export type NotificationChannel = 'line' | 'telegram';
export type NotificationEventType =
  | 'maintenance_due'
  | 'long_checkout'
  | 'ticket_created'
  | 'ticket_closed'
  | 'trip_started'
  | 'trip_finished'
  | 'daily_usage_summary'
  | 'ticket_pdf_for_approval'
  | 'fuel_refill';

export interface NotificationSettings {
  id?: string;
  user_id: string;
  enable_line: boolean;
  enable_telegram: boolean;
  line_token: string | null;
  line_user_id?: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  notify_maintenance_due: boolean;
  notify_long_checkout: boolean;
  notify_ticket_created: boolean;
  notify_ticket_closed: boolean;
  notify_fuel_refill: boolean;
  notify_trip_started: boolean;
  notify_trip_finished: boolean;
  notify_ticket_approval: boolean;
}

export interface NotificationEventInput {
  channel: NotificationChannel;
  event_type: NotificationEventType;
  title: string;
  message: string;
  payload?: Record<string, any>;
  pdf_data?: string; // Base64 encoded PDF
  target_user_id?: string; // User ID to send notification to (for approval workflow)
}

export const notificationService = {
  // Get current user's notification settings (or create default)
  getMySettings: async (): Promise<NotificationSettings> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Try to fetch existing settings
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[notificationService] Error fetching settings:', error);
      throw error;
    }

    if (data) {
      return data as NotificationSettings;
    }

    // Create default settings row
    const defaultSettings: Omit<NotificationSettings, 'id'> = {
      user_id: user.id,
      enable_line: false,
      enable_telegram: false,
      line_token: null,
      telegram_bot_token: null,
      telegram_chat_id: null,
      notify_maintenance_due: true,
      notify_long_checkout: true,
      notify_ticket_created: true,
      notify_ticket_closed: true,
      notify_fuel_refill: true,
      notify_trip_started: true,
      notify_trip_finished: true,
      notify_ticket_approval: true,
    };

    const { data: created, error: insertError } = await supabase
      .from('notification_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (insertError) {
      console.error('[notificationService] Error creating default settings:', insertError);
      throw insertError;
    }

    return created as NotificationSettings;
  },

  // Update current user's settings
  updateMySettings: async (
    updates: Partial<Omit<NotificationSettings, 'id' | 'user_id'>>
  ): Promise<NotificationSettings> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error updating settings:', error);
      throw error;
    }

    return data as NotificationSettings;
  },

  // Create notification event (to be processed by external worker / Supabase Edge Function)
  // Optional userIdOverride ใช้ในกรณีที่ caller มี user.id อยู่แล้ว เพื่อลดปัญหา getUser timeout
  createEvent: async (input: NotificationEventInput, userIdOverride?: string): Promise<void> => {
    let userId = userIdOverride;

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      userId = user.id;
    }

    const { error } = await supabase.from('notification_events').insert({
      user_id: userId,
      channel: input.channel,
      event_type: input.event_type,
      title: input.title,
      message: input.message,
      payload: input.payload || null,
      pdf_data: input.pdf_data || null,
      target_user_id: input.target_user_id || null,
      status: 'pending',
    });

    if (error) {
      console.error('[notificationService] Error creating notification event:', error);
      throw error;
    }

    // Trigger worker function immediately so notifications are sent without waiting for cron/manual run
    try {
      // Fire-and-forget; we don't care about response body here
      await supabase.functions.invoke('notification-worker', {
        body: { source: 'app', event_type: input.event_type },
      });
    } catch (invokeError) {
      console.warn('[notificationService] Failed to invoke notification-worker:', invokeError);
      // ไม่ต้อง throw ต่อ เพื่อไม่ให้กระทบ UX การบันทึกข้อมูล
    }
  },
};


