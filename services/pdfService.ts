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

export const pdfService = {
    generateMaintenanceTicketPDF: async (ticket: Ticket) => {
        try {
            console.log('[pdfService] generateMaintenanceTicketPDF input:', ticket);
            // Create new PDF document
            const doc = new jsPDF();

            // Load Thai Font (Sarabun)
            try {
                // Using Sarabun font from Google Fonts repo
                const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf';
                const response = await fetch(fontUrl);
                const buffer = await response.arrayBuffer();

                // Convert ArrayBuffer to Base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);

                // Add font to VFS and register
                doc.addFileToVFS('Sarabun-Regular.ttf', base64Font);
                doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
                doc.setFont('Sarabun');
            } catch (fontError) {
                console.error('Failed to load Thai font:', fontError);
                // Fallback to default font if loading fails
            }

            // Helper to add text with label
            const addField = (label: string, value: string | null | undefined, x: number, y: number) => {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100); // Gray for label
                doc.text(label, x, y);

                doc.setFontSize(12);
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
            // doc.setFont('helvetica', 'bold'); // Remove hardcoded font to allow Sarabun
            doc.text('ข้อมูลทั่วไป (General Info)', leftColX, currentY);
            currentY += 10;

            addField('วันที่แจ้ง (Date)', new Date(ticket.created_at).toLocaleDateString('th-TH'), leftColX, currentY);
            addField('สถานะ (Status)', ticket.status, leftColX + 40, currentY);
            currentY += 15;

            addField('ผู้แจ้ง (Reporter)', ticket.reporter_name, leftColX, currentY);
            addField('สาขา (Branch)', ticket.branch, leftColX + 40, currentY);
            currentY += 15;

            // Right Column: Vehicle Info
            let rightY = 45;
            doc.setFontSize(14);
            // doc.setFont('helvetica', 'bold');
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

            // --- Repair Details Section ---
            doc.setFontSize(14);
            // doc.setFont('helvetica', 'bold');
            doc.text('รายละเอียดการซ่อม (Repair Details)', 15, currentY);
            currentY += 10;

            addField('ประเภทการซ่อม (Repair Type)', repairType, 15, currentY);
            addField('ความเร่งด่วน (Urgency)', ticket.urgency, 80, currentY);
            currentY += 15;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('ปัญหา/อาการ (Problem Description)', 15, currentY);
            currentY += 6;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            // Split text to fit width
            const splitDescription = doc.splitTextToSize(problemDescription, 180);
            doc.text(splitDescription, 15, currentY);
            currentY += (splitDescription.length * 7) + 5;

            // --- History Section (Optional) ---
            if (ticket.last_repair_date) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

                doc.setFontSize(14);
                // doc.setFont('helvetica', 'bold');
                doc.text('ประวัติการซ่อมล่าสุด (Last Repair History)', 15, currentY);
                currentY += 10;

                addField('วันที่ซ่อมล่าสุด', new Date(ticket.last_repair_date).toLocaleDateString('th-TH'), 15, currentY);
                addField('อู่/ร้านที่ซ่อม', ticket.last_repair_garage, 60, currentY);
                currentY += 15;

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('รายการซ่อม', 15, currentY);
                currentY += 6;
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(ticket.last_repair_description || '-', 15, currentY);
                currentY += 15;
            }

            // --- Garage Section ---
            if (repairGarage) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

                doc.setFontSize(14);
                // doc.setFont('helvetica', 'bold');
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
                doc.setTextColor(0, 0, 0);
                doc.text(label, x + 25, y + 5, { align: 'center' }); // Label below line

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

            // Load Thai Font (Sarabun)
            try {
                // Using Sarabun font from Google Fonts repo
                const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf';
                const response = await fetch(fontUrl);
                const buffer = await response.arrayBuffer();

                // Convert ArrayBuffer to Base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);

                // Add font to VFS and register
                doc.addFileToVFS('Sarabun-Regular.ttf', base64Font);
                doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
                doc.setFont('Sarabun');
            } catch (fontError) {
                console.error('Failed to load Thai font:', fontError);
                // Fallback to default font if loading fails
            }

            // Helper to add text with label
            const addField = (label: string, value: string | null | undefined, x: number, y: number) => {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100); // Gray for label
                doc.text(label, x, y);

                doc.setFontSize(12);
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
            addField('สถานะ (Status)', ticket.status, leftColX + 40, currentY);
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

            // --- Repair Details Section ---
            doc.setFontSize(14);
            doc.text('รายละเอียดการซ่อม (Repair Details)', 15, currentY);
            currentY += 10;

            addField('ประเภทการซ่อม (Repair Type)', repairType, 15, currentY);
            addField('ความเร่งด่วน (Urgency)', ticket.urgency, 80, currentY);
            currentY += 15;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('ปัญหา/อาการ (Problem Description)', 15, currentY);
            currentY += 6;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            // Split text to fit width
            const splitDescription = doc.splitTextToSize(problemDescription, 180);
            doc.text(splitDescription, 15, currentY);
            currentY += (splitDescription.length * 7) + 5;

            // --- History Section (Optional) ---
            if (ticket.last_repair_date) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

                doc.setFontSize(14);
                doc.text('ประวัติการซ่อมล่าสุด (Last Repair History)', 15, currentY);
                currentY += 10;

                addField('วันที่ซ่อมล่าสุด', new Date(ticket.last_repair_date).toLocaleDateString('th-TH'), 15, currentY);
                addField('อู่/ร้านที่ซ่อม', ticket.last_repair_garage, 60, currentY);
                currentY += 15;

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('รายการซ่อม', 15, currentY);
                currentY += 6;
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(ticket.last_repair_description || '-', 15, currentY);
                currentY += 15;
            }

            // --- Garage Section ---
            if (repairGarage) {
                doc.setLineWidth(0.1);
                doc.line(15, currentY, 195, currentY);
                currentY += 10;

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
                doc.setTextColor(0, 0, 0);
                doc.text(label, x + 25, y + 5, { align: 'center' }); // Label below line

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
    }
};
