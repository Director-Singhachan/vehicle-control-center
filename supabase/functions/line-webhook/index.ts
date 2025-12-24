// Supabase Edge Function: line-webhook
// LINE Messaging API webhook
// Phase 1: รองรับข้อความทั่วไป + คำสั่ง bind email เพื่อผูก LINE userId กับ user ในระบบ
// Phase 2: รองรับการอนุมัติ/อัปโหลด PDF และปุ่มไม่อนุมัติ

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NOTE: We now use Supabase Storage + notification_settings table to store pending PDFs
// instead of in-memory Maps. This ensures data persists across function restarts.

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
          console.log(`[line-webhook] Looking for user with line_user_id: "${lineUserId}" for PDF file: ${fileName}`);
          
          if (!lineUserId) {
            console.error('[line-webhook] lineUserId is missing from event');
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบ LINE User ID จาก event กรุณาลองใหม่อีกครั้ง',
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

          // อาจมีข้อมูลซ้ำใน notification_settings (line_user_id เดียวหลายแถว) → เลือกแถวล่าสุด
          const { data: settings, error: settingsError } = await supabase
            .from('notification_settings')
            .select('user_id, line_user_id, enable_line')
            .eq('line_user_id', lineUserId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (settingsError) {
            console.error('[line-webhook] Error querying notification_settings:', settingsError);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล กรุณาลองใหม่อีกครั้ง',
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

          if (!settings) {
            console.warn(`[line-webhook] No notification_settings found for line_user_id: "${lineUserId}"`);
            // Debug: Check if any settings exist with this line_user_id
            const { data: allSettings } = await supabase
              .from('notification_settings')
              .select('user_id, line_user_id, enable_line')
              .not('line_user_id', 'is', null)
              .limit(5);
            console.log(`[line-webhook] Sample notification_settings with line_user_id:`, allSettings);
            
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบข้อมูลผู้ใช้ กรุณาผูกบัญชี LINE อีกครั้งด้วยคำสั่ง:\n\nbind your.email@company.com',
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

          console.log(`[line-webhook] Found user: user_id=${settings.user_id}, line_user_id=${settings.line_user_id?.substring(0, 10)}...`);

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

          // พยายามอ่านเลขที่ตั๋วจากชื่อไฟล์
          // รองรับรูปแบบ: Ticket_2512-012.pdf, inspector_Ticket_2512-001.pdf, 2512-012.pdf, Ticket #2512-012.pdf
          const ticketNumberFromFile = fileName.match(/(?:Ticket[_\s#]*)?(\d{4}-\d{3})/i)?.[1] || 
                                       fileName.match(/(\d{4}-\d{3})/)?.[1] || null;

          // ตรวจสอบว่ามี ticket number ที่รออยู่หรือไม่ (กรณีส่งข้อความมาก่อน)
          const { data: pendingTicketData } = await supabase
            .from('notification_settings')
            .select('line_pending_ticket_number')
            .eq('line_user_id', lineUserId || '')
            .maybeSingle();

          const pendingTicketNumber = (pendingTicketData as any)?.line_pending_ticket_number;
          const effectiveTicketNumber = ticketNumberFromFile || pendingTicketNumber || null;

          if (ticketNumberFromFile) {
            console.log(`[line-webhook] Found ticket number in filename: ${ticketNumberFromFile}`);
          }

          if (effectiveTicketNumber) {
            // ถ้ามี pending ticket number ให้ลบออกเพื่อป้องกันซ้ำ
            if (pendingTicketNumber) {
              await supabase
                .from('notification_settings')
                .update({ line_pending_ticket_number: null })
                .eq('line_user_id', lineUserId || '');
            }

            // หา ticket
            const { data: tickets } = await supabase
              .from('tickets')
              .select('id, ticket_number, status')
              .eq('ticket_number', effectiveTicketNumber)
              .limit(1);

            if (!tickets || tickets.length === 0) {
              const payload = {
                replyToken: event.replyToken,
                messages: [{
                  type: 'text',
                  text: `❌ ไม่พบตั๋วหมายเลข ${effectiveTicketNumber}\n\nกรุณาตรวจสอบเลขที่ตั๋วอีกครั้ง`,
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

            // Upload PDF ไปยัง signed-tickets
            // ใช้ชื่อไฟล์ที่มี ticket number เพื่อให้ดาวน์โหลดแล้วมีชื่อไฟล์ที่ถูกต้อง
            const ticketNumberForFilename = ticket.ticket_number.replace(/[#\s]/g, ''); // ลบ # และ space ออก
            const storageFileName = `signed-tickets/${ticket.id}/Ticket_${ticketNumberForFilename}.pdf`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('ticket-attachments')
              .upload(storageFileName, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true, // อนุญาตให้ overwrite ไฟล์เดิมได้ (กรณีที่อัปโหลดซ้ำหรืออัปเดต)
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

            const signedPdfUrl = publicUrl;

            // Update ticket signature URL based on user role
            const updateData: any = {};
            const role = profile.role;

            if (role === 'inspector') {
              updateData.inspector_signature_url = signedPdfUrl;
              updateData.inspector_signed_at = new Date().toISOString();
            } else if (role === 'manager') {
              updateData.manager_signature_url = signedPdfUrl;
              updateData.manager_signed_at = new Date().toISOString();
            } else if (role === 'executive') {
              updateData.executive_signature_url = signedPdfUrl;
              updateData.executive_signed_at = new Date().toISOString();
            } else {
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

            // Send success message
            const roleLabelsForPdf: Record<string, string> = {
              inspector: 'ผู้ตรวจสอบ',
              manager: 'ผู้จัดการ',
              executive: 'ผู้บริหาร',
            };

            const pdfSuccessPayload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text:
                  `✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!\n\n` +
                  `ตั๋วหมายเลข: ${ticket.ticket_number}\n` +
                  `ผู้เซ็น: ${roleLabelsForPdf[role] || role}\n` +
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
              body: JSON.stringify(pdfSuccessPayload),
            });

            // ส่งต่อผู้อนุมัติถัดไป (ใช้ signedPdfUrl)
            if (level && signedPdfUrl) {
              try {
                let nextApproverId: string | null = null;
                let nextLevel: number | null = null;
                let nextRole: string | null = null;

                if (level === 1) {
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
                  // Level 2 (manager) approved → send to executive (Level 3)
                  console.log('[line-webhook] Manager approved, looking for executive to send PDF');
                  const { data: executives } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'executive')
                    .limit(1);
                  if (executives && executives.length > 0) {
                    nextApproverId = executives[0].id;
                    nextLevel = 3;
                    nextRole = 'executive';
                    console.log(`[line-webhook] Found executive: ${nextApproverId}, will send PDF for Level 3 approval`);
                  } else {
                    console.warn('[line-webhook] No executive found in database');
                  }
                }

                if (nextApproverId && nextLevel && nextRole) {
                  const { data: ticketFullData } = await supabase
                    .from('tickets_with_relations')
                    .select('*')
                    .eq('id', ticket.id)
                    .maybeSingle();

                  if (ticketFullData) {
                    const levelLabels: Record<number, string> = {
                      2: 'Level 2 (ผู้จัดการ)',
                      3: 'Level 3 (ผู้บริหาร)',
                    };

                    const { error: notifyError } = await supabase
                      .from('notification_events')
                      .insert({
                        user_id: targetUserId,
                        channel: 'line',
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
                          `กรุณาเซ็น PDF แล้วส่งกลับมาพร้อมระบุเลขที่ตั๋ว`,
                        payload: {
                          ticket_id: ticket.id,
                          ticket_number: ticket.ticket_number,
                          approval_level: nextLevel,
                          approval_role: nextRole,
                          previous_level: level,
                          pdf_url: signedPdfUrl,
                        },
                        target_user_id: nextApproverId,
                        status: 'pending',
                      });

                    if (notifyError) {
                      console.error('[line-webhook] Error creating notification event for next approver:', notifyError);
                    } else {
                      console.log(`[line-webhook] Created notification event for next approver (${nextRole}, user_id: ${nextApproverId}, ticket: ${ticket.ticket_number})`);
                      try {
                        await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${serviceKey}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ source: 'line-webhook', event_type: 'ticket_pdf_for_approval' }),
                        });
                        console.log(`[line-webhook] Triggered notification-worker for ${nextRole}`);
                      } catch (invokeError) {
                        console.warn('[line-webhook] Failed to trigger notification-worker:', invokeError);
                      }
                    }
                  }
                }
              } catch (nextApproverError) {
                console.error('[line-webhook] Error sending to next approver:', nextApproverError);
              }
            }

            continue;
          }

          // ไม่มี ticket number ในไฟล์และไม่มี pending ticket number → อัปโหลด PDF ไปยัง Storage ทันทีเพื่อเก็บไว้
          const timestamp = Date.now();
          const tempStorageFileName = `pending-pdfs/${lineUserId || 'unknown'}/${timestamp}.pdf`;

          console.log(`[line-webhook] No pending ticket number, uploading PDF to storage: ${tempStorageFileName}`);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(tempStorageFileName, fileBuffer, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('[line-webhook] Error uploading PDF to storage:', uploadError);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง',
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

          // เก็บ metadata ไว้ใน notification_settings
          await supabase
            .from('notification_settings')
            .update({
              line_pending_pdf_path: tempStorageFileName,
              line_pending_pdf_uploaded_at: new Date().toISOString(),
            })
            .eq('line_user_id', lineUserId || '');

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
          // หา user จาก line_user_id
          console.log(`[line-webhook] Looking for user with line_user_id: "${lineUserId}" for ticket number: ${ticketNumber}`);
          
          if (!lineUserId) {
            console.error('[line-webhook] lineUserId is missing from event');
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบ LINE User ID จาก event กรุณาลองใหม่อีกครั้ง',
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

          const { data: settings, error: settingsError } = await supabase
            .from('notification_settings')
            .select('user_id, line_user_id, enable_line')
            .eq('line_user_id', lineUserId)
            .maybeSingle();

          if (settingsError) {
            console.error('[line-webhook] Error querying notification_settings:', settingsError);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล กรุณาลองใหม่อีกครั้ง',
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

          if (!settings) {
            console.warn(`[line-webhook] No notification_settings found for line_user_id: "${lineUserId}"`);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ ไม่พบข้อมูลผู้ใช้ กรุณาผูกบัญชี LINE อีกครั้งด้วยคำสั่ง:\n\nbind your.email@company.com',
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

          console.log(`[line-webhook] Found user: user_id=${settings.user_id}, line_user_id=${settings.line_user_id?.substring(0, 10)}...`);

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

          // ตรวจสอบว่ามี PDF ที่เก็บไว้ใน Storage หรือไม่
          const { data: pdfSettings } = await supabase
            .from('notification_settings')
            .select('line_pending_pdf_path, line_pending_pdf_uploaded_at')
            .eq('line_user_id', lineUserId || '')
            .maybeSingle();

          const pendingPdfPath = (pdfSettings as any)?.line_pending_pdf_path;
          const pdfUploadedAt = (pdfSettings as any)?.line_pending_pdf_uploaded_at;

          console.log(`[line-webhook] Looking for PDF, ticketNumber: ${ticketNumber}, lineUserId: ${lineUserId}`);
          console.log(`[line-webhook] Pending PDF path: ${pendingPdfPath}`);

          if (!pendingPdfPath) {
            // ไม่มี PDF → เก็บ ticket number ไว้รอ PDF
            await supabase
              .from('notification_settings')
              .update({ line_pending_ticket_number: ticketNumber })
              .eq('line_user_id', lineUserId || '');

            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: `📋 พบตั๋วหมายเลข ${ticketNumber}\n\nกรุณาส่งไฟล์ PDF ที่เซ็นแล้วกลับมา\nระบบจะอนุมัติอัตโนมัติตามบทบาทของคุณ`,
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

          // มี PDF → ดาวน์โหลดจาก Storage และประมวลผลทันที
          console.log(`[line-webhook] ✅ Found pending PDF at: ${pendingPdfPath}, downloading...`);

          const { data: pdfFile, error: downloadError } = await supabase.storage
            .from('ticket-attachments')
            .download(pendingPdfPath);

          if (downloadError || !pdfFile) {
            console.error('[line-webhook] Error downloading PDF from storage:', downloadError);
            const payload = {
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '❌ เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ PDF กรุณาส่งไฟล์ใหม่',
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
            // ลบ pending PDF path
            await supabase
              .from('notification_settings')
              .update({ line_pending_pdf_path: null, line_pending_pdf_uploaded_at: null })
              .eq('line_user_id', lineUserId || '');
            continue;
          }

          const fileBuffer = await pdfFile.arrayBuffer();

          // ลบ pending PDF path
          await supabase
            .from('notification_settings')
            .update({ line_pending_pdf_path: null, line_pending_pdf_uploaded_at: null })
            .eq('line_user_id', lineUserId || '');

          // ใช้ profile จาก database (เพราะอาจมาจากการส่ง PDF ก่อน)
          // หา ticket
          const { data: tickets } = await supabase
            .from('tickets')
            .select('id, ticket_number, status')
            .eq('ticket_number', ticketNumber)
            .limit(1);

          if (!tickets || tickets.length === 0) {
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

          // Copy PDF จาก pending-pdfs ไป signed-tickets (ย้ายไฟล์)
          // ใช้ชื่อไฟล์ที่มี ticket number เพื่อให้ดาวน์โหลดแล้วมีชื่อไฟล์ที่ถูกต้อง
          const ticketNumberForFilename = ticket.ticket_number.replace(/[#\s]/g, ''); // ลบ # และ space ออก
          const storageFileName = `signed-tickets/${ticket.id}/Ticket_${ticketNumberForFilename}.pdf`;

          // อัปโหลด PDF ใหม่ไปยัง signed-tickets (ใช้ fileBuffer ที่ดาวน์โหลดมา)
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(storageFileName, fileBuffer, {
              contentType: 'application/pdf',
              upsert: true, // อนุญาตให้ overwrite ไฟล์เดิมได้ (กรณีที่อัปโหลดซ้ำหรืออัปเดต)
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

          // ลบไฟล์ PDF ชั่วคราว (pending-pdfs)
          try {
            await supabase.storage
              .from('ticket-attachments')
              .remove([pendingPdfPath]);
          } catch (removeError) {
            console.warn('[line-webhook] Failed to remove pending PDF:', removeError);
            // ไม่ต้อง fail ทั้งหมด แค่ log warning
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('ticket-attachments')
            .getPublicUrl(storageFileName);

          // เก็บ publicUrl ไว้เพื่อใช้ส่งต่อไปให้ผู้อนุมัติถัดไป
          const signedPdfUrl = publicUrl;

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

          // ส่ง PDF ไปหาผู้อนุมัติถัดไป (ถ้าอนุมัติแล้ว)
          // ใช้ signedPdfUrl ที่เก็บไว้จาก PDF ที่ inspector/manager เซ็นแล้ว
          if (level && signedPdfUrl) {
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
                // Level 2 (manager) approved → send to executive (Level 3)
                console.log('[line-webhook] Manager approved, looking for executive to send PDF');
                const { data: executives } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('role', 'executive')
                  .limit(1);
                if (executives && executives.length > 0) {
                  nextApproverId = executives[0].id;
                  nextLevel = 3;
                  nextRole = 'executive';
                  console.log(`[line-webhook] Found executive: ${nextApproverId}, will send PDF for Level 3 approval`);
                } else {
                  console.warn('[line-webhook] No executive found in database');
                }
              }
              // Level 3 is final, no next approver

              if (nextApproverId && nextLevel && nextRole) {
                // Get ticket data for notification
                const { data: ticketFullData } = await supabase
                  .from('tickets_with_relations')
                  .select('*')
                  .eq('id', ticket.id)
                  .maybeSingle();

                if (ticketFullData) {
                  const levelLabels: Record<number, string> = {
                    2: 'Level 2 (ผู้จัดการ)',
                    3: 'Level 3 (ผู้บริหาร)',
                  };

                  // สร้าง notification event สำหรับผู้อนุมัติถัดไป
                  const { error: notifyError } = await supabase
                    .from('notification_events')
                    .insert({
                      user_id: targetUserId, // User who approved (for event tracking)
                      channel: 'line',
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
                        `กรุณาเซ็น PDF แล้วส่งกลับมาพร้อมระบุเลขที่ตั๋ว`,
                      payload: {
                        ticket_id: ticket.id,
                        ticket_number: ticket.ticket_number,
                        approval_level: nextLevel,
                        approval_role: nextRole,
                        previous_level: level,
                        pdf_url: signedPdfUrl, // เก็บ URL ของ PDF ที่เซ็นแล้ว (จาก inspector/manager) เพื่อส่งต่อไปให้ผู้อนุมัติถัดไป
                      },
                      target_user_id: nextApproverId,
                      status: 'pending',
                      // ไม่ใส่ pdf_data - ใช้ pdf_url แทน
                    });

                  if (notifyError) {
                    console.error('[line-webhook] Error creating notification event for next approver:', notifyError);
                  } else {
                    console.log(`[line-webhook] Created notification event for next approver (${nextRole}, user_id: ${nextApproverId}, ticket: ${ticket.ticket_number})`);
                    // Trigger notification-worker to process immediately
                    try {
                      await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${serviceKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ source: 'line-webhook', event_type: 'ticket_pdf_for_approval' }),
                      });
                      console.log(`[line-webhook] Triggered notification-worker for ${nextRole}`);
                    } catch (invokeError) {
                      console.warn('[line-webhook] Failed to trigger notification-worker:', invokeError);
                      // Continue anyway - cron job will pick it up
                    }
                  }
                }
              }
            } catch (nextApproverError) {
              console.error('[line-webhook] Error sending to next approver:', nextApproverError);
              // Don't fail the whole approval - just log the error
            }
          }

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

          // Send success message
          const roleLabelsForFinal: Record<string, string> = {
            inspector: 'ผู้ตรวจสอบ',
            manager: 'ผู้จัดการ',
            executive: 'ผู้บริหาร',
          };

          const finalSuccessPayload = {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text:
                `✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!\n\n` +
                `ตั๋วหมายเลข: ${ticket.ticket_number}\n` +
                `ผู้เซ็น: ${roleLabelsForFinal[role] || role}\n` +
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
            body: JSON.stringify(finalSuccessPayload),
          });
          continue;
        } catch (ticketError) {
          console.error('[line-webhook] Error processing ticket number:', ticketError);
          // ลบ pending PDF path จาก database ถ้ามี
          if (lineUserId) {
            await supabase
              .from('notification_settings')
              .update({
                line_pending_pdf_path: null,
                line_pending_pdf_uploaded_at: null,
                line_pending_ticket_number: null
              })
              .eq('line_user_id', lineUserId || '');
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
        const rawEmail = emailMatch[1].trim();
        const email = rawEmail.replace(/[\s\u200B-\u200D\uFEFF]/g, ''); // ลบ space ทั้งหมดและ character พิเศษ
        const lineUserId = event.source?.userId;

        console.log(`[line-webhook] Bind command received: email="${email}" (raw="${rawEmail}"), lineUserId="${lineUserId}"`);

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
          console.log(`[line-webhook] Searching for user with email: "${email}" (cleaned)`);

          // ค้นหา profile จาก profiles table (เนื่องจาก email อาจไม่ sync กับ auth.users)
          // ใช้ ilike สำหรับ case-insensitive search
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .ilike('email', email)
            .maybeSingle();

          if (profileError) {
            console.error('[line-webhook] Error searching profile:', profileError);
          }

          if (!profile) {
            // Debug: Check if any profiles exist and list some emails for debugging
            const { count: totalProfiles } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true });

            // Get a few sample emails for debugging (not user's email for privacy)
            const { data: sampleProfiles } = await supabase
              .from('profiles')
              .select('email')
              .limit(3);

            console.warn(`[line-webhook] Profile NOT found for email: "${email}"`);
            console.warn(`[line-webhook] Total profiles in DB: ${totalProfiles}`);
            if (sampleProfiles && sampleProfiles.length > 0) {
              console.warn(`[line-webhook] Sample email formats in DB: ${sampleProfiles.map(p => p.email).join(', ')}`);
            }

            const payload = {
              replyToken: event.replyToken,
              messages: [
                {
                  type: 'text',
                  text: `❌ ไม่พบบัญชีที่ผูกกับอีเมล: ${email}\n\nกรุณาตรวจสอบ:\n1. อีเมลที่พิมพ์ตรงกับอีเมลที่ใช้ล็อกอินเข้าเว็บแอป\n2. คุณได้ลงทะเบียนและยืนยันอีเมลเรียบร้อยแล้ว\n3. ลองพิมพ์ email อีกครั้งโดยไม่มีช่องว่าง`,
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

          const finalProfile = profile;

          console.log(`[line-webhook] Final profile: id=${finalProfile.id}, email=${finalProfile.email}, name=${finalProfile.full_name}`);

          // อัปเดต / สร้าง notification_settings ให้มี line_user_id
          const { data: existingSettings, error: settingsCheckError } = await supabase
            .from('notification_settings')
            .select('id')
            .eq('user_id', finalProfile.id)
            .maybeSingle();

          if (settingsCheckError) {
            console.error(`[line-webhook] Error checking existing settings:`, settingsCheckError);
          }

          if (existingSettings) {
            console.log(`[line-webhook] Updating existing notification_settings for user ${finalProfile.id} (settings id: ${existingSettings.id})`);

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
              console.log(`[line-webhook] Successfully updated notification_settings for user ${finalProfile.id}`);
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
            console.log(`[line-webhook] Creating new notification_settings for user ${finalProfile.id}`);
            const { data: insertedData, error: insertError } = await supabase
              .from('notification_settings')
              .insert({
                user_id: finalProfile.id,
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
              console.log(`[line-webhook] Successfully created notification_settings for user ${finalProfile.id}`);
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
                  `- ชื่อ: ${finalProfile.full_name || '-'}\n` +
                  `- อีเมล: ${finalProfile.email || email}\n\n` +
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


