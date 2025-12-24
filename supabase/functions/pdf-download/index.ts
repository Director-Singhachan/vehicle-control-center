// Supabase Edge Function: pdf-download
// Proxy endpoint สำหรับดาวน์โหลด PDF ที่รองรับ iOS
// ส่ง PDF พร้อม headers ที่ถูกต้องสำหรับการดาวน์โหลดบน iOS Safari

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');

    // filename: จาก query string ถ้ามี, ไม่เช่นนั้นใช้ segment ท้ายของ URL (/pdf-download/<filename>)
    const pathnameParts = url.pathname.split('/').filter(Boolean);
    const filenameFromPath = pathnameParts.length > 1 ? decodeURIComponent(pathnameParts[pathnameParts.length - 1]) : null;
    const filename = url.searchParams.get('filename') || filenameFromPath || 'document.pdf';

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ตรวจสอบความปลอดภัย: อนุญาตเฉพาะ path ที่อยู่ใน ticket-attachments bucket
    // และต้องอยู่ในโฟลเดอร์ signed-tickets หรือ ticket-pdfs เท่านั้น
    const allowedPrefixes = ['signed-tickets/', 'ticket-pdfs/'];
    const isAllowedPath = allowedPrefixes.some(prefix => path.startsWith(prefix));
    
    if (!isAllowedPath) {
      console.warn(`[pdf-download] Unauthorized path access attempt: ${path}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized path' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ตรวจสอบว่า path ไม่มี path traversal (../)
    if (path.includes('..') || path.includes('//')) {
      console.warn(`[pdf-download] Path traversal attempt: ${path}`);
      return new Response(
        JSON.stringify({ error: 'Invalid path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download PDF from Storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('ticket-attachments')
      .download(path);

    if (downloadError || !pdfData) {
      console.error('[pdf-download] Error downloading PDF:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF', details: downloadError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert blob to array buffer
    const arrayBuffer = await pdfData.arrayBuffer();

    // Set headers for iOS compatibility
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': arrayBuffer.byteLength.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return new Response(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[pdf-download] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

