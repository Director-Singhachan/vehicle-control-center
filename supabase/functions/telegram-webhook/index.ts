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
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    data?: string;
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
    };
  };
}

// Use Deno.serve to handle Telegram webhooks (which don't send auth headers)
Deno.serve(async (req) => {
  console.log('[telegram-webhook] Incoming request:', {
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
  });
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
    // If someone calls with GET (like opening in browser), just return a simple OK
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: true, message: 'telegram-webhook is running' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Parse Telegram webhook update (POST with JSON body)
    let update: TelegramUpdate;
    try {
      update = await req.json();
    } catch (_e) {
      // If body is empty or not valid JSON, just acknowledge to avoid 500
      return new Response(
        JSON.stringify({ received: false, message: 'No valid JSON body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[telegram-webhook] Parsed update:', update);

    // Handle inline keyboard callbacks (อนุมัติ/ไม่อนุมัติผ่านปุ่ม)
    if (update.callback_query && update.callback_query.data) {
      const cq = update.callback_query;
      const data = cq.data;
      const fromId = cq.from.id;
      const chatId = cq.message?.chat.id ?? fromId;

      console.log('[telegram-webhook] Callback query received:', { data, fromId, chatId });

      try {
        // รูปแบบ callback_data: approve:ticket:{ticketId}:{role} หรือ reject:ticket:{ticketId}:{role}
        const parts = data.split(':');
        
        if (parts.length < 4) {
          console.warn('[telegram-webhook] Invalid callback data format:', data);
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ข้อมูลการอนุมัติไม่ถูกต้อง');
          return new Response(
            JSON.stringify({ received: true, error: 'Invalid callback data format' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const finalAction = parts[0]; // approve หรือ reject
        const ticketKeyword = parts[1]; // ควรเป็น "ticket"
        const finalTicketId = parseInt(parts[2] || '0', 10);
        const finalRole = (parts[3] || '').toLowerCase();

        if (ticketKeyword !== 'ticket' || !finalTicketId || !finalRole) {
          console.warn('[telegram-webhook] Invalid callback data:', data);
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ข้อมูลการอนุมัติไม่ถูกต้อง');
          return new Response(
            JSON.stringify({ received: true, error: 'Invalid callback data' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // หา user จาก telegram_chat_id (เหมือนตอนรับ PDF)
        const { data: settings, error: settingsError } = await supabase
          .from('notification_settings')
          .select('user_id')
          .eq('telegram_chat_id', String(chatId))
          .maybeSingle();

        if (settingsError || !settings) {
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ไม่พบข้อมูลผู้ใช้สำหรับการอนุมัติ กรุณาตรวจสอบการตั้งค่า Telegram Chat ID');
          return new Response(
            JSON.stringify({ received: true, error: 'User not found for callback' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const approverUserId = settings.user_id;

        // Query หา ticket_number จาก ticket_id
        const { data: ticketData, error: ticketFetchError } = await supabase
          .from('tickets')
          .select('ticket_number')
          .eq('id', finalTicketId)
          .maybeSingle();

        if (ticketFetchError || !ticketData) {
          console.error('[telegram-webhook] Error fetching ticket number:', ticketFetchError);
          await sendTelegramMessage(telegramBotToken, chatId, '❌ ไม่พบข้อมูลตั๋ว');
          return new Response(
            JSON.stringify({ received: true, error: 'Ticket not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ticketNumber = ticketData.ticket_number || `#${finalTicketId}`;

        // บันทึกประวัติการอนุมัติใน ticket_approvals
        const level =
          finalRole === 'inspector' ? 1 :
          finalRole === 'manager' ? 2 :
          finalRole === 'executive' ? 3 : null;

        const actionLabel = finalAction === 'reject' ? 'rejected' : 'approved';

        if (level) {
          const approvalData: any = {
            ticket_id: finalTicketId,
            approver_id: approverUserId,
            role_at_approval: finalRole,
            action: actionLabel,
            comments: finalAction === 'reject' ? 'Rejected via Telegram button' : 'Approved via Telegram button',
          };
          approvalData.level = level;

          const { error: approvalError } = await supabase
            .from('ticket_approvals')
            .insert(approvalData);

          if (approvalError) {
            console.error('[telegram-webhook] Error inserting ticket_approvals from callback:', approvalError);
          }
        }

        // อัปเดตสถานะ ticket ตาม role (ให้สอดคล้องกับหน้าระบบ)
        const nextStatus =
          finalAction === 'reject' ? 'rejected' :
          finalRole === 'inspector' ? 'approved_inspector' :
          finalRole === 'manager' ? 'approved_manager' :
          finalRole === 'executive' ? 'ready_for_repair' :
          null;

        if (nextStatus) {
          const { error: ticketUpdateError } = await supabase
            .from('tickets')
            .update({ status: nextStatus })
            .eq('id', finalTicketId);

          if (ticketUpdateError) {
            console.error('[telegram-webhook] Error updating ticket status from callback:', ticketUpdateError);
          }
        }

        // ส่ง PDF ไปหาผู้อนุมัติถัดไป (ถ้าอนุมัติแล้ว)
        if (finalAction === 'approve' && level) {
          try {
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
              // Get ticket data for notification
              const { data: ticketFullData } = await supabase
                .from('tickets_with_relations')
                .select('*')
                .eq('id', finalTicketId)
                .maybeSingle();

              if (ticketFullData) {
                const levelLabels: Record<number, string> = {
                  2: 'Level 2 (ผู้จัดการ)',
                  3: 'Level 3 (ผู้บริหาร)',
                };

                // Create notification event
                // Note: We need pdf_data but can't generate it in Edge Function easily
                // For now, create event without pdf_data - notification-worker will send text message
                // TODO: Add PDF generation in Edge Function or call RPC function
                const { error: notifyError } = await supabase
                  .from('notification_events')
                  .insert({
                    user_id: approverUserId, // User who approved (for event tracking)
                    channel: 'telegram',
                    event_type: 'ticket_pdf_for_approval',
                    title: `📋 ใบแจ้งซ่อมรอการอนุมัติ - ${levelLabels[nextLevel]}`,
                    message: `📋 [ใบแจ้งซ่อมรอการอนุมัติ]\n\n` +
                      `👤 ระดับ: ${levelLabels[nextLevel]}\n` +
                      `🎫 Ticket: #${ticketNumber}\n` +
                      `🚗 ทะเบียนรถ: ${ticketFullData.vehicle_plate || '-'}\n` +
                      `👤 ผู้แจ้ง: ${ticketFullData.reporter_name || '-'}\n` +
                      `🔧 อาการ: ${ticketFullData.repair_type || '-'}\n` +
                      `🚨 ความเร่งด่วน: ${ticketFullData.urgency || 'medium'}\n` +
                      `✅ สถานะปัจจุบัน: อนุมัติ Level ${level} แล้ว\n\n` +
                      `⚠️ กรุณาอนุมัติผ่านหน้าเว็บเพื่อรับ PDF และส่งต่อให้ผู้อนุมัติถัดไป`,
                    payload: {
                      ticket_id: finalTicketId,
                      ticket_number: ticketNumber,
                      approval_level: nextLevel,
                      approval_role: nextRole,
                      previous_level: level,
                    },
                    target_user_id: nextApproverId,
                    status: 'pending',
                    // ไม่ใส่ pdf_data - notification-worker จะส่งข้อความแจ้งเตือนแทน
                  });

                if (notifyError) {
                  console.error('[telegram-webhook] Error creating notification event for next approver:', notifyError);
                } else {
                  console.log(`[telegram-webhook] Created notification event for next approver (${nextRole})`);
                  // Trigger notification-worker to process immediately
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ source: 'telegram-webhook', event_type: 'ticket_pdf_for_approval' }),
                    });
                  } catch (invokeError) {
                    console.warn('[telegram-webhook] Failed to trigger notification-worker:', invokeError);
                    // Continue anyway - cron job will pick it up
                  }
                }
              }
            }
          } catch (nextApproverError) {
            console.error('[telegram-webhook] Error sending to next approver:', nextApproverError);
            // Don't fail the whole approval - just log the error
          }
        }

        // Answer callback query first (to remove loading indicator and hide button)
        try {
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: finalAction === 'reject' ? 'บันทึกการไม่อนุมัติแล้ว' : 'บันทึกการอนุมัติแล้ว',
            }),
          });
        } catch (answerError) {
          console.error('[telegram-webhook] Error answering callback query:', answerError);
        }

        // ส่งข้อความยืนยันกลับไปที่ผู้อนุมัติ (ใช้ ticket_number จริง)
        if (finalAction === 'reject') {
          await sendTelegramMessage(
            telegramBotToken,
            chatId,
            `⛔️ คุณได้ทำการ *ไม่อนุมัติ* ตั๋วหมายเลข ${ticketNumber} แล้ว\n\n` +
            `📝 กรุณาพิมพ์เหตุผลการไม่อนุมัติ โดยระบุเลขที่ตั๋ว เช่น:\n` +
            `"Ticket #${ticketNumber} - เหตุผล: ..." หรือ\n` +
            `"เลขที่ ${ticketNumber} - เหตุผล: ..."\n\n` +
            `ระบบจะบันทึกเหตุผลของคุณอัตโนมัติ`,
          );
        } else {
          await sendTelegramMessage(
            telegramBotToken,
            chatId,
            `✅ คุณได้ทำการ *อนุมัติ* ตั๋วหมายเลข ${ticketNumber} แล้ว\n\n` +
            `📄 กรุณาส่งไฟล์ PDF ที่เซ็นแล้วกลับมาด้วย โดยระบุเลขที่ตั๋ว เช่น:\n` +
            `"Ticket #${ticketNumber}" หรือ "เลขที่ ${ticketNumber}"\n\n` +
            `ระบบจะบันทึกลายเซ็นของคุณอัตโนมัติ`,
          );
        }

        return new Response(
          JSON.stringify({ received: true, success: true, via: 'callback' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (callbackError) {
        console.error('[telegram-webhook] Error handling callback query:', callbackError);
        return new Response(
          JSON.stringify({ received: true, error: 'Callback handling failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!update.message) {
      console.log('[telegram-webhook] No message field in update');
      return new Response(
        JSON.stringify({ received: true, message: 'No message in update' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    console.log('[telegram-webhook] Message received:', {
      chatId,
      userId,
      hasDocument: !!message.document,
      text: message.text,
      caption: message.caption,
    });

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

        // Update ticket (ลง URL ลายเซ็น + เวลาเซ็น)
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

        // Auto-approve ในระบบเมื่อมีการส่ง PDF เซ็นแล้วกลับมา
        let wasAlreadyApproved = false;
        try {
          const level =
            role === 'inspector' ? 1 :
            role === 'manager' ? 2 :
            role === 'executive' ? 3 : null;

          if (level) {
            // เช็คว่ามี approval record อยู่แล้วหรือยัง (กรณีที่กดปุ่มอนุมัติไปแล้ว)
            const { data: existingApprovals } = await supabase
              .from('ticket_approvals')
              .select('*')
              .eq('ticket_id', ticket.id)
              .eq('approver_id', targetUserId)
              .eq('level', level)
              .eq('action', 'approved')
              .limit(1);

            wasAlreadyApproved = existingApprovals && existingApprovals.length > 0;

            if (!wasAlreadyApproved) {
              // ถ้ายังไม่อนุมัติ → สร้าง approval record ใหม่
              const approvalData: any = {
                ticket_id: ticket.id,
                approver_id: targetUserId,
                role_at_approval: role,
                action: 'approved',
                comments: 'Approved via Telegram (signed PDF upload)',
              };
              approvalData.level = level;

              const { error: approvalError } = await supabase
                .from('ticket_approvals')
                .insert(approvalData);

              if (approvalError) {
                console.error('[telegram-webhook] Error inserting ticket_approvals from PDF upload:', approvalError);
              }
            }

            const nextStatus =
              role === 'inspector' ? 'approved_inspector' :
              role === 'manager' ? 'approved_manager' :
              role === 'executive' ? 'ready_for_repair' :
              null;

            if (nextStatus) {
              const { error: ticketUpdateError } = await supabase
                .from('tickets')
                .update({ status: nextStatus })
                .eq('id', ticket.id);

              if (ticketUpdateError) {
                console.error('[telegram-webhook] Error updating ticket status from PDF upload:', ticketUpdateError);
              }
            }

            // ถ้าอนุมัติแล้ว (ไม่ว่าจะเป็นครั้งแรกหรือครั้งที่สอง) → ส่ง PDF ไปหาผู้อนุมัติถัดไป
            if (wasAlreadyApproved || !wasAlreadyApproved) {
              let nextApproverId: string | null = null;
              let nextLevel: number | null = null;
              let nextRole: string | null = null;

              if (level === 1) {
                // Inspector approved → send to manager
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
                // Manager approved → send to executive
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

              if (nextApproverId && nextLevel && nextRole) {
                // Get ticket data for notification
                const { data: ticketFullData } = await supabase
                  .from('tickets_with_relations')
                  .select('*')
                  .eq('id', ticket.id)
                  .maybeSingle();

                if (ticketFullData) {
                  // Download PDF ที่อัปโหลดแล้วเพื่อส่งต่อ (ใช้ PDF ที่เซ็นแล้ว)
                  try {
                    const pdfResponse = await fetch(publicUrl);
                    const pdfBlob = await pdfResponse.blob();
                    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
                    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

                    const levelLabels: Record<number, string> = {
                      2: 'Level 2 (ผู้จัดการ)',
                      3: 'Level 3 (ผู้บริหาร)',
                    };

                    // Create notification event with PDF
                    const { error: notifyError } = await supabase
                      .from('notification_events')
                      .insert({
                        user_id: targetUserId,
                        channel: 'telegram',
                        event_type: 'ticket_pdf_for_approval',
                        title: `📋 ใบแจ้งซ่อมรอการอนุมัติ - ${levelLabels[nextLevel]}`,
                        message: `📋 [ใบแจ้งซ่อมรอการอนุมัติ]\n\n` +
                          `👤 ระดับ: ${levelLabels[nextLevel]}\n` +
                          `🎫 Ticket: #${ticket.ticket_number}\n` +
                          `🚗 ทะเบียนรถ: ${ticketFullData.vehicle_plate || '-'}\n` +
                          `👤 ผู้แจ้ง: ${ticketFullData.reporter_name || '-'}\n` +
                          `🔧 อาการ: ${ticketFullData.repair_type || '-'}\n` +
                          `🚨 ความเร่งด่วน: ${ticketFullData.urgency || 'medium'}\n` +
                          `✅ สถานะปัจจุบัน: อนุมัติ Level ${level} แล้ว\n\n` +
                          `กรุณาตรวจสอบและอนุมัติผ่านระบบ`,
                        payload: {
                          ticket_id: ticket.id,
                          ticket_number: ticket.ticket_number,
                          approval_level: nextLevel,
                          approval_role: nextRole,
                          previous_level: level,
                        },
                        pdf_data: pdfBase64,
                        target_user_id: nextApproverId,
                        status: 'pending',
                      });

                    if (notifyError) {
                      console.error('[telegram-webhook] Error creating notification event for next approver:', notifyError);
                    } else {
                      console.log(`[telegram-webhook] Created notification event with PDF for next approver (${nextRole})`);
                      // Trigger notification-worker to process immediately
                      try {
                        await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ source: 'telegram-webhook', event_type: 'ticket_pdf_for_approval' }),
                        });
                      } catch (invokeError) {
                        console.warn('[telegram-webhook] Failed to trigger notification-worker:', invokeError);
                      }
                    }
                  } catch (pdfDownloadError) {
                    console.error('[telegram-webhook] Error downloading PDF for next approver:', pdfDownloadError);
                    // Fallback: ส่งข้อความแจ้งเตือนโดยไม่มี PDF
                    const levelLabels: Record<number, string> = {
                      2: 'Level 2 (ผู้จัดการ)',
                      3: 'Level 3 (ผู้บริหาร)',
                    };
                    const { error: notifyError } = await supabase
                      .from('notification_events')
                      .insert({
                        user_id: targetUserId,
                        channel: 'telegram',
                        event_type: 'ticket_pdf_for_approval',
                        title: `📋 ใบแจ้งซ่อมรอการอนุมัติ - ${levelLabels[nextLevel]}`,
                        message: `📋 [ใบแจ้งซ่อมรอการอนุมัติ]\n\n` +
                          `👤 ระดับ: ${levelLabels[nextLevel]}\n` +
                          `🎫 Ticket: #${ticket.ticket_number}\n` +
                          `⚠️ กรุณาอนุมัติผ่านหน้าเว็บเพื่อรับ PDF`,
                        payload: {
                          ticket_id: ticket.id,
                          ticket_number: ticket.ticket_number,
                          approval_level: nextLevel,
                          approval_role: nextRole,
                        },
                        target_user_id: nextApproverId,
                        status: 'pending',
                      });
                  }
                }
              }
            }
          }
        } catch (autoApproveError) {
          console.error('[telegram-webhook] Error in auto-approve logic:', autoApproveError);
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
      const text = message.text;
      const textLower = text.toLowerCase();
      
      // Handle help/instructions
      if (textLower.includes('help') || textLower.includes('ช่วย') || textLower.includes('วิธี')) {
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
        return new Response(
          JSON.stringify({ received: true, message: 'Text message handled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle rejection reason (เหตุผลการไม่อนุมัติ)
      // Pattern: "Ticket #2511-032 - เหตุผล: ..." หรือ "เลขที่ 2511-032 - เหตุผล: ..." หรือ "Ticket #33 - เหตุผล: ..."
      const rejectionReasonMatch = text.match(/(?:Ticket|เลขที่|#)\s*([A-Z0-9-]+).*?(?:เหตุผล|reason|เพราะ|เนื่องจาก)[:：]\s*(.+)/i);
      if (rejectionReasonMatch) {
        const ticketIdentifier = rejectionReasonMatch[1].trim(); // อาจเป็น ticket_number (2511-032) หรือ ticket_id (33)
        const reason = rejectionReasonMatch[2].trim();

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

        // หา ticket_id จาก ticket_number หรือ ticket_id
        // ถ้าเป็นตัวเลขธรรมดา (เช่น 33) = ticket_id
        // ถ้ามี - (เช่น 2511-032) = ticket_number
        let ticketId: number | null = null;
        let ticketNumber: string | null = null;

        if (/^\d+$/.test(ticketIdentifier)) {
          // เป็นตัวเลขธรรมดา = ticket_id
          ticketId = parseInt(ticketIdentifier, 10);
          const { data: ticketData } = await supabase
            .from('tickets')
            .select('ticket_number')
            .eq('id', ticketId)
            .maybeSingle();
          ticketNumber = ticketData?.ticket_number || ticketIdentifier;
        } else {
          // มี - หรือตัวอักษร = ticket_number
          ticketNumber = ticketIdentifier;
          const { data: ticketData } = await supabase
            .from('tickets')
            .select('id, ticket_number')
            .eq('ticket_number', ticketNumber)
            .maybeSingle();
          ticketId = ticketData?.id || null;
        }

        if (!ticketId) {
          await sendTelegramMessage(
            telegramBotToken,
            chatId,
            `❌ ไม่พบตั๋วหมายเลข ${ticketIdentifier} กรุณาตรวจสอบเลขที่ตั๋วอีกครั้ง`
          );
          return new Response(
            JSON.stringify({ received: true, error: 'Ticket not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update rejection reason in ticket_approvals
        const role = profile.role.toLowerCase();
        const level =
          role === 'inspector' ? 1 :
          role === 'manager' ? 2 :
          role === 'executive' ? 3 : null;

        if (level) {
          // Find existing rejection approval record
          const { data: existingApprovals, error: fetchError } = await supabase
            .from('ticket_approvals')
            .select('*')
            .eq('ticket_id', ticketId)
            .eq('approver_id', targetUserId)
            .eq('action', 'rejected')
            .order('created_at', { ascending: false })
            .limit(1);

          if (!fetchError && existingApprovals && existingApprovals.length > 0) {
            // Update existing rejection record with reason
            const { error: updateError } = await supabase
              .from('ticket_approvals')
              .update({ comments: reason })
              .eq('id', existingApprovals[0].id);

            if (updateError) {
              console.error('[telegram-webhook] Error updating rejection reason:', updateError);
            } else {
              await sendTelegramMessage(
                telegramBotToken,
                chatId,
                `✅ บันทึกเหตุผลการไม่อนุมัติสำหรับตั๋วหมายเลข ${ticketNumber} เรียบร้อยแล้ว\n\n` +
                `📝 เหตุผล: ${reason}`
              );
            }
          } else {
            await sendTelegramMessage(
              telegramBotToken,
              chatId,
              `⚠️ ไม่พบการไม่อนุมัติสำหรับตั๋วหมายเลข ${ticketNumber} กรุณากดปุ่ม "ไม่อนุมัติ" ก่อน`
            );
          }
        }

        return new Response(
          JSON.stringify({ received: true, message: 'Rejection reason handled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Default response for other text messages
      await sendTelegramMessage(
        telegramBotToken,
        chatId,
        `👋 สวัสดี! ส่ง PDF ที่เซ็นแล้วพร้อมระบุเลขที่ตั๋ว\n\n` +
        `พิมพ์ "help" เพื่อดูวิธีใช้`
      );
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

