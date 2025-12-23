// Supabase Edge Function: notification-worker
// Processes pending notification events and sends them to LINE/Telegram
// Supports sending PDF files for ticket approval workflow

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
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

    console.log(`[notification-worker] Found ${events?.length || 0} pending events`);

    // Log event details for debugging
    if (events && events.length > 0) {
      events.forEach((evt: any) => {
        console.log(`[notification-worker] Event ${evt.id}: channel=${evt.channel}, event_type=${evt.event_type}, user_id=${evt.user_id}`);
      });
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
        // Determine if this is an approval PDF event (needs per-user settings)
        const isApprovalPdf = event.event_type === 'ticket_pdf_for_approval';

        // For normal operational Telegram events (แจ้งซ่อม, ใช้งานรถ, etc.) 
        // ให้ยิงเข้า "กลุ่มกลาง" จาก Environment Variable แทน ไม่ต้องพึ่ง settings ของคนขับ
        // แต่ถ้า event_type เป็น ticket_created หรือ ticket_closed ให้เช็ค notify_ticket_created หรือ notify_ticket_closed
        if (event.channel === 'telegram' && !isApprovalPdf) {
          // ตัดการแจ้งเตือน Telegram เฉพาะงานแจ้งซ่อม (ticket_created/ticket_closed) แต่คง trip_started/trip_finished, fuel_refill
          const isRepairTicket =
            event.event_type === 'ticket_created' ||
            event.event_type === 'ticket_closed';

          if (isRepairTicket) {
            console.log(`[notification-worker] Telegram disabled for repair tickets. Skipping event ${event.id}.`);
            await markEventSent(supabase, event.id, 'Telegram repair notifications disabled');
            processed++;
            continue;
          }

          console.log(`[notification-worker] Processing Telegram operational event: ${event.event_type}, event ID: ${event.id}`);

          // เช็คว่าต้องการเช็ค user settings หรือไม่
          // สำหรับ ticket_created, ticket_closed, fuel_refill, trip_started, trip_finished
          const needsUserSettingCheck =
            event.event_type === 'ticket_created' ||
            event.event_type === 'ticket_closed' ||
            event.event_type === 'fuel_refill' ||
            event.event_type === 'trip_started' ||
            event.event_type === 'trip_finished';

          if (needsUserSettingCheck) {
            // Determine target user (use target_user_id if available, otherwise use user_id)
            const targetUserId = event.target_user_id || event.user_id;

            if (targetUserId) {
              // Get notification settings for target user
              const { data: userSettings } = await supabase
                .from('notification_settings')
                .select('notify_ticket_created, notify_ticket_closed, notify_fuel_refill, notify_trip_started, notify_trip_finished')
                .eq('user_id', targetUserId)
                .maybeSingle();

              // เช็คว่า user เปิดการแจ้งเตือนหรือไม่
              let shouldNotify = true;
              switch (event.event_type) {
                case 'ticket_created':
                  shouldNotify = userSettings?.notify_ticket_created !== false;
                  break;
                case 'ticket_closed':
                  shouldNotify = userSettings?.notify_ticket_closed !== false;
                  break;
                case 'fuel_refill':
                  shouldNotify = userSettings?.notify_fuel_refill !== false;
                  break;
                case 'trip_started':
                  shouldNotify = userSettings?.notify_trip_started !== false;
                  break;
                case 'trip_finished':
                  shouldNotify = userSettings?.notify_trip_finished !== false;
                  break;
              }

              // ถ้า user ปิดการแจ้งเตือน ให้ข้าม (แต่ยังส่งไปกลุ่มกลาง)
              // หรือถ้าต้องการให้ส่งเฉพาะเมื่อ user เปิด ให้ uncomment บรรทัดนี้:
              // if (!shouldNotify) { continue; }
            }
          }

          const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('TELEGRAM_MAINTENANCE_BOT_TOKEN');
          const groupChatId = Deno.env.get('TELEGRAM_MAINTENANCE_GROUP_CHAT_ID') || Deno.env.get('TELEGRAM_GROUP_CHAT_ID') || Deno.env.get('TELEGRAM_CHAT_ID');

          let targetChatId: string | null = null;

          // Case 1: Targeted notification (Private)
          if (event.target_user_id) {
            const { data: targetSettings } = await supabase
              .from('notification_settings')
              .select('*')
              .eq('user_id', event.target_user_id)
              .maybeSingle();

            if (targetSettings?.telegram_chat_id && targetSettings.enable_telegram) {
              targetChatId = targetSettings.telegram_chat_id;
              console.log(`[notification-worker] Using private Telegram chatId for user ${event.target_user_id}`);
            } else {
              // Fallback to group ONLY for a "Bind Request" notification
              console.warn(`[notification-worker] User ${event.target_user_id} not bound for Telegram. Sending notice to group.`);
              const bindNotice = `🔔 มีแจ้งเตือนสำหรับคุณ แจ้งโดยระบุอีเมลผู้รับ แต่ยังไม่ได้ผูก Telegram Bot ครับ\n` +
                `กรุณาเปิดแชทกับบอทแล้วพิมพ์อีเมลเพื่อรับแจ้งเตือนส่วนตัว`;
              if (groupChatId) {
                await sendTelegramTextMessage(botToken!, groupChatId, bindNotice);
              }
              await markEventFailed(supabase, event.id, 'No private Telegram chatId found, sent bind notice to group');
              failed++;
              continue;
            }
          } else {
            // Case 2: Broadcast to group (Only for non-ticket events or if explicitly allowed)
            // สำหรับความปลอดภัย เราจะไม่อนุญาตให้ ticket_created/closed ส่งลงกลุ่มแบบ Broadcast
            const isSensitiveEvent = event.event_type === 'ticket_created' || event.event_type === 'ticket_closed' || isApprovalPdf;

            if (isSensitiveEvent) {
              console.warn(`[notification-worker] Skip: Sensitive event ${event.event_type} must have target_user_id to be sent.`);
              await markEventSent(supabase, event.id); // Mark as sent to avoid spam/retry
              continue;
            }

            targetChatId = groupChatId || null;
          }

          if (!botToken || !targetChatId) {
            console.warn(`[notification-worker] Telegram botToken or chatId missing.`);
            await markEventFailed(supabase, event.id, 'Telegram not configured');
            failed++;
            continue;
          }

          await sendTelegramNotificationToChat(event, botToken, targetChatId);
          await markEventSent(supabase, event.id);
          processed++;
          continue;
        }

        // For normal operational LINE events (แจ้งซ่อม, ใช้งานรถ, เติมน้ำมัน, สรุปการใช้รถ, etc.)
        // ใช้ LINE Messaging API (LINE OA) - ต้องส่งไปยังผู้ใช้แต่ละคนที่มี line_user_id
        if (event.channel === 'line' && !isApprovalPdf) {
          console.log(`[notification-worker] Processing LINE operational event: ${event.event_type}, event ID: ${event.id}`);

          const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

          if (!channelAccessToken) {
            console.warn(`[notification-worker] LINE_CHANNEL_ACCESS_TOKEN not configured`);
            await markEventFailed(supabase, event.id, 'LINE_CHANNEL_ACCESS_TOKEN not configured');
            failed++;
            continue;
          }

          // Case 1: Targeted notification (Only for the specified user)
          if (event.target_user_id) {
            console.log(`[notification-worker] Targeted LINE event for user: ${event.target_user_id}`);
            const { data: targetSettings } = await supabase
              .from('notification_settings')
              .select('*')
              .eq('user_id', event.target_user_id)
              .maybeSingle();

            if (targetSettings?.line_user_id && targetSettings.enable_line) {
              // Check user preference for this event type
              let shouldNotify = true;
              switch (event.event_type) {
                case 'ticket_created': shouldNotify = targetSettings.notify_ticket_created !== false; break;
                case 'ticket_closed': shouldNotify = targetSettings.notify_ticket_closed !== false; break;
                case 'fuel_refill': shouldNotify = targetSettings.notify_fuel_refill !== false; break;
                case 'trip_started': shouldNotify = targetSettings.notify_trip_started !== false; break;
                case 'trip_finished': shouldNotify = targetSettings.notify_trip_finished !== false; break;
              }

              if (shouldNotify) {
                // Use the main sendLineNotification function instead of just text message
                // This will automatically handle PDF attachments if present
                await sendLineNotification(event, targetSettings);
                console.log(`[notification-worker] Sent targeted LINE notification to user ${event.target_user_id}`);
                await markEventSent(supabase, event.id);
                processed++;
              } else {
                console.log(`[notification-worker] User ${event.target_user_id} has disabled ${event.event_type}, marking as sent`);
                await markEventSent(supabase, event.id);
                processed++;
              }
            } else {
              const reason = !targetSettings ? 'No settings found' : !targetSettings.enable_line ? 'LINE disabled' : 'No line_user_id';
              console.warn(`[notification-worker] Could not send targeted LINE message: ${reason}`);
              await markEventFailed(supabase, event.id, reason);
              failed++;
            }
            continue;
          }

          // Case 2: Broadcast notification (Original behavior)
          const { data: allSettings, error: settingsError } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('enable_line', true)
            .not('line_user_id', 'is', null);

          if (settingsError) {
            console.error(`[notification-worker] Error fetching LINE settings:`, settingsError);
            await markEventFailed(supabase, event.id, 'Failed to fetch LINE settings');
            failed++;
            continue;
          }

          console.log(`[notification-worker] Found ${allSettings?.length || 0} user(s) with LINE enabled and line_user_id`);

          // Log user details for debugging
          if (allSettings && allSettings.length > 0) {
            allSettings.forEach((setting: any) => {
              console.log(
                `[notification-worker] User ${setting.user_id}: ` +
                `line_user_id=${setting.line_user_id ? setting.line_user_id.substring(0, 10) + '...' : 'null'}, ` +
                `notify_ticket_created=${setting.notify_ticket_created}, ` +
                `notify_ticket_closed=${setting.notify_ticket_closed}`
              );
            });
          }

          if (!allSettings || allSettings.length === 0) {
            // ตรวจสอบว่ามีผู้ใช้ที่มี enable_line = true แต่ยังไม่มี line_user_id หรือไม่
            const { data: usersWithoutLineId } = await supabase
              .from('notification_settings')
              .select('user_id, enable_line, line_user_id')
              .eq('enable_line', true)
              .is('line_user_id', null);

            const errorMessage = usersWithoutLineId && usersWithoutLineId.length > 0
              ? `No users with LINE enabled and line_user_id configured. Found ${usersWithoutLineId.length} user(s) with enable_line=true but missing line_user_id. Users need to send "bind your.email@company.com" to LINE Bot first.`
              : 'No users with LINE enabled and line_user_id configured. Users need to: 1) Add LINE Bot as friend, 2) Send "bind your.email@company.com" to bot, 3) Enable LINE in Settings';

            console.warn(`[notification-worker] ${errorMessage}, event ${event.id}`);
            await markEventFailed(supabase, event.id, errorMessage);
            failed++;
            continue;
          }

          // เช็คว่าต้องการเช็ค user settings หรือไม่
          // สำหรับ ticket_created, ticket_closed, fuel_refill, trip_started, trip_finished
          const needsUserSettingCheck =
            event.event_type === 'ticket_created' ||
            event.event_type === 'ticket_closed' ||
            event.event_type === 'fuel_refill' ||
            event.event_type === 'trip_started' ||
            event.event_type === 'trip_finished';

          // ส่งไปยังผู้ใช้แต่ละคน
          let sentCount = 0;
          let skippedCount = 0;
          for (const userSetting of allSettings) {
            if (!userSetting.line_user_id) {
              skippedCount++;
              continue;
            }

            // เช็คว่า user เปิดการแจ้งเตือนหรือไม่
            if (needsUserSettingCheck) {
              let shouldNotify = true;
              switch (event.event_type) {
                case 'ticket_created':
                  shouldNotify = userSetting.notify_ticket_created !== false;
                  break;
                case 'ticket_closed':
                  shouldNotify = userSetting.notify_ticket_closed !== false;
                  break;
                case 'fuel_refill':
                  shouldNotify = userSetting.notify_fuel_refill !== false;
                  break;
                case 'trip_started':
                  shouldNotify = userSetting.notify_trip_started !== false;
                  break;
                case 'trip_finished':
                  shouldNotify = userSetting.notify_trip_finished !== false;
                  break;
              }

              if (!shouldNotify) {
                console.log(`[notification-worker] Skipping LINE notification for user ${userSetting.user_id} - ${event.event_type} disabled`);
                skippedCount++;
                continue;
              }
            }

            try {
              console.log(`[notification-worker] Sending LINE message to user ${userSetting.user_id} (line_user_id: ${userSetting.line_user_id.substring(0, 10)}...)`);
              await sendLineMessagingApiTextMessage(
                channelAccessToken,
                userSetting.line_user_id,
                event.message // ใช้แค่ message เท่านั้น (ไม่รวม title)
              );
              sentCount++;
              console.log(`[notification-worker] Successfully sent to user ${userSetting.user_id}`);
            } catch (error) {
              console.error(`[notification-worker] Error sending to user ${userSetting.user_id}:`, error);
            }
          }

          console.log(`[notification-worker] Summary: ${sentCount} sent, ${skippedCount} skipped`);

          if (sentCount > 0) {
            console.log(`[notification-worker] Successfully sent LINE notification to ${sentCount} user(s) for event ${event.id}`);
            await markEventSent(supabase, event.id);
            processed++;
          } else {
            const reason = skippedCount > 0
              ? `All ${allSettings.length} user(s) have notifications disabled for ${event.event_type}`
              : 'No users to send to';
            console.warn(`[notification-worker] ${reason} for event ${event.id}`);
            await markEventFailed(supabase, event.id, reason);
            failed++;
          }
          continue;
        }

        // จากนี้ไปคือเคสที่ "ต้องผูกกับ user คนใดคนหนึ่ง" 
        // เช่น ticket_pdf_for_approval ที่ยิงไปหาผู้อนุมัติแบบตัวต่อตัว

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

        // เช็คว่า user เปิดการแจ้งเตือนสำหรับ event type นี้หรือไม่
        if (settings) {
          let shouldNotify = true;
          switch (event.event_type) {
            case 'ticket_pdf_for_approval':
              shouldNotify = settings.notify_ticket_approval !== false;
              break;
            case 'ticket_created':
              shouldNotify = settings.notify_ticket_created !== false;
              break;
            case 'ticket_closed':
              shouldNotify = settings.notify_ticket_closed !== false;
              break;
            case 'fuel_refill':
              shouldNotify = settings.notify_fuel_refill !== false;
              break;
            case 'trip_started':
              shouldNotify = settings.notify_trip_started !== false;
              break;
            case 'trip_finished':
              shouldNotify = settings.notify_trip_finished !== false;
              break;
          }

          if (!shouldNotify) {
            console.log(`[notification-worker] Skipping notification for user ${targetUserId} - ${event.event_type} disabled`);
            await markEventSent(supabase, event.id); // Mark as sent to avoid retry
            continue;
          }
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

// ส่ง Telegram notification โดยระบุ chat ตรงๆ (ใช้ได้ทั้งกลุ่มกลางและแบบตัวต่อตัว)
async function sendTelegramNotificationToChat(
  event: any,
  botToken: string,
  chatId: string,
) {
  if (!botToken || !chatId) {
    console.warn('[notification-worker] Telegram token or chat ID missing, skipping');
    return;
  }

  const message = `*${event.title}*\n\n${event.message}`;

  const isApprovalPdf = event.event_type === 'ticket_pdf_for_approval';

  // If PDF data exists, send as document
  if (event.pdf_data) {
    try {
      // Convert base64 to binary
      const pdfBuffer = Uint8Array.from(atob(event.pdf_data), (c) => c.charCodeAt(0));

      // Create FormData for multipart/form-data
      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const filename = `Ticket_${event.payload?.ticket_number || event.id}.pdf`;
      formData.append('document', blob, filename);
      formData.append('chat_id', chatId);
      formData.append('caption', message);
      formData.append('parse_mode', 'Markdown');

      // ถ้าเป็น PDF สำหรับการอนุมัติแนบปุ่มกด อนุมัติ / ไม่อนุมัติ
      if (isApprovalPdf && event.payload?.ticket_id && event.payload?.approval_role) {
        const callbackBase = `ticket:${event.payload.ticket_id}:${event.payload.approval_role}`;
        const replyMarkup = {
          inline_keyboard: [[
            {
              text: '✅ อนุมัติผ่าน Telegram',
              callback_data: `approve:${callbackBase}`,
            },
            {
              text: '❌ ไม่อนุมัติ',
              callback_data: `reject:${callbackBase}`,
            },
          ]],
        };
        formData.append('reply_markup', JSON.stringify(replyMarkup));
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
      }

      console.log(
        `[notification-worker] Sent PDF to Telegram for event ${event.id}`,
      );
    } catch (error) {
      console.error(
        '[notification-worker] Error sending PDF to Telegram:',
        error,
      );
      // Fallback: try sending text message only
      await sendTelegramTextMessage(botToken, chatId, message);
    }
  } else {
    // Send text message only
    await sendTelegramTextMessage(botToken, chatId, message);
  }
}

// Send Telegram notification (กับ user ที่มี settings ของตัวเอง – ใช้ใน approval flow)
async function sendTelegramNotification(event: any, settings: any) {
  const isApprovalPdf = event.event_type === 'ticket_pdf_for_approval';
  const botToken = settings.telegram_bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN');

  // สำหรับเรื่องใบแจ้งซ่อมที่เจาะจงตัวบุคคล ต้องมี chatId ส่วนตัวเท่านั้น ห้ามส่งลงกลุ่ม
  const isSensitive = isApprovalPdf || event.event_type === 'ticket_created' || event.event_type === 'ticket_closed';

  if (isSensitive && !settings.telegram_chat_id) {
    console.warn(`[notification-worker] Skipping Telegram sensitive event: No private chatId for user ${settings.id || settings.user_id}`);
    return;
  }

  // ห้ามใช้ OR (||) กับ Default Group ID สำหรับ Private Notification
  const chatId = settings.telegram_chat_id;

  if (!botToken || !chatId) {
    console.warn('[notification-worker] Telegram botToken or chatId missing, skipping private notification');
    return;
  }

  await sendTelegramNotificationToChat(event, botToken, chatId);
}

// Send Telegram text message
async function sendTelegramTextMessage(botToken: string, chatId: string, message: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }
}

// Send LINE notification (with optional PDF attachment) using user's settings
// ใช้ LINE Messaging API (LINE OA) เท่านั้น - LINE Notify ถูกยกเลิกแล้ว
async function sendLineNotification(event: any, settings: any) {
  const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = settings.line_user_id;

  if (!channelAccessToken || !lineUserId) {
    console.warn('[notification-worker] LINE Messaging API token or user ID missing, skipping');
    return;
  }

  await sendLineMessagingApiNotification(event, settings);
}

// Send LINE notification via Messaging API (for interactive buttons)
async function sendLineMessagingApiNotification(event: any, settings: any) {
  const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = settings.line_user_id;

  if (!channelAccessToken || !lineUserId) {
    console.warn('[notification-worker] LINE Messaging API token or user ID missing, skipping');
    return;
  }

  const message = event.message;

  // ถ้ามี PDF data หรือ PDF URL ให้ส่ง PDF พร้อมปุ่ม
  if (event.pdf_data || event.payload?.pdf_url) {
    try {
      const ticketId = event.payload?.ticket_id;
      const ticketNumber = event.payload?.ticket_number || `#${ticketId || 'New'}`;
      const role = event.payload?.approval_role || 'inspector'; // Fallback role

      let publicUrl: string | null = null;

      if (event.payload?.pdf_url) {
        publicUrl = event.payload.pdf_url;
      } else if (event.pdf_data) {
        const pdfBuffer = Uint8Array.from(atob(event.pdf_data), c => c.charCodeAt(0));
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const timestamp = Date.now();
        // ใช้ชื่อไฟล์ที่มี Ticket number เพื่อให้ดาวน์โหลดแล้วมีชื่อไฟล์ที่เหมาะสม
        // Format: Ticket_2512-023.pdf (ถ้ามี role ให้ใส่ prefix)
        const ticketNumberForFilename = ticketNumber.replace(/#/g, ''); // ลบ # ออก
        const filename = `${role}_Ticket_${ticketNumberForFilename}.pdf`;
        const storageFileName = `ticket-pdfs/${ticketId || 'unknown'}/${filename}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(storageFileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error('[notification-worker] Error uploading PDF fallback:', uploadError);
        } else {
          // Supabase Storage จะใช้ชื่อไฟล์จาก path เป็นชื่อไฟล์เมื่อดาวน์โหลด
          const { data: { publicUrl: uploadedUrl } } = supabase.storage
            .from('ticket-attachments')
            .getPublicUrl(storageFileName);
          publicUrl = uploadedUrl;
        }
      }

      if (publicUrl) {
        // Message 1: ปุ่มดาวน์โหลดอยู่เดี่ยว ๆ
        const downloadCard = {
          type: 'template',
          altText: `เอกสารประกอบ #${ticketNumber}`,
          template: {
            type: 'buttons',
            title: `Ticket #${ticketNumber}`,
            text: message.length > 60 ? message.substring(0, 57) + '...' : message,
            actions: [
              {
                type: 'uri',
                label: `📥 ดาวน์โหลด #${ticketNumber}`,
                uri: publicUrl,
              },
            ],
          },
        };

        // Message 2: ปุ่มไม่อนุมัติเป็น template แยก เพื่อให้เห็นชัด
        const rejectCard = {
          type: 'template',
          altText: `ไม่อนุมัติ Ticket #${ticketNumber}`,
          template: {
            type: 'buttons',
            title: `ไม่อนุมัติ #${ticketNumber}`,
            text: 'หากต้องการไม่อนุมัติ ให้กดปุ่มด้านล่าง',
            actions: [
              {
                type: 'postback',
                label: '❌ ไม่อนุมัติ',
                data: `reject:ticket:${ticketId}:${role}`,
                displayText: 'ไม่อนุมัติตั๋วนี้',
              },
            ],
          },
        };

        const messages = [
          downloadCard,
          rejectCard,
          {
            type: 'text',
            text: message + `\n\n📄 PDF: Ticket: #${ticketNumber}\n(ใช้ปุ่มดาวน์โหลดด้านบน)`,
          },
        ];

        const resp = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({ to: lineUserId, messages }),
        });

        // ตรวจสอบการตอบกลับจาก LINE เพื่อไม่ให้หลุดสถานะ sent ถ้าส่งไม่สำเร็จ
        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`LINE push error: ${resp.status} - ${errorText}`);
        }
        return;
      }
    } catch (err) {
      console.error('[notification-worker] Error in LINE PDF flow:', err);
    }
  }

  // Fallback to plain text if everything else fails
  const resp = await sendLineMessagingApiTextMessage(channelAccessToken, lineUserId, message);
  // sendLineMessagingApiTextMessage จะ throw เองถ้า error
  return resp;
}

// Send LINE text message via Messaging API
async function sendLineMessagingApiTextMessage(channelAccessToken: string, lineUserId: string, message: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{
        type: 'text',
        text: message,
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE Messaging API error: ${response.status} - ${errorText}`);
  }

  return response;
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