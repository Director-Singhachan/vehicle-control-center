// Supabase Edge Function: line-webhook
// LINE Messaging API webhook
// Phase 1: รองรับข้อความทั่วไป + คำสั่ง bind email เพื่อผูก LINE userId กับ user ในระบบ
// Phase 2: รองรับการอนุมัติ/อัปโหลด PDF และปุ่มไม่อนุมัติ

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Store pending PDFs temporarily (will be lost on function restart)
// In production, should use database or cache
let pendingPdfs: Map<string, { buffer: ArrayBuffer; userId: string; profile: any }> | undefined;

// NOTE:
// - ใช้กับ LINE Messaging API (ไม่ใช่ LINE Notify)
// - คุณต้องเอา URL ของฟังก์ชันนี้ไปตั้งใน LINE Developers Console

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-Line-Signature',
};

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
    type?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
    fileName?: string;
  };
  postback?: {
    data: string;
  };
}

interface LineWebhookBody {
  events?: LineEvent[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight (GET / OPTIONS จาก browser)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ถ้ามีคนเปิด URL นี้จาก browser ให้ตอบ status ว่าฟังก์ชันทำงานอยู่
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, message: 'line-webhook is running' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body: LineWebhookBody = await req.json().catch(() => ({}));
    const events = body.events || [];

    console.log('[line-webhook] Incoming events:', JSON.stringify(events, null, 2));

    // ถ้าไม่มี event อะไรเลย ให้ตอบ 200 กลับไปเฉย ๆ
    if (events.length === 0) {
      return new Response(
        JSON.stringify({ received: false, reason: 'no events' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ใช้ Channel Access Token จาก Environment (LINE Messaging API)
    const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
    if (!channelAccessToken) {
      console.error('[line-webhook] Missing LINE_CHANNEL_ACCESS_TOKEN in environment');
      return new Response(
        JSON.stringify({ error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Supabase client (service role) สำหรับ mapping LINE user ↔ user ในระบบ
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ตอบกลับเฉพาะข้อความ (message.type === 'text') แบบง่าย ๆ
    const replyPromises: Promise<Response>[] = [];

    for (const event of events) {
      // ====== Handle Postback Events (ปุ่ม "ไม่อนุมัติ") ======
      if (event.type === 'postback' && event.postback) {
        const postbackData = event.postback.data;
        const postbackUserId = event.source?.userId;

        if (!postbackUserId) {
          continue;
        }

        // รูปแบบ: reject:ticket:{ticketId}:{role}
        if (postbackData.startsWith('reject:ticket:')) {
          const parts = postbackData.split(':');
          if (parts.length >= 4) {
            const ticketId = parseInt(parts[2] || '0', 10);
            const role = parts[3]?.toLowerCase();

            if (ticketId && role) {
              // หา user จาก line_user_id
              const { data: settings } = await supabase
                .from('notification_settings')
                .select('user_id')
                .eq('line_user_id', postbackUserId)
                .maybeSingle();

              if (settings) {
                const level =
                  role === 'inspector' ? 1 :
                  role === 'manager' ? 2 :
                  role === 'executive' ? 3 : null;

                if (level) {
                  // สร้าง rejection record
                  await supabase.from('ticket_approvals').insert({
                    ticket_id: ticketId,
                    approver_id: settings.user_id,
                    role_at_approval: role,
                    level: level,
                    action: 'rejected',
                    comments: 'Rejected via LINE button',
                  });

                  // อัปเดตสถานะตั๋ว
                  await supabase
                    .from('tickets')
                    .update({ status: 'rejected' })
                    .eq('id', ticketId);

                  // ส่งข้อความยืนยัน
                  if (event.replyToken) {
                    await fetch('https://api.line.me/v2/bot/message/reply', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${channelAccessToken}`,
                      },
                      body: JSON.stringify({
                        replyToken: event.replyToken,
                        messages: [{
                          type: 'text',
                          text: '⛔️ คุณได้ทำการไม่อนุมัติตั๋วแล้ว\n\nกรุณาพิมพ์เหตุผลการไม่อนุมัติ โดยระบุเลขที่ตั๋ว เช่น:\n"Ticket #2501-001 - เหตุผล: ..."',
                        }],
                      }),
                    });
                  }
                }
              }
            }
          }
        }
        continue;
      }

      // ====== Handle Message Events ======
      if (event.type !== 'message') {
        continue;
      }

      if (!event.replyToken || !event.message) {
        continue;
      }

      const lineUserId = event.source?.userId;

      // ====== Handle File Messages (PDF) ======
      if (event.message.type === 'file') {
        const messageId = event.message.id;
        const fileName = event.message.fileName || '';

        // ตรวจสอบว่าเป็น PDF
        if (!fileName.toLowerCase().endsWith('.pdf')) {
          const payload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: '❌ กรุณาส่งไฟล์ PDF เท่านั้น',
            }],
          };
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          continue;
        }

        try {
          // ดาวน์โหลดไฟล์จาก LINE Content API
          const contentResponse = await fetch(
            `https://api-data.line.me/v2/bot/message/${messageId}/content`,
            {
              headers: {
                Authorization: `Bearer ${channelAccessToken}`,
              },
            }
          );

          if (!contentResponse.ok) {
            throw new Error('Failed to download file from LINE');
          }

          const fileBuffer = await contentResponse.arrayBuffer();

          // หา user จาก line_user_id
          const { data: settings, error: settingsError } = await supabase
            .from('notification_settings')
            .select('user_id')
            .eq('line_user_id', lineUserId || '')
            .maybeSingle();

          if (settingsError || !settings) {
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบข้อมูลผู้ใช้ กรุณาผูกบัญชี LINE ด้วยคำสั่ง: bind your.email@company.com',
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
          }

          const targetUserId = settings.user_id;

          // Get user profile to determine role
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', targetUserId)
            .single();

          if (profileError || !profile) {
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบข้อมูลโปรไฟล์ผู้ใช้',
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
          }

          // เก็บ PDF ไว้ชั่วคราว (ใช้ Map - จะหายเมื่อ function restart แต่พอใช้ได้)
          // ใน production ควรใช้ database หรือ cache
          if (!pendingPdfs) {
            pendingPdfs = new Map<string, { buffer: ArrayBuffer; userId: string; profile: any }>();
          }
          pendingPdfs.set(lineUserId || '', { buffer: fileBuffer, userId: targetUserId, profile });

          const payload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: '📄 รับไฟล์ PDF แล้ว\n\nกรุณาส่งข้อความระบุเลขที่ตั๋ว เช่น:\n"Ticket #2501-001" หรือ "เลขที่ 2501-001"\n\nระบบจะอนุมัติอัตโนมัติเมื่อได้รับเลขที่ตั๋ว',
            }],
          };
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          continue;
        } catch (fileError) {
          console.error('[line-webhook] Error processing file:', fileError);
          const payload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: '❌ เกิดข้อผิดพลาดในการประมวลผลไฟล์',
            }],
          };
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          continue;
        }
      }

      // ====== Handle Text Messages ======
      if (event.message.type !== 'text' || !event.message.text) {
        continue;
      }

      const userText = event.message.text.trim();
      const lower = userText.toLowerCase();

      // ====== Handle Ticket Number + PDF Processing ======
      // รูปแบบ: "Ticket #2501-001" หรือ "เลขที่ 2501-001"
      const ticketNumberMatch = userText.match(/(?:Ticket|เลขที่|#)\s*([A-Z0-9-]+)/i);
      if (ticketNumberMatch && lineUserId) {
        const ticketNumber = ticketNumberMatch[1];

        try {
          // ตรวจสอบว่ามี PDF ที่เก็บไว้หรือไม่
          if (!pendingPdfs) {
            pendingPdfs = new Map();
          }
          const pendingPdf = pendingPdfs.get(lineUserId);

          if (!pendingPdf) {
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: `📋 พบตั๋วหมายเลข ${ticketNumber}\n\nกรุณาส่งไฟล์ PDF ที่เซ็นแล้วกลับมาก่อน\nระบบจะอนุมัติอัตโนมัติตามบทบาทของคุณ`,
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
          }

          const { buffer: fileBuffer, userId: targetUserId, profile } = pendingPdf;

          // หา ticket
          const { data: tickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, status')
            .eq('ticket_number', ticketNumber)
            .limit(1);

          if (!tickets || tickets.length === 0) {
            pendingPdfs.delete(lineUserId);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: `❌ ไม่พบตั๋วหมายเลข ${ticketNumber}\n\nกรุณาตรวจสอบเลขที่ตั๋วอีกครั้ง`,
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
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
            console.error('[line-webhook] Upload error:', uploadError);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการอัปโหลดไฟล์',
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
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
            pendingPdfs.delete(lineUserId);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ บทบาทของคุณไม่สามารถอัปเดตลายเซ็นได้',
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
          }

          // Update ticket
          const { error: updateError } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', ticket.id);

          if (updateError) {
            console.error('[line-webhook] Update error:', updateError);
            pendingPdfs.delete(lineUserId);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการอัปเดตตั๋ว',
              }],
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            continue;
          }

          // Auto-approve
          const level =
            role === 'inspector' ? 1 :
            role === 'manager' ? 2 :
            role === 'executive' ? 3 : null;

          if (level) {
            // เช็คว่ามี approval record อยู่แล้วหรือยัง
            const { data: existingApprovals } = await supabase
              .from('ticket_approvals')
              .select('*')
              .eq('ticket_id', ticket.id)
              .eq('approver_id', targetUserId)
              .eq('level', level)
              .eq('action', 'approved')
              .limit(1);

            if (!existingApprovals || existingApprovals.length === 0) {
              const approvalData: any = {
                ticket_id: ticket.id,
                approver_id: targetUserId,
                role_at_approval: role,
                action: 'approved',
                comments: 'Approved via LINE (signed PDF upload)',
                level: level,
              };

              await supabase.from('ticket_approvals').insert(approvalData);
            }

            const nextStatus =
              role === 'inspector' ? 'approved_inspector' :
              role === 'manager' ? 'approved_manager' :
              role === 'executive' ? 'ready_for_repair' :
              null;

            if (nextStatus) {
              await supabase
                .from('tickets')
                .update({ status: nextStatus })
                .eq('id', ticket.id);
            }
          }

          // ลบ PDF ที่เก็บไว้
          pendingPdfs.delete(lineUserId);

          // Send success message
          const roleLabels: Record<string, string> = {
            inspector: 'ผู้ตรวจสอบ',
            manager: 'ผู้จัดการ',
            executive: 'ผู้บริหาร',
          };

          const payload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text:
                `✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!\n\n` +
                `ตั๋วหมายเลข: ${ticket.ticket_number}\n` +
                `ผู้เซ็น: ${roleLabels[role] || role}\n` +
                `วันที่: ${new Date().toLocaleString('th-TH')}\n\n` +
                `ระบบได้บันทึกลายเซ็นและอนุมัติอัตโนมัติแล้ว`,
            }],
          };
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          continue;
        } catch (ticketError) {
          console.error('[line-webhook] Error processing ticket number:', ticketError);
          if (lineUserId && pendingPdfs) {
            pendingPdfs.delete(lineUserId);
          }
          continue;
        }
      }

      // ====== Command: bind email (ผูก LINE user กับ user ในระบบ) ======
      // รูปแบบ: "bind someone@example.com" หรือ "bind  someone@example.com" หรือ "bindsomeone@example.com" (รองรับทั้งมีและไม่มี space)
      if (lower.startsWith('bind')) {
        // หา email โดยตัด "bind" และ space/character พิเศษทั้งหมดออก
        // รองรับทั้ง "bind email" และ "bindemail"
        const emailMatch = userText.match(/^bind\s*(.+)$/i);
        if (!emailMatch || !emailMatch[1]) {
          const payload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: '❌ รูปแบบไม่ถูกต้อง\n\nให้พิมพ์:\n\nbind your.email@company.com\n\nหรือ\n\nbindyour.email@company.com',
            }],
          };
          const p = fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          replyPromises.push(p);
          continue;
        }
        
        // ทำความสะอาด email: ลบ space, character พิเศษ, และ trim
        const email = emailMatch[1].trim().replace(/[\u200B-\u200D\uFEFF]/g, ''); // ลบ zero-width space และ character พิเศษ
        const lineUserId = event.source?.userId;
        
        console.log(`[line-webhook] Bind command received: original="${userText}", email="${email}", lineUserId="${lineUserId}"`);

        if (!lineUserId) {
          const payload = {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: '❌ ไม่พบ LINE userId จาก event นี้ กรุณาลองใหม่อีกครั้ง',
              },
            ],
          };
          const p = fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          replyPromises.push(p);
          continue;
        }

        if (!email || !email.includes('@')) {
          const payload = {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: '❌ รูปแบบไม่ถูกต้อง\n\nให้พิมพ์:\n\nbind your.email@company.com',
              },
            ],
          };
          const p = fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          replyPromises.push(p);
          continue;
        }

        try {
          // หา user จาก email ในตาราง profiles
          console.log(`[line-webhook] Searching for user with email: "${email}"`);
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .ilike('email', email)
            .maybeSingle();

          if (profileError) {
            console.error(`[line-webhook] Error searching for profile:`, profileError);
          }

          if (profileError || !profile) {
            console.log(`[line-webhook] Profile not found for email: "${email}"`);
            const payload = {
              replyToken: event.replyToken,
              messages: [
                {
                  type: 'text',
                  text:
                    '❌ ไม่พบผู้ใช้ในระบบจากอีเมลนี้\n' +
                    'กรุณาตรวจสอบอีเมลให้ตรงกับที่ใช้ในระบบควบคุมยานพาหนะ',
                },
              ],
            };
            const p = fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
              },
              body: JSON.stringify(payload),
            });
            replyPromises.push(p);
            continue;
          }

          console.log(`[line-webhook] Profile found: id=${profile.id}, email=${profile.email}, name=${profile.full_name}`);
          
          // อัปเดต / สร้าง notification_settings ให้มี line_user_id
          const { data: existingSettings, error: settingsCheckError } = await supabase
            .from('notification_settings')
            .select('id')
            .eq('user_id', profile.id)
            .maybeSingle();

          if (settingsCheckError) {
            console.error(`[line-webhook] Error checking existing settings:`, settingsCheckError);
          }

          if (existingSettings) {
            console.log(`[line-webhook] Updating existing notification_settings for user ${profile.id} (settings id: ${existingSettings.id})`);
            
            // ตรวจสอบค่าเดิมก่อนอัปเดต
            const { data: beforeUpdate } = await supabase
              .from('notification_settings')
              .select('enable_line, line_user_id')
              .eq('id', existingSettings.id)
              .single();
            console.log(`[line-webhook] Before update: enable_line=${beforeUpdate?.enable_line}, line_user_id=${beforeUpdate?.line_user_id ? 'exists' : 'null'}`);
            
            // ใช้ update โดยตรง (service role key ควร bypass RLS ได้)
            const { data: updatedData, error: updateError } = await supabase
              .from('notification_settings')
              .update({
                line_user_id: lineUserId,
                enable_line: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingSettings.id)
              .select()
              .single();
            
            if (updateError) {
              console.error(`[line-webhook] Error updating notification_settings:`, updateError);
              console.error(`[line-webhook] Error details:`, JSON.stringify(updateError, null, 2));
              const payload = {
                replyToken: event.replyToken,
                messages: [{
                  type: 'text',
                  text: `❌ เกิดข้อผิดพลาดในการอัปเดตการตั้งค่า: ${updateError.message}\n\nกรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ`,
                }],
              };
              const p = fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${channelAccessToken}`,
                },
                body: JSON.stringify(payload),
              });
              replyPromises.push(p);
              continue;
            }
            
            // ตรวจสอบว่าอัปเดตสำเร็จจริงหรือไม่
            if (updatedData) {
              console.log(`[line-webhook] Successfully updated notification_settings for user ${profile.id}`);
              console.log(`[line-webhook] Updated values: enable_line=${updatedData.enable_line}, line_user_id=${updatedData.line_user_id ? updatedData.line_user_id.substring(0, 10) + '...' : 'null'}`);
              
              // ตรวจสอบอีกครั้งด้วย query แยก (รอสักครู่เพื่อให้ database sync)
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const { data: verifyData, error: verifyError } = await supabase
                .from('notification_settings')
                .select('enable_line, line_user_id')
                .eq('id', existingSettings.id)
                .single();
              
              if (verifyError) {
                console.error(`[line-webhook] Error verifying update:`, verifyError);
              } else if (verifyData) {
                console.log(`[line-webhook] Verification: enable_line=${verifyData.enable_line}, line_user_id=${verifyData.line_user_id ? 'exists' : 'null'}`);
                
                if (!verifyData.enable_line || !verifyData.line_user_id) {
                  console.error(`[line-webhook] WARNING: Update verification failed! enable_line=${verifyData.enable_line}, line_user_id=${verifyData.line_user_id ? 'exists' : 'null'}`);
                  console.error(`[line-webhook] This may indicate RLS blocking the update. Service role key should bypass RLS.`);
                }
              }
            } else {
              console.warn(`[line-webhook] Update returned no data - may have been blocked by RLS`);
              const payload = {
                replyToken: event.replyToken,
                messages: [{
                  type: 'text',
                  text: '⚠️ การอัปเดตอาจไม่สำเร็จ กรุณาตรวจสอบใน Settings หรือติดต่อผู้ดูแลระบบ',
                }],
              };
              const p = fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${channelAccessToken}`,
                },
                body: JSON.stringify(payload),
              });
              replyPromises.push(p);
              continue;
            }
          } else {
            console.log(`[line-webhook] Creating new notification_settings for user ${profile.id}`);
            const { data: insertedData, error: insertError } = await supabase
              .from('notification_settings')
              .insert({
                user_id: profile.id,
                enable_line: true,
                enable_telegram: false,
                line_token: null,
                line_user_id: lineUserId,
                telegram_bot_token: null,
                telegram_chat_id: null,
                notify_maintenance_due: true,
                notify_long_checkout: true,
                notify_ticket_created: true,
                notify_ticket_closed: true,
              })
              .select()
              .single();
            
            if (insertError) {
              console.error(`[line-webhook] Error inserting notification_settings:`, insertError);
              const payload = {
                replyToken: event.replyToken,
                messages: [{
                  type: 'text',
                  text: `❌ เกิดข้อผิดพลาดในการสร้างการตั้งค่า: ${insertError.message}\n\nกรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ`,
                }],
              };
              const p = fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${channelAccessToken}`,
                },
                body: JSON.stringify(payload),
              });
              replyPromises.push(p);
              continue;
            }
            
            if (insertedData) {
              console.log(`[line-webhook] Successfully created notification_settings for user ${profile.id}`);
              console.log(`[line-webhook] Created values: enable_line=${insertedData.enable_line}, line_user_id=${insertedData.line_user_id ? insertedData.line_user_id.substring(0, 10) + '...' : 'null'}`);
            } else {
              console.warn(`[line-webhook] Insert returned no data - may have been blocked by RLS`);
            }
          }

          const payload = {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text:
                  `✅ ผูกบัญชี LINE นี้กับผู้ใช้:\n` +
                  `- ชื่อ: ${profile.full_name || '-'}\n` +
                  `- อีเมล: ${profile.email || email}\n\n` +
                  `ต่อจากนี้เมื่อมีตั๋ว/แจ้งเตือนที่เกี่ยวข้อง บางส่วนจะถูกส่งมาทาง LINE ด้วยได้`,
              },
            ],
          };
          const p = fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          replyPromises.push(p);
        } catch (bindError) {
          console.error('[line-webhook] Error binding LINE user:', bindError);
          const payload = {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text:
                  '❌ เกิดข้อผิดพลาดระหว่างผูกบัญชี LINE กับผู้ใช้\n' +
                  'กรุณาลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบ',
              },
            ],
          };
          const p = fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify(payload),
          });
          replyPromises.push(p);
        }

        continue;
      }

      // ====== ข้อความทั่วไป / help ======
      let replyText =
        '👋 ระบบควบคุมยานพาหนะ (LINE)\n\n' +
        'รับข้อความของคุณแล้ว: "' + userText + '"\n' +
        'ตอนนี้ webhook ทำงานปกติ ✅\n\n' +
        'ถ้าต้องการผูก LINE กับบัญชีในระบบ พิมพ์:\n' +
        'bind your.email@company.com\n\n' +
        'หรือพิมพ์ "help" เพื่อดูวิธีใช้งานเพิ่มเติม';

      // ข้อความพิเศษเล็กน้อย สำหรับคำสั่ง help
      if (/^help$/i.test(userText) || /วิธี|ช่วย/i.test(userText)) {
        replyText =
          '📋 วิธีใช้งาน (เวอร์ชันทดสอบ)\n\n' +
          '1) ทดสอบว่า Bot ทำงาน:\n' +
          '   - พิมพ์ข้อความใด ๆ แล้วดูว่าระบบตอบกลับ\n\n' +
          '2) ผูก LINE กับบัญชีในระบบควบคุมยานพาหนะ:\n' +
          '   - พิมพ์: bind your.email@company.com\n' +
          '   - ใช้อีเมลเดียวกับที่ใช้ล็อกอินหน้าเว็บ\n\n' +
          'เมื่อผูกสำเร็จแล้ว ขั้นต่อไปคือการอนุมัติ/ส่ง PDF เหมือน Telegram';
      }

      const payload = {
        replyToken: event.replyToken,
        messages: [
          {
            type: 'text',
            text: replyText,
          },
        ],
      };

      const p = fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify(payload),
      });

      replyPromises.push(p);
    }

    // รันทุก reply แบบ parallel แต่ไม่ต้องรอผลละเอียด
    if (replyPromises.length > 0) {
      await Promise.allSettled(replyPromises);
    }

    return new Response(
      JSON.stringify({ received: true, events: events.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[line-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


