// Supabase Edge Function: telegram-webhook
// Receives webhook from Telegram Bot when users send PDF files back
// Uploads PDF to Supabase Storage and updates ticket signature URLs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    text?: string;
    caption?: string;
  };
}

// Use Deno.serve to handle Telegram webhooks (which don't send auth headers)
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional: Verify secret token from Telegram (if set)
  // This provides additional security without requiring JWT
  const telegramSecretToken = Deno.env.get('TELEGRAM_SECRET_TOKEN');
  if (telegramSecretToken) {
    const providedToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (providedToken !== telegramSecretToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid secret token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role key (bypasses RLS)
    // This allows the function to work without authorization headers from Telegram
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get default Telegram bot token from environment variable
    // This is the main bot token used for webhook (should be the same token for all users)
    let telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    // If not set in environment, try to get from any user's settings (fallback)
    if (!telegramBotToken) {
      const { data: defaultSettings } = await supabase
        .from('notification_settings')
        .select('telegram_bot_token')
        .not('telegram_bot_token', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (defaultSettings?.telegram_bot_token) {
        telegramBotToken = defaultSettings.telegram_bot_token;
      }
    }

    if (!telegramBotToken) {
      console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN not set in environment or database');
      return new Response(
        JSON.stringify({ error: 'Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN in Edge Function environment variables, or set telegram_bot_token in notification_settings table.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse Telegram webhook update
    const update: TelegramUpdate = await req.json();

    if (!update.message) {
      return new Response(
        JSON.stringify({ received: true, message: 'No message in update' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    // Check if message contains a document (PDF file)
    if (message.document) {
      const document = message.document;
      const fileName = document.file_name || 'document.pdf';
      const mimeType = document.mime_type || 'application/pdf';

      // Only process PDF files
      if (!mimeType.includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
        await sendTelegramMessage(telegramBotToken, chatId, '❌ กรุณาส่งไฟล์ PDF เท่านั้น');
        return new Response(
          JSON.stringify({ received: true, message: 'Not a PDF file' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Get file from Telegram
        const fileResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${document.file_id}`);
        const fileData = await fileResponse.json();

        if (!fileData.ok || !fileData.result) {
          throw new Error('Failed to get file from Telegram');
        }

        const filePath = fileData.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${filePath}`;

        // Download file from Telegram
        const fileBlob = await fetch(fileUrl).then(r => r.blob());
        const fileBuffer = await fileBlob.arrayBuffer();

        // Find user by Telegram chat ID
        const { data: settings, error: settingsError } = await supabase
          .from('notification_settings')
          .select('user_id')
          .eq('telegram_chat_id', String(chatId))
          .maybeSingle();

        if (settingsError || !settings) {
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ไม่พบข้อมูลผู้ใช้ กรุณาตรวจสอบการตั้งค่า Telegram Chat ID');
          return new Response(
            JSON.stringify({ received: true, error: 'User not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const targetUserId = settings.user_id;

        // Get user profile to determine role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', targetUserId)
          .single();

        if (profileError || !profile) {
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ไม่พบข้อมูลโปรไฟล์ผู้ใช้');
          return new Response(
            JSON.stringify({ received: true, error: 'Profile not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Parse ticket number from message text or caption
        const messageText = message.text || message.caption || '';
        const ticketNumberMatch = messageText.match(/(?:Ticket|เลขที่|#)\s*([A-Z0-9-]+)/i);
        const ticketNumber = ticketNumberMatch ? ticketNumberMatch[1] : null;

        if (!ticketNumber) {
          await sendTelegramMessage(
            telegramBotToken,
            chatId,
            '❌ ไม่พบเลขที่ตั๋ว\n\nกรุณาส่ง PDF พร้อมระบุเลขที่ตั๋ว เช่น:\n"Ticket #2501-001" หรือ "เลขที่ 2501-001"'
          );
          return new Response(
            JSON.stringify({ received: true, error: 'Ticket number not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find ticket by ticket number
        const { data: tickets, error: ticketError } = await supabase
          .from('tickets')
          .select('id, ticket_number, status')
          .eq('ticket_number', ticketNumber)
          .limit(1);

        if (ticketError || !tickets || tickets.length === 0) {
          await sendTelegramMessage(telegramBotToken, chatId, `❌ ไม่พบตั๋วหมายเลข ${ticketNumber}`);
          return new Response(
            JSON.stringify({ received: true, error: 'Ticket not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ticket = tickets[0];

        // Upload PDF to Supabase Storage
        const timestamp = Date.now();
        const storageFileName = `signed-tickets/${ticket.id}/${profile.role}_${timestamp}.pdf`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(storageFileName, fileBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error('[telegram-webhook] Upload error:', uploadError);
          await sendTelegramMessage(telegramBotToken, chatId, '❌ เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
          return new Response(
            JSON.stringify({ received: true, error: 'Upload failed', details: uploadError.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(storageFileName);

        // Update ticket signature URL based on user role
        const updateData: any = {};
        const role = profile.role;

        if (role === 'inspector') {
          updateData.inspector_signature_url = publicUrl;
          updateData.inspector_signed_at = new Date().toISOString();
        } else if (role === 'manager') {
          updateData.manager_signature_url = publicUrl;
          updateData.manager_signed_at = new Date().toISOString();
        } else if (role === 'executive') {
          updateData.executive_signature_url = publicUrl;
          updateData.executive_signed_at = new Date().toISOString();
        } else {
          await sendTelegramMessage(telegramBotToken, chatId, '❌ บทบาทของคุณไม่สามารถอัปเดตลายเซ็นได้');
          return new Response(
            JSON.stringify({ received: true, error: 'Invalid role' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update ticket
        const { error: updateError } = await supabase
          .from('tickets')
          .update(updateData)
          .eq('id', ticket.id);

        if (updateError) {
          console.error('[telegram-webhook] Update error:', updateError);
          await sendTelegramMessage(telegramBotToken, chatId, '❌ เกิดข้อผิดพลาดในการอัปเดตตั๋ว');
          return new Response(
            JSON.stringify({ received: true, error: 'Update failed', details: updateError.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Send success message
        const roleLabels: Record<string, string> = {
          inspector: 'ผู้ตรวจสอบ',
          manager: 'ผู้จัดการ',
          executive: 'ผู้บริหาร',
        };

        await sendTelegramMessage(
          telegramBotToken,
          chatId,
          `✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!\n\n` +
          `ตั๋วหมายเลข: ${ticket.ticket_number}\n` +
          `ผู้เซ็น: ${roleLabels[role] || role}\n` +
          `วันที่: ${new Date().toLocaleString('th-TH')}\n\n` +
          `ระบบได้บันทึกลายเซ็นของคุณแล้ว`
        );

        return new Response(
          JSON.stringify({ received: true, success: true, ticket_id: ticket.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('[telegram-webhook] Error processing document:', error);
        await sendTelegramMessage(telegramBotToken, chatId, '❌ เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'));
        return new Response(
          JSON.stringify({ received: true, error: error instanceof Error ? error.message : 'Unknown error' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (message.text) {
      // Handle text messages (help/instructions)
      const text = message.text.toLowerCase();
      if (text.includes('help') || text.includes('ช่วย') || text.includes('วิธี')) {
        await sendTelegramMessage(
          telegramBotToken,
          chatId,
          `📋 วิธีส่ง PDF ที่เซ็นแล้วกลับมา:\n\n` +
          `1. เซ็น PDF ที่ได้รับจากระบบ\n` +
          `2. ส่ง PDF กลับมาพร้อมระบุเลขที่ตั๋ว เช่น:\n` +
          `   "Ticket #2501-001" หรือ "เลขที่ 2501-001"\n\n` +
          `ตัวอย่าง:\n` +
          `"Ticket #2501-001" (ส่ง PDF พร้อมข้อความนี้)\n\n` +
          `ระบบจะบันทึกลายเซ็นของคุณอัตโนมัติ`
        );
      } else {
        await sendTelegramMessage(
          telegramBotToken,
          chatId,
          `👋 สวัสดี! ส่ง PDF ที่เซ็นแล้วพร้อมระบุเลขที่ตั๋ว\n\n` +
          `พิมพ์ "help" เพื่อดูวิธีใช้`
        );
      }
      return new Response(
        JSON.stringify({ received: true, message: 'Text message handled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[telegram-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to send Telegram message
async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[telegram-webhook] Failed to send message:', errorText);
    }
  } catch (error) {
    console.error('[telegram-webhook] Error sending message:', error);
  }
}

