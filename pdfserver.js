// ========================================
// PDF Export Service
// Handles both client-side PDF generation and backend PDF generation
// ========================================

import { apiGetVehicleHistory, apiGetSignatureImage } from './apiConfig';
import { supabase } from '@/supabaseClient';
// Note: GAS backend PDF generation has been removed. Only client-side PDF generation is used.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ========================================
// Backend PDF Generation (Deprecated)
// ========================================

/**
 * Generate PDF from ticket data using backend
 * @deprecated Backend PDF generation has been removed. Use generateClientPDF() instead.
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} { success: boolean, pdfUrl: string, downloadUrl: string }
 */
export async function apiGeneratePDF(ticketId) {
  console.warn('⚠️ Backend PDF generation is deprecated. Use generateClientPDF() instead.');
  throw new Error('Backend PDF generation has been removed. Use generateClientPDF() instead.');
}

/**
 * Load Thai font (THSarabun) from TTF files and add to jsPDF
 * @param {jsPDF} doc - jsPDF document instance
 */
async function loadThaiFont(doc) {
  try {
    const { loadFontAsBase64 } = await import('@/utils/fontLoader');
    
    const [sarabunNormalB64, sarabunBoldB64] = await Promise.all([
      loadFontAsBase64('/fonts/THSarabunNew.ttf'),
      loadFontAsBase64('/fonts/THSarabunNew-Bold.ttf'),
    ]);

    doc.addFileToVFS('THSarabun.ttf', sarabunNormalB64);
    doc.addFont('THSarabun.ttf', 'THSarabun', 'normal');
    doc.addFileToVFS('THSarabun-Bold.ttf', sarabunBoldB64);
    doc.addFont('THSarabun-Bold.ttf', 'THSarabun', 'bold');

    console.log('✅ Thai font (THSarabun) loaded successfully');
  } catch (error) {
    console.warn('Failed to load Thai font, using default font:', error);
    throw error;
  }
}

/**
 * Load image from URL and convert to base64 data URL
 * @param {string} url - Image URL
 * @returns {Promise<string>} Base64 data URL
 */
async function loadImageAsDataURL(url) {
  if (!url) return null;
  
  try {
    // ถ้าเป็น base64 data URL อยู่แล้ว ให้คืนค่าทันที
    if (url.startsWith('data:')) {
      return url;
    }
    
    // แปลง Google Drive URL เป็น viewable format
    let imageUrl = url;
    if (url.includes('drive.google.com/file/d/')) {
      const fileId = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
      if (fileId) {
        imageUrl = `https://drive.google.com/uc?id=${fileId}`;
      }
    }
    
    // โหลดรูปภาพผ่าน CORS proxy หรือ direct
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to load image: ${imageUrl}`);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading image:', error);
    return null;
  }
}

/**
 * Load company logo from assets
 * (ยังคงไว้ใช้ในอนาคตถ้าต้องการรูปจริง แต่ header หลักจะใช้ vector แทน)
 * @returns {Promise<string|null>} Base64 data URL or null
 */
async function loadCompanyLogo() {
  try {
    // ลองใช้ dynamic import จาก Vite (เหมือน DigitalRepairForm.vue ที่ใช้ '@/assets/images/company-header.png')
    try {
      const logoModule = await import('@/assets/images/company-header.png');
      if (logoModule.default) {
        // Vite จะ return URL สำหรับรูปภาพ - แปลงเป็น data URL
        const dataUrl = await loadImageAsDataURL(logoModule.default);
        if (dataUrl) {
          console.log('✅ Company logo loaded via Vite import');
          return dataUrl;
        }
      }
    } catch (importError) {
      console.log('Could not import logo via Vite, trying direct paths...', importError);
    }
    
    // ถ้า import ไม่ได้ ลองโหลดจาก public folder
    const possiblePaths = [
      '/assets/images/company-header.png', // Vite public assets
      '/images/company-header.png' // public/images/
    ];
    
    for (const path of possiblePaths) {
      try {
        const dataUrl = await loadImageAsDataURL(path);
        if (dataUrl && dataUrl.startsWith('data:image')) {
          console.log('✅ Company logo loaded from:', path);
          return dataUrl;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.warn('Could not load company logo:', error);
  }
  return null;
}

// Public helper สำหรับไฟล์ PDF อื่นๆ ที่ต้องการใช้โลโก้บริษัท (ยังไม่ใช้ใน header ใหม่)
export async function getCompanyLogoDataUrl() {
  return await loadCompanyLogo();
}

/**
 * วาด Header บริษัทแบบ Vector (ไม่ใช้รูปภาพ)
 * ใช้ได้ทั้งใบแจ้งซ่อมหลักและใบสรุปค่าใช้จ่าย
 * @param {jsPDF} doc
 * @param {Object} options
 * @param {string} options.title - ข้อความหลัก เช่น "ใบแจ้งซ่อมรถ 6811-013"
 * @param {string} options.ticketIdText - ข้อความรอง เช่น "เลขที่ใบแจ้งซ่อม: 6811-013"
 * @param {string} options.dateText - ข้อความวันที่ เช่น "วันที่: 11 กันยายน 2568" หรือ "วันที่พิมพ์: ..."
 * @returns {number} y ตำแหน่งถัดไปหลัง header
 */
export function drawPdfHeader(doc, { title, ticketIdText, dateText }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;
  const headerHeight = 26;
  let y = 10;

  // กล่องพื้นหลังหัวกระดาษ (สีน้ำเงิน)
  doc.setFillColor(52, 152, 219);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, headerHeight, 3, 3, 'F');
  } else {
    doc.rect(marginX, y, pageWidth - marginX * 2, headerHeight, 'F');
  }

  // ข้อความหลัก (Title)
  doc.setFont('THSarabun', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(title || '', pageWidth / 2, y + 9, { align: 'center' });

  // ข้อความรอง (Ticket ID)
  if (ticketIdText) {
    doc.setFont('THSarabun', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(230, 242, 255);
    doc.text(ticketIdText, pageWidth / 2, y + 16, { align: 'center' });
  }

  // วันที่ (แสดงด้านล่าง)
  if (dateText) {
    doc.setFont('THSarabun', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(dateText, pageWidth / 2, y + 22, { align: 'center' });
  }

  return y + headerHeight + 8;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0';
  return Number(num).toLocaleString('th-TH');
}

/**
 * Format date to Thai format with Buddhist calendar (พ.ศ.)
 * แปลงปี ค.ศ. เป็น พ.ศ. โดยการบวก 543
 * แสดงเฉพาะวันที่ (ไม่แสดงเวลา)
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // ตรวจสอบว่า date ถูกต้องหรือไม่
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return '-';
  }
  
  // แปลงปี ค.ศ. เป็น พ.ศ. โดยการบวก 543
  const adYear = date.getFullYear(); // ปี ค.ศ.
  const beYear = adYear + 543; // ปี พ.ศ.
  
  // แสดงเดือนและวันในรูปแบบไทย (ไม่มีเวลา)
  const month = date.toLocaleString('th-TH', { month: 'long' });
  const day = date.getDate();
  
  const result = `${day} ${month} ${beYear}`;
  console.log('📄 Formatted date (no time):', { original: dateString, result });
  return result;
}

/**
 * Format date to Thai format (date only, no time) with Buddhist calendar (พ.ศ.)
 * แปลงปี ค.ศ. เป็น พ.ศ. โดยการบวก 543
 */
function formatDateOnly(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // ตรวจสอบว่า date ถูกต้องหรือไม่
  if (isNaN(date.getTime())) return '-';
  
  // แปลงปี ค.ศ. เป็น พ.ศ. โดยการบวก 543
  const adYear = date.getFullYear(); // ปี ค.ศ.
  const beYear = adYear + 543; // ปี พ.ศ.
  
  // แสดงเดือนและวันในรูปแบบไทย
  const month = date.toLocaleString('th-TH', { month: 'long' });
  const day = date.getDate();
  
  return `${day} ${month} ${beYear}`;
}

/**
 * Safely convert value to string for PDF output
 * Prevents jsPDF.text() errors from undefined/null values
 */
function safeString(value, defaultValue = '-') {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  return String(value);
}

/**
 * Extract approver name from old format "APPROVED by NAME on DATE" or just return the name
 */
function extractApproverName(value) {
  if (!value) return null;
  const str = String(value);
  // ถ้าเป็นรูปแบบเก่า "APPROVED by NAME on DATE" ให้ดึงเฉพาะชื่อ
  const match = str.match(/^APPROVED by (.+?) on .+$/);
  if (match) {
    return match[1].trim();
  }
  // ถ้าไม่ใช่รูปแบบเก่า ให้คืนค่าเหมือนเดิม
  return str;
}

/**
 * Get status display name in Thai
 */
function getStatusName(status) {
  const statusMap = {
    'Pending': 'รอดำเนินการ',
    'Approved by Inspector': 'ผู้ตรวจสอบอนุมัติ',
    'Approved by Manager': 'ผู้จัดการอนุมัติ',
    'Approved by Executive': 'ผู้บริหารอนุมัติ',
    'Ready for Repair': 'พร้อมซ่อม',
    'In Progress': 'กำลังซ่อม',
    'Ready for Cost Entry': 'รอลงค่าใช้จ่าย',
    'Completed': 'เสร็จสิ้น',
    'Cancelled': 'ยกเลิก'
  };
  return statusMap[status] || status;
}

/**
 * Generate PDF on client-side using jsPDF
 * @param {Object} ticket - Ticket data
 * @param {Array} costs - Cost items (optional)
 * @returns {Promise<void>}
 */
export async function generateClientPDF(ticket, costs = []) {
  // ไม่แสดงค่าใช้จ่ายใน PDF - ส่วนที่เกี่ยวกับค่าใช้จ่ายถูกลบออกทั้งหมดแล้ว
  
  // ดึงประวัติการซ่อมครั้งล่าสุด (ถ้ามี)
  let lastRepairHistory = null;
  const vehiclePlate = ticket.VehiclePlate || ticket.vehicle;
  if (vehiclePlate) {
    try {
      const historyResult = await apiGetVehicleHistory(vehiclePlate);
      if (historyResult && historyResult.tickets && historyResult.tickets.length > 1) {
        // ครั้งล่าสุดคือ ticket[0] แต่เราต้องการครั้งก่อนหน้า (index 1)
        lastRepairHistory = historyResult.tickets[1];
      }
    } catch (error) {
      console.warn('Could not load repair history:', error);
    }
  }

  try {
    console.log('📄 Generating client-side PDF...', ticket);
    console.log('🔍 Garage field check:', { 
      'ticket.Garage': ticket.Garage, 
      'ticket.garage': ticket.garage 
    });

    // Create new PDF document first (หน้าเดียว A4)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Load Thai font (THSarabun)
    await loadThaiFont(doc);

    let yPos = 8; // เริ่มต้นที่ 8mm จากด้านบน

    // โหลดโลโก้บริษัท (ถ้ามี) - ใส่ที่ด้านบนสุด (เล็กลง)
    const companyLogo = await loadCompanyLogo();
    if (companyLogo) {
      try {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            // โลโก้ใหม่ - ลดขนาดลงเหลือ 80%
            const logoWidth = 136; // 80% ของ 170
            const logoHeight = Math.min((img.height / img.width) * logoWidth, 28); // จำกัดสูงสุด 28mm
            const logoX = (210 - logoWidth) / 2; // กึ่งกลางหน้า A4 (210mm)
            
            try {
              doc.addImage(companyLogo, 'PNG', logoX, yPos, logoWidth, logoHeight, undefined, 'FAST');
              yPos += logoHeight + 8; // เพิ่ม margin เพื่อห่างจากหัวข้อ
              console.log('✅ Company logo added to PDF');
            } catch (e) {
              console.warn('Failed to add company logo to PDF:', e);
            }
            resolve();
          };
          img.onerror = () => {
            console.warn('Failed to load company logo image');
            resolve();
          };
          img.src = companyLogo;
        });
      } catch (logoError) {
        console.warn('Failed to add company logo:', logoError);
      }
    }

    // หัวข้อเอกสาร (กึ่งกลาง)
    doc.setFont('THSarabun', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.text('ใบแจ้งซ่อมรถ', 105, yPos, { align: 'center' });

    yPos += 6; // spacing
    
    // เลขที่เอกสาร - อยู่ใต้คำว่า "ใบแจ้งซ่อมรถ" ชิดขวา
    doc.setFont('THSarabun', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(52, 152, 219);
    const ticketIdText = `เลขที่เอกสาร: ${safeString(ticket.ticketNumber || ticket.TicketID || ticket.id)}`;
    doc.text(ticketIdText, 190, yPos, { align: 'right' }); // ชิดขวา
    
    yPos += 10; // เพิ่ม spacing ก่อนเส้นคั่น
    // Divider line
    doc.setDrawColor(52, 152, 219);
    doc.setLineWidth(0.3); // ลดความหนา
    doc.line(20, yPos, 190, yPos);

    yPos += 6; // ลด spacing

    // แบ่งเป็น 2 คอลัมน์: ซ้าย (ข้อมูลทั่วไป) + ขวา (ข้อมูลรถยนต์)
    const leftColX = 20; // คอลัมน์ซ้าย
    const rightColX = 115; // คอลัมน์ขวา (เริ่มจากตรงกลาง + 5mm)
    const colWidth = 85; // ความกว้างแต่ละคอลัมน์

    // === คอลัมน์ซ้าย: ข้อมูลทั่วไป ===
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(leftColX, yPos, colWidth, 5, 'F');
    doc.setFont('THSarabun', 'bold');
    doc.text('📋 ข้อมูลทั่วไป', leftColX + 2, yPos + 3.5);

    yPos += 10; // เพิ่มจาก 8 เป็น 10 เพื่อให้ห่างจากหัวข้อมากขึ้น
    doc.setFontSize(11); // เพิ่มจาก 9 +2
    doc.setFont('THSarabun', 'normal');

    const generalData = [
      // ใช้ timestamp (ISO) เป็นหลักเพื่อไม่ให้ปี พ.ศ. ถูกบวกซ้ำ
      ['วันที่:', formatDate(ticket.timestamp || ticket.Timestamp)],
      ['สถานะ:', safeString(getStatusName(ticket.Status || ticket.status))],
      ['ผู้แจ้ง:', safeString(ticket.Reporter || ticket.reporter)],
      ['สาขา:', safeString(ticket.Branch || ticket.branch)]
    ];

    const leftColYStart = yPos;
    const headerY = yPos - 10; // เก็บตำแหน่งหัวข้อเพื่อใช้กับคอลัมน์ขวา
    
    generalData.forEach(([label, value]) => {
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.setFont('THSarabun', 'normal');
      doc.text(safeString(label), leftColX + 3, yPos);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      doc.text(safeString(value), leftColX + 30, yPos); // เพิ่มจาก 20 เป็น 30 เพื่อให้ห่าง
      yPos += 7; // เพิ่มจาก 5.5 เป็น 7 เพื่อให้ห่างขึ้น
    });

    // === คอลัมน์ขวา: ข้อมูลรถยนต์ ===
    const rightColY = leftColYStart; // เริ่มที่บรรทัดเดียวกับคอลัมน์ซ้าย
    
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(rightColX, headerY, colWidth, 5, 'F');
    doc.setFont('THSarabun', 'bold');
    doc.text('🚗 ข้อมูลรถยนต์', rightColX + 2, headerY + 3.5);

    yPos = rightColY;
    doc.setFontSize(11); // เพิ่มจาก 9 +2
    doc.setFont('THSarabun', 'normal');

    const vehicleData = [
      ['ทะเบียน:', safeString(ticket.VehiclePlate || ticket.vehicle)],
      ['ยี่ห้อ/รุ่น:', safeString(`${ticket.Make || ticket.make || ''} ${ticket.Model || ticket.model || ''}`.trim())],
      ['ประเภท:', safeString(ticket.Type || ticket.type)],
      ['เลขไมล์:', `${formatNumber(ticket.Odometer || ticket.odometer)} km`]
    ];

    vehicleData.forEach(([label, value]) => {
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.setFont('THSarabun', 'normal');
      doc.text(safeString(label), rightColX + 3, yPos);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      doc.text(safeString(value), rightColX + 30, yPos); // เพิ่มจาก 20 เป็น 30 เพื่อให้ห่าง
      yPos += 7; // เพิ่มจาก 5.5 เป็น 7 เพื่อให้ห่างขึ้น
    });

    // ใช้ yPos ที่มากกว่าเพื่อวางต่อไป
    yPos = Math.max(leftColYStart + generalData.length * 7, rightColY + vehicleData.length * 7) + 5;

    // === รายละเอียดการซ่อม + ประวัติการซ่อม (2 คอลัมน์) ===
    const repairDetailYStart = yPos;
    let leftColYEnd = yPos; // จบที่ตรงไหนของคอลัมน์ซ้าย
    let rightColYEnd = yPos; // จบที่ตรงไหนของคอลัมน์ขวา
    
    // คอลัมน์ซ้าย: รายละเอียดการซ่อม
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(leftColX, yPos, colWidth, 5, 'F');
    doc.setFont('THSarabun', 'bold');
    doc.text('🔧 รายละเอียดการซ่อม', leftColX + 2, yPos + 3.5);

    leftColYEnd += 10; // เพิ่มจาก 8 เป็น 10 เพื่อให้ห่างจากหัวข้อมากขึ้น
    doc.setFontSize(11); // เพิ่มจาก 9 +2
    doc.setFont('THSarabun', 'normal');

    doc.setTextColor(70, 70, 70); // เข้มขึ้น
    doc.text('ประเภท:', leftColX + 3, leftColYEnd);
    doc.setTextColor(0, 0, 0); // ดำสนิท
    doc.text(safeString(ticket.RepairType || ticket.repairType), leftColX + 30, leftColYEnd); // เพิ่มจาก 20 เป็น 30
    leftColYEnd += 7; // เพิ่มจาก 5.5 เป็น 7

    doc.setTextColor(70, 70, 70); // เข้มขึ้น
    doc.text('ความเร่งด่วน:', leftColX + 3, leftColYEnd);
    doc.setTextColor(0, 0, 0); // ดำสนิท
    doc.text(safeString(ticket.Urgency || ticket.urgency), leftColX + 30, leftColYEnd); // เพิ่มจาก 20 เป็น 30
    leftColYEnd += 7; // เพิ่มจาก 5.5 เป็น 7

    doc.setTextColor(70, 70, 70); // เข้มขึ้น
    doc.text('ปัญหา:', leftColX + 3, leftColYEnd);
    doc.setTextColor(0, 0, 0); // ดำสนิท
    doc.text(safeString(ticket.Problem || ticket.problem), leftColX + 30, leftColYEnd); // เพิ่มจาก 20 เป็น 30
    leftColYEnd += 10; // เพิ่มจาก 5.5 เป็น 7

    // คอลัมน์ขวา: ประวัติการซ่อมครั้งล่าสุด (แสดงเสมอ)
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(rightColX, repairDetailYStart, colWidth, 5, 'F');
    doc.setFont('THSarabun', 'bold');
    doc.text('📜 ประวัติการซ่อม', rightColX + 2, repairDetailYStart + 3.5);
    
    rightColYEnd += 10; // เพิ่มจาก 8 เป็น 10 เพื่อให้ห่างจากหัวข้อมากขึ้น
    doc.setFontSize(11); // เพิ่มจาก 9 +2
    doc.setFont('THSarabun', 'normal');
    
    if (lastRepairHistory) {
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.text('เลขที่:', rightColX + 3, rightColYEnd);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      doc.text(safeString(lastRepairHistory.TicketID), rightColX + 30, rightColYEnd); // เพิ่มจาก 20 เป็น 30
      rightColYEnd += 7; // เพิ่มจาก 5.5 เป็น 7
      
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.text('วันที่:', rightColX + 3, rightColYEnd);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      const historyDate = lastRepairHistory.Timestamp ? lastRepairHistory.Timestamp.substring(0, 10) : '-';
      doc.text(historyDate, rightColX + 30, rightColYEnd); // เพิ่มจาก 20 เป็น 30
      rightColYEnd += 7; // เพิ่มจาก 5.5 เป็น 7
      
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.text('ปัญหา:', rightColX + 3, rightColYEnd);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      doc.text(safeString(lastRepairHistory.Problem), rightColX + 30, rightColYEnd); // เพิ่มจาก 20 เป็น 30
      rightColYEnd += 10; // เพิ่มจาก 5.5 เป็น 7
    } else {
      // แสดงสถานะ "ไม่มี" ถ้าไม่มีประวัติ
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.text('สถานะ:', rightColX + 3, rightColYEnd);
      doc.setTextColor(100, 100, 100); // สีเทาเข้ม
      doc.text('ไม่มี', rightColX + 30, rightColYEnd); // เพิ่มจาก 20 เป็น 30
      rightColYEnd += 7; // เพิ่มจาก 5.5 เป็น 7
    }

    // ใช้ yPos ที่มากกว่าเพื่อวางต่อไป
    yPos = Math.max(leftColYEnd, rightColYEnd) + 5;

    // อู่ที่จะเข้าซ่อม - ใส่หลังรายละเอียดการซ่อม (แสดงเสมอ)
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(leftColX, yPos, 170, 5, 'F'); // ใช้ความกว้างเต็มหน้า
    doc.setFont('THSarabun', 'bold');
    doc.text('ส่งรถเข้าอู่ร้าน', leftColX + 2, yPos + 3.5);
    yPos += 10; // เพิ่มจาก 8 เป็น 10 เพื่อให้ห่างจากหัวข้อมากขึ้น
    
    doc.setFontSize(11); // เพิ่มจาก 9 +2
    doc.setFont('THSarabun', 'normal');
    doc.setTextColor(70, 70, 70); // เข้มขึ้น
    doc.text('อู่/ร้าน:', leftColX + 3, yPos);
    doc.setTextColor(0, 0, 0); // ดำสนิท
    const garageName = ticket.Garage || ticket.garage || '-';
    doc.text(safeString(garageName), leftColX + 30, yPos); // เพิ่มจาก 20 เป็น 30
    yPos += 7; // เพิ่มจาก 5.5 เป็น 7
    
    // ถ้ามี Technician Name
    if (ticket.TechnicianName || ticket.technicianName) {
      doc.setTextColor(70, 70, 70); // เข้มขึ้น
      doc.text('ช่าง:', leftColX + 3, yPos);
      doc.setTextColor(0, 0, 0); // ดำสนิท
      doc.text(safeString(ticket.TechnicianName || ticket.technicianName), leftColX + 30, yPos); // เพิ่มจาก 20 เป็น 30
      yPos += 7; // เพิ่มจาก 5.5 เป็น 7
    }
    
    yPos += 3;

    // ส่วนค่าใช้จ่ายถูกลบออกทั้งหมดแล้ว

    // ส่วนลายเซ็นอนุมัติ (ถ้ามี) - ใส่ก่อน Footer
    const hasAnySignature = !!(
      ticket.InspectorSignatureURL || 
      ticket.ManagerSignatureURL || 
      ticket.ExecutiveSignatureURL
    );

    // ส่วนลายเซ็นอนุมัติ (ใส่เสมอเพื่อให้มีพื้นที่ลายเซ็น)
    // ตรวจสอบพื้นที่ (ไม่ให้เกินหน้า A4 = 297mm)
    const maxHeight = 280; // ไว้ที่ footer
    
    // หัวข้อส่วนลายเซ็น
    doc.setFont('THSarabun', 'bold');
    doc.setFontSize(13); // เพิ่มจาก 11 +2
    doc.setTextColor(44, 62, 80);
    doc.setFillColor(236, 240, 241);
    doc.rect(20, yPos, 170, 5, 'F');
    doc.text('✍️ ลายเซ็นการอนุมัติ', 22, yPos + 3.5);
    yPos += 10; // เพิ่มจาก 8 เป็น 10 เพื่อให้ห่างจากหัวข้อมากขึ้น

    // โหลดลายเซ็นทั้ง 3 คน
    console.log('🔍 Loading signatures:', {
      InspectorSignatureURL: ticket.InspectorSignatureURL,
      ManagerSignatureURL: ticket.ManagerSignatureURL,
      ExecutiveSignatureURL: ticket.ExecutiveSignatureURL
    });
    
    // ใช้ apiGetSignatureImage แทน loadImageAsDataURL เพื่อ bypass CORS
    const [inspectorSig, managerSig, executiveSig] = await Promise.all([
      ticket.InspectorSignatureURL ? apiGetSignatureImage(ticket.InspectorSignatureURL) : null,
      ticket.ManagerSignatureURL ? apiGetSignatureImage(ticket.ManagerSignatureURL) : null,
      ticket.ExecutiveSignatureURL ? apiGetSignatureImage(ticket.ExecutiveSignatureURL) : null
    ]);
    
    console.log('✅ Signature loading result:', {
      inspectorSig: inspectorSig ? 'Loaded' : 'Failed',
      managerSig: managerSig ? 'Loaded' : 'Failed',
      executiveSig: executiveSig ? 'Loaded' : 'Failed'
    });

    // จัดวางลายเซ็น: Inspector + Manager ในแถวแรก, Executive ในแถวที่สอง
    // ชิดซ้าย
    const signatureWidth = 70;
    const signatureHeight = 20;
    const row1Y = yPos;
    
    // ตำแหน่งชิดซ้าย
    const inspectorX = 25;
    const managerX = 125;
    const executiveX = 25;

    // Inspector Signature (ซ้าย)
    if (inspectorSig) {
      try {
        doc.addImage(inspectorSig, 'PNG', inspectorX, row1Y, signatureWidth, signatureHeight, undefined, 'FAST');
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(60, 60, 60); // เข้มขึ้นเพื่อถ่ายเอกสาร
        doc.text('ผู้ตรวจสอบ / Inspector', inspectorX, row1Y + signatureHeight + 4);
        const inspectorName = extractApproverName(ticket.Inspector);
        if (inspectorName) {
          doc.setFont('THSarabun', 'bold');
          doc.setFontSize(12); // เพิ่มจาก 10 +2
          doc.setTextColor(0, 0, 0); // ดำสนิท
          doc.text(safeString(inspectorName), inspectorX, row1Y + signatureHeight + 10); // เพิ่มจาก 8 เป็น 10
        }
        if (ticket.InspectorSignedAt) {
          doc.setFont('THSarabun', 'normal');
          doc.setFontSize(11); // เพิ่มจาก 9 +2
          doc.setTextColor(60, 60, 60);
          doc.text(formatDateOnly(ticket.InspectorSignedAt), inspectorX, row1Y + signatureHeight + 16); // เพิ่มจาก 12 เป็น 16
        }
      } catch (e) {
        console.warn('Failed to add Inspector signature:', e);
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.5);
        doc.line(inspectorX, row1Y + signatureHeight - 5, inspectorX + 80, row1Y + signatureHeight - 5);
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(120, 120, 120);
        doc.text('ผู้ตรวจสอบ / Inspector', inspectorX, row1Y + signatureHeight + 4);
      }
    } else {
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.5);
      doc.line(inspectorX, row1Y + signatureHeight - 5, inspectorX + 80, row1Y + signatureHeight - 5);
      doc.setFont('THSarabun', 'normal');
      doc.setFontSize(11); // เพิ่มจาก 9 +2
      doc.setTextColor(120, 120, 120);
      doc.text('ผู้ตรวจสอบ / Inspector', inspectorX, row1Y + signatureHeight + 4);
    }

    // Manager Signature (ขวา)
    if (managerSig) {
      try {
        doc.addImage(managerSig, 'PNG', managerX, row1Y, signatureWidth, signatureHeight, undefined, 'FAST');
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(60, 60, 60);
        doc.text('ผู้จัดการ / Manager', managerX, row1Y + signatureHeight + 4);
        const managerName = extractApproverName(ticket.Manager);
        if (managerName) {
          doc.setFont('THSarabun', 'bold');
          doc.setFontSize(12); // เพิ่มจาก 10 +2
          doc.setTextColor(0, 0, 0);
          doc.text(safeString(managerName), managerX, row1Y + signatureHeight + 10); // เพิ่มจาก 8 เป็น 10
        }
        if (ticket.ManagerSignedAt) {
          doc.setFont('THSarabun', 'normal');
          doc.setFontSize(11); // เพิ่มจาก 9 +2
          doc.setTextColor(60, 60, 60);
          doc.text(formatDateOnly(ticket.ManagerSignedAt), managerX, row1Y + signatureHeight + 16); // เพิ่มจาก 12 เป็น 16
        }
      } catch (e) {
        console.warn('Failed to add Manager signature:', e);
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.5);
        doc.line(managerX, row1Y + signatureHeight - 5, managerX + 80, row1Y + signatureHeight - 5);
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(120, 120, 120);
        doc.text('ผู้จัดการ / Manager', managerX, row1Y + signatureHeight + 4);
      }
    } else {
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.5);
      doc.line(managerX, row1Y + signatureHeight - 5, managerX + 80, row1Y + signatureHeight - 5);
      doc.setFont('THSarabun', 'normal');
      doc.setFontSize(11); // เพิ่มจาก 9 +2
      doc.setTextColor(120, 120, 120);
      doc.text('ผู้จัดการ / Manager', managerX, row1Y + signatureHeight + 4);
    }

    // Executive Signature (แถวที่สอง)
    const row2Y = row1Y + signatureHeight + 18;
    if (executiveSig) {
      try {
        doc.addImage(executiveSig, 'PNG', executiveX, row2Y, signatureWidth, signatureHeight, undefined, 'FAST');
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(60, 60, 60);
        doc.text('ผู้บริหาร / Executive', executiveX, row2Y + signatureHeight + 4);
        const executiveName = extractApproverName(ticket.Executive);
        if (executiveName) {
          doc.setFont('THSarabun', 'bold');
          doc.setFontSize(12); // เพิ่มจาก 10 +2
          doc.setTextColor(0, 0, 0);
          doc.text(safeString(executiveName), executiveX, row2Y + signatureHeight + 10); // เพิ่มจาก 8 เป็น 10
        }
        if (ticket.ExecutiveSignedAt) {
          doc.setFont('THSarabun', 'normal');
          doc.setFontSize(11); // เพิ่มจาก 9 +2
          doc.setTextColor(60, 60, 60);
          doc.text(formatDateOnly(ticket.ExecutiveSignedAt), executiveX, row2Y + signatureHeight + 16); // เพิ่มจาก 12 เป็น 16
        }
      } catch (e) {
        console.warn('Failed to add Executive signature:', e);
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.5);
        doc.line(executiveX, row2Y + signatureHeight - 5, executiveX + 80, row2Y + signatureHeight - 5);
        doc.setFont('THSarabun', 'normal');
        doc.setFontSize(11); // เพิ่มจาก 9 +2
        doc.setTextColor(120, 120, 120);
        doc.text('ผู้บริหาร / Executive', executiveX, row2Y + signatureHeight + 4);
      }
    } else {
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.5);
      doc.line(executiveX, row2Y + signatureHeight - 5, executiveX + 80, row2Y + signatureHeight - 5);
      doc.setFont('THSarabun', 'normal');
      doc.setFontSize(11); // เพิ่มจาก 9 +2
      doc.setTextColor(120, 120, 120);
      doc.text('ผู้บริหาร / Executive', executiveX, row2Y + signatureHeight + 4);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(11); // เพิ่มจาก 9 +2
      doc.setFont('THSarabun', 'normal');
      doc.setTextColor(127, 140, 141);
      
      const footerY = doc.internal.pageSize.getHeight() - 10;
      doc.text(
        `สร้างเมื่อ: ${formatDate(new Date())}`,
        105,
        footerY,
        { align: 'center' }
      );
      doc.text(
        `หน้า ${i} / ${pageCount}`,
        doc.internal.pageSize.getWidth() - 10,
        footerY,
        { align: 'right' }
      );
    }

    // Save PDF
    const fileName = `Ticket_${ticket.ticketNumber || ticket.TicketID || ticket.id}.pdf`;
    doc.save(fileName);

    console.log('✅ Client-side PDF generated successfully');
    return { success: true, fileName };

  } catch (error) {
    console.error('❌ Failed to generate client-side PDF:', error);
    throw error;
  }
}

/**
 * Export ticket to PDF (wrapper function)
 * Uses client-side PDF generation only
 * @param {Object} ticket - Ticket data
 * @param {Array} costs - Cost items (optional)
 * @param {boolean} forceClient - Always true (backend removed)
 * @returns {Promise<Object>}
 */
export async function exportTicketToPDF(ticket, costs = [], forceClient = true) {
  try {
    // Always use client-side generation (backend has been removed)
    return await generateClientPDF(ticket, costs);
  } catch (error) {
    console.error('❌ Failed to export PDF:', error);
    throw error;
  }
}

// Default export for backward compatibility with modules importing `pdfService` as default
const pdfService = {
  apiGeneratePDF,
  drawPdfHeader,
  generateClientPDF,
  exportTicketToPDF,
  getCompanyLogoDataUrl
};

export default pdfService