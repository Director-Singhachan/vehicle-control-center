import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Ticket interface for PDF
interface Ticket {
    id: string;
    ticket_number: string | null;
    vehicle_plate: string;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_type?: string | null;
    branch?: string | null;
    reporter_name: string;
    reporter_email: string | null;
    problem: string | null;
    description: string | null;
    urgency: string;
    status: string;
    created_at: string;
    odometer: number | null;
    garage?: string | null;
    notes?: string | null;
    last_repair_date?: string | null;
    last_repair_description?: string | null;
    last_repair_garage?: string | null;
    estimated_cost?: number | null;
}

// (fixThaiScript removed due to missing PUA in font)

export const pdfService = {
    generateMaintenanceTicketPDF: async (ticket: Ticket) => {
        try {
            console.log('[pdfService] generateMaintenanceTicketPDF input:', ticket);
            // Create new PDF document
            const doc = new jsPDF();
            // Increase line height globally to avoid Thai diacritics clipping
            doc.setLineHeightFactor(1.35);

            // Load Thai Font (Sarabun) Regular and Bold from local files
            // Sarabun has better vertical space for Thai vowels and tone marks
            const fontUrl = '/fonts/Sarabun-Regular.ttf';
            const fontBoldUrl = '/fonts/Sarabun-Bold.ttf';
            try {
                const response = await fetch(fontUrl);
                const responseBold = await fetch(fontBoldUrl);
                if (!response.ok) throw new Error(`Failed to fetch font: ${response.status}`);
                if (!responseBold.ok) throw new Error(`Failed to fetch bold font: ${responseBold.status}`);
                const buffer = await response.arrayBuffer();
                const bufferBold = await responseBold.arrayBuffer();

                // Convert ArrayBuffer to Base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);

                // Convert Bold font to Base64
                let binaryBold = '';
                const bytesBold = new Uint8Array(bufferBold);
                const lenBold = bytesBold.byteLength;
                for (let i = 0; i < lenBold; i++) {
                    binaryBold += String.fromCharCode(bytesBold[i]);
                }
                const base64FontBold = window.btoa(binaryBold);

                // Add fonts to VFS and register
                doc.addFileToVFS('Sarabun-Regular.ttf', base64Font);
                doc.addFont('Sarabun-Regular.ttf', 'SarabunNew', 'normal');
                doc.addFileToVFS('Sarabun-Bold.ttf', base64FontBold);
                doc.addFont('Sarabun-Bold.ttf', 'SarabunNew', 'bold');

                doc.setFont('SarabunNew');
                doc.setLineHeightFactor(1.2);
            } catch (fontError) {
                console.error('Failed to load Thai font:', fontError, 'url:', fontUrl);
                // Fallback to default font if loading fails
            }

            // Helper to add text with label
            const addField = (label: string, value: string | null | undefined, x: number, y: number) => {
                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for labels
                doc.setTextColor(100, 100, 100); // Gray for label
                doc.text(label, x, y);

                doc.setFontSize(12);
                doc.setFont('SarabunNew', 'normal'); // Use Regular for values
                doc.setTextColor(0, 0, 0); // Black for value
                doc.text(value || '-', x, y + 6);
            };

            // Normalized fields (เผื่อมีหลายชื่อฟิลด์จาก view / table ต่างกัน)
            const repairType =
                ticket.problem ||
                (ticket as any).repair_type ||
                '-';

            const problemDescription =
                ticket.description ||
                (ticket as any).problem_description ||
                '-';

            const makeModel =
                `${ticket.vehicle_make || (ticket as any).vehicle_make || ''} ${ticket.vehicle_model || (ticket as any).vehicle_model || ''}`.trim() ||
                '-';

            const repairGarage =
                ticket.garage ||
                (ticket as any).repair_garage ||
                null;

            const repairNotes =
                ticket.notes ||
                (ticket as any).repair_notes ||
                null;

            // --- Header ---
            // Title
            doc.setFontSize(16);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for title
            // ขยับขึ้นเล็กน้อยเพื่อเว้นระยะจากเส้นด้านล่าง
            // ขยับขึ้นเล็กน้อยเพื่อเว้นระยะจากเส้นด้านล่าง
            // ขยับขึ้นเล็กน้อยเพื่อเว้นระยะจากเส้นด้านล่าง
            doc.text('ใบแจ้งซ่อม', 105, 22, { align: 'center', baseline: 'top' });

            doc.setFontSize(12);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for document number label
            doc.text(`เลขที่เอกสาร: ${ticket.ticket_number || ticket.id}`, 195, 22, { align: 'right', baseline: 'top' });

            // Draw line under header (เหนือหัวข้อ column) เว้นระยะพอสมควร
            doc.setLineWidth(0.5);
            doc.line(15, 40, 195, 40);

            // --- 2-Column Layout (Top Section) ---
            const leftColX = 15;
            const rightColX = 110;
            const sectionStartY = 50; // กำหนดจุดเริ่มเดียวกันให้ทั้งซ้ายและขวา (ระยะห่างใกล้เคียงด้านล่าง)
            let currentY = sectionStartY;

            // Left Column: General Info
            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.text('ข้อมูลทั่วไป (General Info)', leftColX, currentY);
            currentY += 10;

            addField('วันที่แจ้ง (Date)', new Date(ticket.created_at).toLocaleDateString('th-TH'), leftColX, currentY);
            addField('สถานะ (Status)', 'รอซ่อม', leftColX + 40, currentY); // ฟิกให้เป็นสถานะรอซ่อมในไฟล์ PDF
            currentY += 15;

            addField('ผู้แจ้ง (Reporter)', ticket.reporter_name, leftColX, currentY);
            addField('สาขา (Branch)', ticket.branch, leftColX + 40, currentY);
            currentY += 15;

            // Right Column: Vehicle Info (align with left column start)
            let rightY = sectionStartY;
            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.text('ข้อมูลรถยนต์ (Vehicle Info)', rightColX, rightY);
            rightY += 10;

            addField('ทะเบียน (Plate)', ticket.vehicle_plate, rightColX, rightY);
            addField('ยี่ห้อ/รุ่น (Make/Model)', makeModel, rightColX + 40, rightY);
            rightY += 15;

            addField('ประเภท (Type)', ticket.vehicle_type, rightColX, rightY);
            addField('เลขไมล์ (Odometer)', ticket.odometer ? `${ticket.odometer.toLocaleString()} km` : '-', rightColX + 40, rightY);
            rightY += 15;

            // Update currentY to be below the lowest column
            currentY = Math.max(currentY, rightY) + 10;

            // Draw separator line
            doc.setLineWidth(0.5);
            doc.line(15, currentY, 195, currentY);
            currentY += 10;

            // --- Repair Details + Repair Info (two-column layout) ---
            const repairDetailsX = 15;
            const repairInfoX = 110;
            let repairY = currentY;

            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.text('รายละเอียดการซ่อม (Repair Details)', repairDetailsX, repairY);
            doc.text('ข้อมูลการซ่อม (Repair Info)', repairInfoX, repairY);
            repairY += 10;

            // Left column: Repair Details
            addField('ประเภทการซ่อม (Repair Type)', repairType, repairDetailsX, repairY);
            let repairDetailsBottom = repairY + 15;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('ปัญหา/อาการ (Problem Description)', repairDetailsX, repairDetailsBottom);
            repairDetailsBottom += 6;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            const splitDescription = doc.splitTextToSize(problemDescription, 85);
            doc.text(splitDescription, repairDetailsX, repairDetailsBottom);
            repairDetailsBottom += (splitDescription.length * 7) + 5;

            // Urgency under Problem Description
            const urgencyY = repairDetailsBottom;
            addField('ความเร่งด่วน (Urgency)', ticket.urgency, repairDetailsX, urgencyY);
            repairDetailsBottom = urgencyY + 15;

            // Right column: Repair Info (always show, use "-" if empty)
            let repairInfoY = repairY;
            const garageValue = repairGarage || '-';
            const notesValue = repairNotes || '-';
            const lastRepairDate = ticket.last_repair_date
                ? new Date(ticket.last_repair_date).toLocaleDateString('th-TH')
                : '-';

            addField('อู่/ร้านที่จะเข้าซ่อม (Garage)', garageValue, repairInfoX, repairInfoY);
            repairInfoY += 15;
            addField('หมายเหตุ (Notes)', notesValue, repairInfoX, repairInfoY);
            repairInfoY += 15;
            // Align Last Repair Date with Urgency row
            const lastRepairDateY = urgencyY;
            addField('ประวัติการซ่อมล่าสุด (Last Repair Date)', lastRepairDate, repairInfoX, lastRepairDateY);
            const repairInfoBottom = Math.max(repairInfoY, lastRepairDateY + 15);

            // Advance currentY below the lower column
            currentY = Math.max(repairDetailsBottom, repairInfoBottom) + 5;

            // (History merged into Repair Info column above)

            // (ข้อมูลการซ่อมถูกแสดงในคอลัมน์ขวาด้านบนแล้ว)

            // --- Signatures Section ---
            // Move to bottom of page or ensure enough space
            const pageHeight = doc.internal.pageSize.height;
            if (currentY > pageHeight - 60) {
                doc.addPage();
                currentY = 40;
            } else {
                // Push to bottom if plenty of space, or just leave some gap
                currentY = Math.max(currentY, pageHeight - 60);
            }

            const drawSignatureLine = (label: string, x: number, y: number) => {
                doc.setLineWidth(0.5);
                doc.line(x, y, x + 50, y); // Signature line

                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for signature labels
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for signature labels
                doc.setTextColor(0, 0, 0);
                doc.text(label, x + 25, y + 5, { align: 'center' }); // Label below line

                doc.setFont('SarabunNew', 'normal'); // Use Regular for date
                doc.text('Date: ____/____/____', x + 25, y + 12, { align: 'center' }); // Date line
            };

            // 3 Signatures: Inspector, Manager, Executive
            const sigY = pageHeight - 40;
            drawSignatureLine('ผู้ตรวจสอบ (Inspector)', 20, sigY);
            drawSignatureLine('ผู้จัดการ (Manager)', 80, sigY);
            drawSignatureLine('ผู้บริหาร (Executive)', 140, sigY);

            // Save PDF (for download)
            doc.save(`Maintenance_Ticket_${ticket.ticket_number || ticket.id}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('เกิดข้อผิดพลาดในการสร้าง PDF');
        }
    },

    // Generate PDF as Blob (for sending via notifications)
    generateMaintenanceTicketPDFAsBlob: async (ticket: Ticket): Promise<Blob> => {
        try {
            console.log('[pdfService] generateMaintenanceTicketPDFAsBlob input:', ticket);
            // Create new PDF document
            const doc = new jsPDF();
            // Increase line height globally to avoid Thai diacritics clipping
            doc.setLineHeightFactor(1.35);

            // Load Thai Font (Sarabun) Regular and Bold from local files
            // Sarabun has better vertical space for Thai vowels and tone marks
            const fontUrl = '/fonts/Sarabun-Regular.ttf';
            const fontBoldUrl = '/fonts/Sarabun-Bold.ttf';
            try {
                const response = await fetch(fontUrl);
                const responseBold = await fetch(fontBoldUrl);
                if (!response.ok) throw new Error(`Failed to fetch font: ${response.status}`);
                if (!responseBold.ok) throw new Error(`Failed to fetch bold font: ${responseBold.status}`);
                const buffer = await response.arrayBuffer();
                const bufferBold = await responseBold.arrayBuffer();

                // Convert ArrayBuffer to Base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);

                // Convert Bold font to Base64
                let binaryBold = '';
                const bytesBold = new Uint8Array(bufferBold);
                const lenBold = bytesBold.byteLength;
                for (let i = 0; i < lenBold; i++) {
                    binaryBold += String.fromCharCode(bytesBold[i]);
                }
                const base64FontBold = window.btoa(binaryBold);

                // Add fonts to VFS and register
                doc.addFileToVFS('Sarabun-Regular.ttf', base64Font);
                doc.addFont('Sarabun-Regular.ttf', 'SarabunNew', 'normal');
                doc.addFileToVFS('Sarabun-Bold.ttf', base64FontBold);
                doc.addFont('Sarabun-Bold.ttf', 'SarabunNew', 'bold');

                doc.setFont('SarabunNew');
                doc.setLineHeightFactor(1.2);
            } catch (fontError) {
                console.error('Failed to load Thai font:', fontError, 'url:', fontUrl);
                // Fallback to default font if loading fails
            }

            // Helper to add text with label
            const addField = (label: string, value: string | null | undefined, x: number, y: number) => {
                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for labels
                doc.setTextColor(100, 100, 100); // Gray for label
                doc.text(label, x, y);

                doc.setFontSize(12);
                doc.setFont('SarabunNew', 'normal'); // Use Regular for values
                doc.setTextColor(0, 0, 0); // Black for value
                doc.text(value || '-', x, y + 6);
            };

            // Normalized fields (เผื่อมีหลายชื่อฟิลด์จาก view / table ต่างกัน)
            const repairType =
                ticket.problem ||
                (ticket as any).repair_type ||
                '-';

            const problemDescription =
                ticket.description ||
                (ticket as any).problem_description ||
                '-';

            const makeModel =
                `${ticket.vehicle_make || (ticket as any).vehicle_make || ''} ${ticket.vehicle_model || (ticket as any).vehicle_model || ''}`.trim() ||
                '-';

            const repairGarage =
                ticket.garage ||
                (ticket as any).repair_garage ||
                null;

            const repairNotes =
                ticket.notes ||
                (ticket as any).repair_notes ||
                null;

            // --- Header ---
            // Title
            doc.setFontSize(16);
            doc.text('ใบแจ้งซ่อม', 105, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`เลขที่เอกสาร: ${ticket.ticket_number || ticket.id}`, 195, 20, { align: 'right' });

            // Draw line under header
            doc.setLineWidth(0.5);
            doc.line(15, 30, 195, 30);

            // --- 2-Column Layout (Top Section) ---
            const leftColX = 15;
            const rightColX = 110;
            let currentY = 45;

            // Left Column: General Info
            doc.setFontSize(14);
            doc.text('ข้อมูลทั่วไป (General Info)', leftColX, currentY);
            currentY += 10;

            addField('วันที่แจ้ง (Date)', new Date(ticket.created_at).toLocaleDateString('th-TH'), leftColX, currentY);
            addField('สถานะ (Status)', 'รอซ่อม', leftColX + 40, currentY); // ฟิกสถานะในไฟล์ PDF
            currentY += 15;

            addField('ผู้แจ้ง (Reporter)', ticket.reporter_name, leftColX, currentY);
            addField('สาขา (Branch)', ticket.branch, leftColX + 40, currentY);
            currentY += 15;

            // Right Column: Vehicle Info
            let rightY = 45;
            doc.setFontSize(14);
            doc.text('ข้อมูลรถยนต์ (Vehicle Info)', rightColX, rightY);
            rightY += 10;

            addField('ทะเบียน (Plate)', ticket.vehicle_plate, rightColX, rightY);
            addField('ยี่ห้อ/รุ่น (Make/Model)', makeModel, rightColX + 40, rightY);
            rightY += 15;

            addField('ประเภท (Type)', ticket.vehicle_type, rightColX, rightY);
            addField('เลขไมล์ (Odometer)', ticket.odometer ? `${ticket.odometer.toLocaleString()} km` : '-', rightColX + 40, rightY);
            rightY += 15;

            // Update currentY to be below the lowest column
            currentY = Math.max(currentY, rightY) + 10;

            // Draw separator line
            doc.setLineWidth(0.1);
            doc.line(15, currentY, 195, currentY);
            currentY += 10;

            // --- Repair Details + Repair Info (two-column layout) ---
            const repairDetailsX = 15;
            const repairInfoX = 110;
            let repairY = currentY;

            doc.setFontSize(14);
            doc.setFont('SarabunNew', 'bold'); // Use Bold for section headers
            doc.text('รายละเอียดการซ่อม (Repair Details)', repairDetailsX, repairY);
            doc.text('ข้อมูลการซ่อม (Repair Info)', repairInfoX, repairY);
            repairY += 10;

            // Left column: Repair Details
            addField('ประเภทการซ่อม (Repair Type)', repairType, repairDetailsX, repairY);
            let repairDetailsBottom = repairY + 15;

            // Problem Description
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            // Problem Description
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('ปัญหา/อาการ (Problem Description)', repairDetailsX, repairDetailsBottom);
            repairDetailsBottom += 6;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            const splitDescription = doc.splitTextToSize(problemDescription, 85);
            doc.text(splitDescription, repairDetailsX, repairDetailsBottom);
            repairDetailsBottom += (splitDescription.length * 7) + 5;

            // Urgency under Problem Description
            addField('ความเร่งด่วน (Urgency)', ticket.urgency, repairDetailsX, repairDetailsBottom);
            repairDetailsBottom += 15;

            // Right column: Repair Info (always show, use "-" if empty)
            let repairInfoY = repairY;
            const garageValue = repairGarage || '-';
            const notesValue = repairNotes || '-';
            addField('อู่/ร้านที่จะเข้าซ่อม (Garage)', garageValue, repairInfoX, repairInfoY);
            repairInfoY += 15;
            addField('หมายเหตุ (Notes)', notesValue, repairInfoX, repairInfoY);
            repairInfoY += 15;

            // Advance currentY below the lower column
            currentY = Math.max(repairDetailsBottom, repairInfoY) + 5;

            // --- History Section (Optional: only show last repair date) ---
            if (ticket.last_repair_date) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

                doc.setFontSize(14);
                doc.setFontSize(14);
                doc.text('ประวัติการซ่อมล่าสุด (Last Repair History)', 15, currentY);
                currentY += 10;

                addField('วันที่ซ่อมล่าสุด', new Date(ticket.last_repair_date).toLocaleDateString('th-TH'), 15, currentY);
                currentY += 15;
            }

            // --- Garage Section ---
            if (repairGarage) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

                doc.setFontSize(14);
                doc.setFontSize(14);
                doc.text('ข้อมูลการซ่อม (Repair Info)', 15, currentY);
                currentY += 10;

                addField('อู่/ร้านที่จะเข้าซ่อม (Garage)', repairGarage, 15, currentY);
                if (repairNotes) {
                    addField('หมายเหตุ (Notes)', repairNotes, 80, currentY);
                }
                currentY += 20;
            } else {
                currentY += 10;
            }

            // --- Signatures Section ---
            // Move to bottom of page or ensure enough space
            const pageHeight = doc.internal.pageSize.height;
            if (currentY > pageHeight - 60) {
                doc.addPage();
                currentY = 40;
            } else {
                // Push to bottom if plenty of space, or just leave some gap
                currentY = Math.max(currentY, pageHeight - 60);
            }

            const drawSignatureLine = (label: string, x: number, y: number) => {
                doc.setLineWidth(0.5);
                doc.line(x, y, x + 50, y); // Signature line

                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for signature labels
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);
                doc.setFont('SarabunNew', 'bold'); // Use Bold for signature labels
                doc.setTextColor(0, 0, 0);
                doc.text(label, x + 25, y + 5, { align: 'center' }); // Label below line

                doc.setFont('SarabunNew', 'normal'); // Use Regular for date
                doc.text('Date: ____/____/____', x + 25, y + 12, { align: 'center' }); // Date line
            };

            // 3 Signatures: Inspector, Manager, Executive
            const sigY = pageHeight - 40;
            drawSignatureLine('ผู้ตรวจสอบ (Inspector)', 20, sigY);
            drawSignatureLine('ผู้จัดการ (Manager)', 80, sigY);
            drawSignatureLine('ผู้บริหาร (Executive)', 140, sigY);

            // Convert PDF to Blob
            const pdfBlob = doc.output('blob');
            return pdfBlob;
        } catch (error) {
            console.error('Error generating PDF as Blob:', error);
            throw error;
        }
    },

    // Generate PDF as Base64 string (for storing in database or sending via API)
    generateMaintenanceTicketPDFAsBase64: async (ticket: Ticket): Promise<string> => {
        try {
            const blob = await pdfService.generateMaintenanceTicketPDFAsBlob(ticket);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    // Remove data:application/pdf;base64, prefix
                    const base64Data = base64.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error generating PDF as Base64:', error);
            throw error;
        }
    },

    // Generate Delivery Trip PDF in A5 size
    generateDeliveryTripPDFA5: async (
        trip: any,
        aggregatedProducts: any[]
    ) => {
        try {
            console.log('[pdfService] generateDeliveryTripPDFA5 input:', trip);

            // Create new PDF document in A5 size (148 x 210 mm)
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a5',
            });

            // Load Thai Font (Sarabun)
            try {
                const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf';
                const response = await fetch(fontUrl);
                const buffer = await response.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);
                doc.addFileToVFS('Sarabun-Regular.ttf', base64Font);
                doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
                doc.setFont('Sarabun');
            } catch (fontError) {
                console.warn('[pdfService] Failed to load Thai font, using default:', fontError);
            }

            let yPos = 15;

            // Header
            doc.setFontSize(16);
            doc.setFont('Sarabun', 'normal');
            doc.text('ใบเบิกสินค้า', 74, yPos, { align: 'center' });
            yPos += 8;

            // First row: Date (left) and Trip Number (right)
            doc.setFontSize(11);
            const plannedDate = new Date(trip.planned_date).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            doc.text(`วันที่: ${plannedDate}`, 10, yPos);
            doc.text(`รหัสทริป: ${trip.trip_number || 'N/A'}`, 138, yPos, { align: 'right' });
            yPos += 6;

            // Second row: Vehicle (left) and Driver (right)
            if (trip.vehicle) {
                const vehicleText = `รถ: ${trip.vehicle.plate}${trip.vehicle.make && trip.vehicle.model ? ` (${trip.vehicle.make} ${trip.vehicle.model})` : ''}`;
                doc.text(vehicleText, 10, yPos);
            }
            if (trip.driver) {
                doc.text(`คนขับ: ${trip.driver.full_name}`, 138, yPos, { align: 'right' });
            }
            yPos += 6;

            yPos += 3;

            // Stores
            if (trip.stores && trip.stores.length > 0) {
                doc.setFontSize(14);
                doc.text('ร้านค้า', 10, yPos);
                yPos += 6;

                doc.setFontSize(10);
                trip.stores
                    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
                    .forEach((storeWithDetails: any, index: number) => {
                        const store = storeWithDetails.store;
                        if (!store) return;

                        // Check if we need a new page
                        if (yPos > 180) {
                            doc.addPage();
                            yPos = 15;
                        }

                        doc.setFontSize(11);
                        doc.text(`${storeWithDetails.sequence_order}. ${store.customer_code} - ${store.customer_name}`, 10, yPos);
                        yPos += 5;

                        if (store.address) {
                            doc.setFontSize(9);
                            doc.text(`   ที่อยู่: ${store.address}`, 10, yPos);
                            yPos += 4;
                        }

                        // Products for this store
                        if (storeWithDetails.items && storeWithDetails.items.length > 0) {
                            doc.setFontSize(9);
                            storeWithDetails.items.forEach((item: any) => {
                                const product = item.product;
                                if (!product) return;

                                if (yPos > 190) {
                                    doc.addPage();
                                    yPos = 15;
                                }

                                // Format: bullet, product code, product name (left aligned)
                                // quantity and unit separated on the right
                                const productText = `   • ${product.product_code} - ${product.product_name}`;
                                const quantityText = item.quantity.toLocaleString();
                                const unitText = product.unit;

                                // Calculate positions
                                const leftX = 10;
                                const quantityX = 115; // Position for quantity (right aligned)
                                const unitX = 138; // Position for unit (rightmost, with space from quantity)

                                // Draw product info on left
                                doc.text(productText, leftX, yPos);

                                // Draw quantity on right (aligned right)
                                doc.text(quantityText, quantityX, yPos, { align: 'right' });

                                // Draw unit separately, with space from quantity
                                doc.text(unitText, unitX, yPos, { align: 'right' });

                                yPos += 4;
                            });
                        }

                        yPos += 2;
                    });
            }

            yPos += 3;

            // Aggregated Products Summary
            if (aggregatedProducts.length > 0) {
                if (yPos > 160) {
                    doc.addPage();
                    yPos = 15;
                }

                doc.setFontSize(14);
                doc.text('สรุปสินค้าทั้งหมด', 10, yPos);
                yPos += 6;

                doc.setFontSize(9);
                const tableData = aggregatedProducts.map((product) => [
                    product.product_code,
                    product.product_name,
                    product.category,
                    `${product.total_quantity.toLocaleString()} ${product.unit}`,
                ]);

                // Set font before creating table
                doc.setFont('Sarabun', 'normal');

                autoTable(doc, {
                    head: [['รหัส', 'ชื่อสินค้า', 'หมวดหมู่', 'จำนวน']],
                    body: tableData,
                    startY: yPos,
                    styles: {
                        font: 'Sarabun',
                        fontSize: 8,
                        fontStyle: 'normal'
                    },
                    headStyles: {
                        fillColor: [59, 130, 246],
                        textColor: [255, 255, 255],
                        font: 'Sarabun',
                        fontSize: 9,
                        fontStyle: 'normal'
                    },
                    columnStyles: {
                        0: { font: 'Sarabun', fontSize: 8 },
                        1: { font: 'Sarabun', fontSize: 8 },
                        2: { font: 'Sarabun', fontSize: 8 },
                        3: { font: 'Sarabun', fontSize: 8 }
                    },
                    margin: { left: 10, right: 10 },
                });

                yPos = (doc as any).lastAutoTable.finalY + 5;
            }

            // Notes
            if (trip.notes) {
                if (yPos > 180) {
                    doc.addPage();
                    yPos = 15;
                }
                doc.setFontSize(10);
                doc.text('หมายเหตุ:', 10, yPos);
                yPos += 5;
                doc.setFontSize(9);
                const notesLines = doc.splitTextToSize(trip.notes, 120);
                doc.text(notesLines, 10, yPos);
            }

            // Save PDF
            doc.save(`delivery-trip-${trip.trip_number || trip.id}.pdf`);
        } catch (error) {
            console.error('[pdfService] Error generating delivery trip PDF:', error);
            throw error;
        }
    },
};
