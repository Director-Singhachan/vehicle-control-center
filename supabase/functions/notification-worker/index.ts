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
          
          const botToken =
            Deno.env.get('TELEGRAM_BOT_TOKEN') ||
            Deno.env.get('TELEGRAM_MAINTENANCE_BOT_TOKEN');
          const groupChatId =
            Deno.env.get('TELEGRAM_MAINTENANCE_GROUP_CHAT_ID') ||
            Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ||
            Deno.env.get('TELEGRAM_CHAT_ID');

          if (!botToken || !groupChatId) {
            console.warn(
              `[notification-worker] Global Telegram group not configured (botToken or groupChatId missing), event ${event.id}`,
            );
            await markEventFailed(
              supabase,
              event.id,
              'Global Telegram group chat not configured',
            );
            failed++;
            continue;
          }

          console.log(`[notification-worker] Sending Telegram notification for event ${event.id} (${event.event_type})`);
          await sendTelegramNotificationToChat(event, botToken, groupChatId);
          await markEventSent(supabase, event.id);
          console.log(`[notification-worker] Successfully sent Telegram notification for event ${event.id}`);
          processed++;
          continue;
        }

        // For normal operational LINE events (แจ้งซ่อม, ใช้งานรถ, เติมน้ำมัน, สรุปการใช้รถ, etc.)
        // ใช้ LINE Messaging API (LINE OA) - ต้องส่งไปยังผู้ใช้แต่ละคนที่มี line_user_id
        if (event.channel === 'line' && !isApprovalPdf) {
          console.log(`[notification-worker] Processing LINE operational event: ${event.event_type}, event ID: ${event.id}`);
          
          const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

          if (!channelAccessToken) {
            console.warn(
              `[notification-worker] LINE_CHANNEL_ACCESS_TOKEN not configured, event ${event.id}`,
            );
            await markEventFailed(
              supabase,
              event.id,
              'LINE_CHANNEL_ACCESS_TOKEN not configured',
            );
            failed++;
            continue;
          }

          // สำหรับ operational events ต้องส่งไปยังผู้ใช้ที่มี line_user_id และ enable_line = true
          // หาผู้ใช้ทั้งหมดที่มีการตั้งค่า LINE
          const { data: allSettings, error: settingsError } = await supabase
            .from('notification_settings')
            .select('line_user_id, user_id, enable_line, notify_ticket_created, notify_ticket_closed, notify_fuel_refill, notify_trip_started, notify_trip_finished')
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
  const botToken =
    settings.telegram_bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = settings.telegram_chat_id || Deno.env.get('TELEGRAM_CHAT_ID');

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
  const isApprovalPdf = event.event_type === 'ticket_pdf_for_approval';

  // สำหรับ ticket_pdf_for_approval ใช้ LINE Messaging API เพื่อส่งปุ่ม
  if (isApprovalPdf && settings.line_user_id) {
    await sendLineMessagingApiNotification(event, settings);
    return;
  }

  // สำหรับ operational events ใช้ LINE Messaging API
  const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = settings.line_user_id;

  if (!channelAccessToken || !lineUserId) {
    console.warn('[notification-worker] LINE Messaging API token or user ID missing, skipping');
    return;
  }

  await sendLineMessagingApiTextMessage(channelAccessToken, lineUserId, event.message); // ใช้แค่ message เท่านั้น (ไม่รวม title)
}

// Send LINE notification directly to a given token (global group)
// DEPRECATED: LINE Notify ถูกยกเลิกแล้ว - ใช้ LINE Messaging API แทน
// async function sendLineNotificationToToken(event: any, lineToken: string) {
//   // LINE Notify ถูกยกเลิกแล้ว ใช้ LINE Messaging API แทน
// }

// Send LINE notification via Messaging API (for interactive buttons)
async function sendLineMessagingApiNotification(event: any, settings: any) {
  const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = settings.line_user_id;

  if (!channelAccessToken || !lineUserId) {
    console.warn('[notification-worker] LINE Messaging API token or user ID missing, skipping');
    return;
  }

  // ใช้แค่ message เท่านั้น (ไม่รวม title เพื่อหลีกเลี่ยงการซ้ำ)
  const message = event.message;

  // ถ้ามี PDF data หรือ PDF URL ให้ส่ง PDF พร้อมปุ่ม
  if ((event.pdf_data || event.payload?.pdf_url) && event.payload?.ticket_id && event.payload?.approval_role) {
    try {
      const ticketId = event.payload.ticket_id;
      const ticketNumber = event.payload.ticket_number || `#${ticketId}`;
      const role = event.payload.approval_role;
      
      let publicUrl: string | null = null;
      
      // ถ้ามี pdf_url อยู่แล้ว (จาก line-webhook ที่ส่ง PDF ไปหาผู้อนุมัติถัดไป)
      if (event.payload.pdf_url) {
        publicUrl = event.payload.pdf_url;
        console.log(`[notification-worker] Using existing PDF URL: ${publicUrl}`);
      } else if (event.pdf_data) {
        // Convert base64 to binary
        const pdfBuffer = Uint8Array.from(atob(event.pdf_data), c => c.charCodeAt(0));
        
        // อัปโหลด PDF ไปยัง Supabase Storage
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const timestamp = Date.now();
        const storageFileName = `ticket-pdfs/${ticketId}/approval_${role}_${timestamp}.pdf`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(storageFileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error('[notification-worker] Error uploading PDF to Supabase Storage:', uploadError);
          // Fallback: send text message without PDF link
          const messages = [
            {
              type: 'text',
              text: message + '\n\n📄 กรุณาส่งไฟล์ PDF ที่เซ็นแล้วกลับมา\nหรือกดปุ่ม "ไม่อนุมัติ" ด้านล่าง',
              quickReply: {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '❌ ไม่อนุมัติ',
                      data: `reject:ticket:${ticketId}:${role}`,
                      displayText: 'ไม่อนุมัติตั๋วนี้',
                    },
                  },
                ],
              },
            },
          ];
          
          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
              to: lineUserId,
              messages: messages,
            }),
          });
          return;
        }

        // Get public URL
        const { data: { publicUrl: uploadedUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(storageFileName);
        
        publicUrl = uploadedUrl;
      }

      if (!publicUrl) {
        throw new Error('No PDF URL available');
      }

      // ส่งข้อความพร้อมปุ่ม (ไม่ใส่ลิงค์ PDF ในข้อความ - ใช้แค่ปุ่ม)
      const messages = [
        {
          type: 'text',
          text: message + `\n\nกรุณาเซ็น PDF แล้วส่งกลับมาพร้อมระบุเลขที่ตั๋ว:\n"Ticket ${ticketNumber}" หรือ "เลขที่ ${ticketNumber}"\n\nหรือกดปุ่ม "ไม่อนุมัติ" ด้านล่าง`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'uri',
                  label: `📥 Ticket #${ticketNumber}`, // ใช้เลขที่ตั๋วแทนชื่อยาว
                  uri: publicUrl,
                },
              },
              {
                type: 'action',
                action: {
                  type: 'postback',
                  label: '❌ ไม่อนุมัติ',
                  data: `reject:ticket:${ticketId}:${role}`,
                  displayText: 'ไม่อนุมัติตั๋วนี้',
                },
              },
            ],
          },
        },
      ];

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          to: lineUserId, // ใช้ line_user_id (ไม่ใช่ chat ID)
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LINE Messaging API error: ${response.status} - ${errorText}`);
      }

      console.log(`[notification-worker] Sent approval request with PDF link to LINE for event ${event.id} (user: ${lineUserId})`);
    } catch (error) {
      console.error('[notification-worker] Error sending approval request to LINE:', error);
      // Fallback: send text message only
      await sendLineMessagingApiTextMessage(channelAccessToken, lineUserId, message);
    }
  } else {
    // Send text message only
    await sendLineMessagingApiTextMessage(channelAccessToken, lineUserId, message);
  }
}

// Send LINE text message via Messaging API
// ใช้ line_user_id (ไม่ใช่ chat ID) สำหรับส่งข้อความไปยัง LINE ส่วนตัว
async function sendLineMessagingApiTextMessage(channelAccessToken: string, lineUserId: string, message: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId, // ใช้ line_user_id (ไม่ใช่ chat ID)
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
}

// DEPRECATED: LINE Notify ถูกยกเลิกแล้ว - ใช้ LINE Messaging API แทน
// async function sendLineTextMessage(lineToken: string, message: string) {
//   // LINE Notify ถูกยกเลิกแล้ว ใช้ LINE Messaging API แทน
// }

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

