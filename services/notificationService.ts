// Notification Service - LINE / Telegram notification settings and events
import { supabase } from '../lib/supabase';

export type NotificationChannel = 'line' | 'telegram';
export type NotificationEventType =
  | 'maintenance_due'
  | 'long_checkout'
  | 'ticket_created'
  | 'ticket_closed';

export interface NotificationSettings {
  id?: string;
  user_id: string;
  enable_line: boolean;
  enable_telegram: boolean;
  line_token: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  notify_maintenance_due: boolean;
  notify_long_checkout: boolean;
  notify_ticket_created: boolean;
  notify_ticket_closed: boolean;
}

export interface NotificationEventInput {
  channel: NotificationChannel;
  event_type: NotificationEventType;
  title: string;
  message: string;
  payload?: Record<string, any>;
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
  createEvent: async (input: NotificationEventInput): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase.from('notification_events').insert({
      user_id: user.id,
      channel: input.channel,
      event_type: input.event_type,
      title: input.title,
      message: input.message,
      payload: input.payload || null,
      status: 'pending',
    });

    if (error) {
      console.error('[notificationService] Error creating notification event:', error);
      throw error;
    }
  },
};


