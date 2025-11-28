// Supabase Edge Function: notification-worker
// Processes pending notification events and sends them to LINE/Telegram
// Supports sending PDF files for ticket approval workflow

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending notification events
    const { data: events, error: fetchError } = await supabase
      .from('notification_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 events at a time

    if (fetchError) {
      console.error('[notification-worker] Error fetching events:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending events' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    // Process each event
    for (const event of events) {
      try {
        // Determine target user (use target_user_id if available, otherwise use user_id)
        const targetUserId = event.target_user_id || event.user_id;

        // Get notification settings for target user
        const { data: settings, error: settingsError } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (settingsError) {
          console.error(`[notification-worker] Error fetching settings for user ${targetUserId}:`, settingsError);
          await markEventFailed(supabase, event.id, 'Failed to fetch settings');
          failed++;
          continue;
        }

        if (!settings) {
          console.warn(`[notification-worker] No settings found for user ${targetUserId}, skipping event ${event.id}`);
          await markEventFailed(supabase, event.id, 'No notification settings found');
          failed++;
          continue;
        }

        // Check if channel is enabled
        const channelEnabled = event.channel === 'line' ? settings.enable_line : settings.enable_telegram;
        if (!channelEnabled) {
          console.warn(`[notification-worker] Channel ${event.channel} not enabled for user ${targetUserId}, skipping event ${event.id}`);
          await markEventSent(supabase, event.id, 'Channel not enabled');
          processed++;
          continue;
        }

        // Send notification based on channel
        if (event.channel === 'telegram') {
          await sendTelegramNotification(event, settings);
        } else if (event.channel === 'line') {
          await sendLineNotification(event, settings);
        }

        // Mark event as sent
        await markEventSent(supabase, event.id);
        processed++;
      } catch (error) {
        console.error(`[notification-worker] Error processing event ${event.id}:`, error);
        await markEventFailed(supabase, event.id, error instanceof Error ? error.message : 'Unknown error');
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: events.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[notification-worker] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Send Telegram notification (with optional PDF attachment)
async function sendTelegramNotification(event: any, settings: any) {
  const botToken = settings.telegram_bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = settings.telegram_chat_id || Deno.env.get('TELEGRAM_CHAT_ID');

  if (!botToken || !chatId) {
    console.warn('[notification-worker] Telegram token or chat ID missing, skipping');
    return;
  }

  const message = `*${event.title}*\n\n${event.message}`;

  // If PDF data exists, send as document
  if (event.pdf_data) {
    try {
      // Convert base64 to binary
      const pdfBuffer = Uint8Array.from(atob(event.pdf_data), c => c.charCodeAt(0));
      
      // Create FormData for multipart/form-data
      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const filename = `Ticket_${event.payload?.ticket_number || event.id}.pdf`;
      formData.append('document', blob, filename);
      formData.append('chat_id', chatId);
      formData.append('caption', message);
      formData.append('parse_mode', 'Markdown');

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
      }

      console.log(`[notification-worker] Sent PDF to Telegram for event ${event.id}`);
    } catch (error) {
      console.error('[notification-worker] Error sending PDF to Telegram:', error);
      // Fallback: try sending text message only
      await sendTelegramTextMessage(botToken, chatId, message);
    }
  } else {
    // Send text message only
    await sendTelegramTextMessage(botToken, chatId, message);
  }
}

// Send Telegram text message
async function sendTelegramTextMessage(botToken: string, chatId: string, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }
}

// Send LINE notification (with optional PDF attachment)
async function sendLineNotification(event: any, settings: any) {
  const lineToken = settings.line_token || Deno.env.get('LINE_NOTIFY_TOKEN');

  if (!lineToken) {
    console.warn('[notification-worker] LINE token missing, skipping');
    return;
  }

  const message = `${event.title}\n\n${event.message}`;

  // If PDF data exists, send as file
  if (event.pdf_data) {
    try {
      // Convert base64 to binary
      const pdfBuffer = Uint8Array.from(atob(event.pdf_data), c => c.charCodeAt(0));
      
      // Create FormData for multipart/form-data
      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const filename = `Ticket_${event.payload?.ticket_number || event.id}.pdf`;
      formData.append('message', message);
      formData.append('imageFile', blob, filename);

      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LINE API error: ${response.status} - ${errorText}`);
      }

      console.log(`[notification-worker] Sent PDF to LINE for event ${event.id}`);
    } catch (error) {
      console.error('[notification-worker] Error sending PDF to LINE:', error);
      // Fallback: try sending text message only
      await sendLineTextMessage(lineToken, message);
    }
  } else {
    // Send text message only
    await sendLineTextMessage(lineToken, message);
  }
}

// Send LINE text message
async function sendLineTextMessage(lineToken: string, message: string) {
  const response = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lineToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ message }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE API error: ${response.status} - ${errorText}`);
  }
}

// Mark event as sent
async function markEventSent(supabase: any, eventId: string, note?: string) {
  await supabase
    .from('notification_events')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: note || null,
    })
    .eq('id', eventId);
}

// Mark event as failed
async function markEventFailed(supabase: any, eventId: string, errorMessage: string) {
  await supabase
    .from('notification_events')
    .update({
      status: 'failed',
      error_message: errorMessage,
    })
    .eq('id', eventId);
}

