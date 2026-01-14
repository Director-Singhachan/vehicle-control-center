import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, StyleDictionary } from 'pdfmake/interfaces';

// Initialize pdfMake vfs and fonts
if (!pdfMake.vfs) {
    pdfMake.vfs = {};
}

if (!pdfMake.fonts) {
    pdfMake.fonts = {};
}

// ========================================
// Font loader - load Thai fonts from /public/fonts at runtime
// ========================================
let fontsLoaded = false;

async function ensurePdfFontsLoaded() {
    if (fontsLoaded) {
        // ตรวจสอบว่า vfs ยังมีอยู่หรือไม่
        if (pdfMake.vfs && pdfMake.vfs['Sarabun-Regular.ttf']) {
            console.log('[pdfService] Fonts already loaded');
            return;
        }
        // ถ้า vfs หายไป ให้โหลดใหม่
        console.log('[pdfService] Fonts were loaded but vfs missing, reloading...');
        fontsLoaded = false;
    }

    // pdfMake ใช้งานบน browser เท่านั้น
    if (typeof window === 'undefined') {
        fontsLoaded = true;
        return;
    }

    try {
        console.log('[pdfService] Starting font loading from /fonts...');

        // ตรวจสอบว่า default fonts มีอยู่หรือไม่
        console.log('[pdfService] Current pdfMake state:', {
            hasVfs: !!pdfMake.vfs,
            vfsKeys: Object.keys(pdfMake.vfs || {}),
            hasFonts: !!pdfMake.fonts,
            fontNames: Object.keys(pdfMake.fonts || {})
        });

        const [regularRes, boldRes] = await Promise.all([
            fetch('/fonts/Sarabun-Regular.ttf'),
            fetch('/fonts/Sarabun-Bold.ttf'),
        ]);

        console.log('[pdfService] Font fetch responses:', {
            regularOk: regularRes.ok,
            regularStatus: regularRes.status,
            boldOk: boldRes.ok,
            boldStatus: boldRes.status
        });

        if (!regularRes.ok || !boldRes.ok) {
            console.error('[pdfService] Failed to load font files from /fonts', {
                regular: regularRes.status,
                bold: boldRes.status
            });
            fontsLoaded = true; // ป้องกันไม่ให้โหลดซ้ำรัวๆ
            return;
        }

        const [regularBuffer, boldBuffer] = await Promise.all([
            regularRes.arrayBuffer(),
            boldRes.arrayBuffer(),
        ]);

        console.log('[pdfService] Font buffers loaded:', {
            regularSize: regularBuffer.byteLength,
            boldSize: boldBuffer.byteLength
        });

        // แปลง ArrayBuffer เป็น Base64
        const toBase64 = (buffer: ArrayBuffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        };

        const regularBase64 = toBase64(regularBuffer);
        const boldBase64 = toBase64(boldBuffer);

        console.log('[pdfService] Fonts converted to Base64', {
            regularSize: regularBase64.length,
            boldSize: boldBase64.length
        });

        // ตั้งค่า vfs และ font mapping ให้ pdfMake v0.2.x
        // Ensure vfs exists
        if (!pdfMake.vfs) {
            pdfMake.vfs = {};
        }

        pdfMake.vfs['Sarabun-Regular.ttf'] = regularBase64;
        pdfMake.vfs['Sarabun-Bold.ttf'] = boldBase64;

        pdfMake.fonts = {
            Sarabun: {
                normal: 'Sarabun-Regular.ttf',
                bold: 'Sarabun-Bold.ttf',
                italics: 'Sarabun-Regular.ttf',
                bolditalics: 'Sarabun-Bold.ttf',
            }
        };

        fontsLoaded = true;
        console.log('[pdfService] Thai fonts loaded successfully', {
            vfsKeys: Object.keys(pdfMake.vfs || {}),
            fontNames: Object.keys(pdfMake.fonts || {}),
            sarabunFont: pdfMake.fonts?.Sarabun
        });
    } catch (error) {
        console.error('[pdfService] Error loading fonts from /fonts:', error);
        fontsLoaded = true; // ไม่ให้พยายามซ้ำใน request เดียวกัน
        throw error; // throw error เพื่อให้ caller รู้ว่ามีปัญหา
    }
}

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
            await ensurePdfFontsLoaded();
            console.log('[pdfService] generateMaintenanceTicketPDF input:', ticket);

            // Normalized fields
            const repairType = ticket.problem || (ticket as any).repair_type || '-';
            const problemDescription = ticket.description || (ticket as any).problem_description || '-';
            const makeModel = `${ticket.vehicle_make || (ticket as any).vehicle_make || ''} ${ticket.vehicle_model || (ticket as any).vehicle_model || ''}`.trim() || '-';
            const repairGarage = ticket.garage || (ticket as any).repair_garage || '-';
            const repairNotes = ticket.notes || (ticket as any).repair_notes || '-';
            const lastRepairDate = ticket.last_repair_date
                ? new Date(ticket.last_repair_date).toLocaleDateString('th-TH')
                : '-';

            // Define styles
            const styles: StyleDictionary = {
                header: {
                    fontSize: 16,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 0, 0, 10] as [number, number, number, number]
                },
                docNumber: {
                    fontSize: 12,
                    bold: true,
                    alignment: 'right',
                    margin: [0, 0, 0, 0] as [number, number, number, number]
                },
                sectionHeader: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 10, 0, 5] as [number, number, number, number]
                },
                label: {
                    fontSize: 10,
                    bold: true,
                    color: '#666666',
                    margin: [0, 0, 0, 2] as [number, number, number, number]
                },
                value: {
                    fontSize: 12,
                    margin: [0, 0, 0, 8] as [number, number, number, number]
                },
                signatureLabel: {
                    fontSize: 10,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 5, 0, 2] as [number, number, number, number]
                },
                signatureDate: {
                    fontSize: 10,
                    alignment: 'center'
                }
            };

            // Build document content
            const content: Content[] = [
                // Header
                {
                    columns: [
                        { text: '', width: '*' },
                        { text: 'ใบแจ้งซ่อม', style: 'header', width: 'auto' },
                        { text: `เลขที่เอกสาร: ${ticket.ticket_number || ticket.id}`, style: 'docNumber', width: '*' }
                    ]
                },
                {
                    canvas: [
                        { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }
                    ],
                    margin: [0, 10, 0, 10] as [number, number, number, number]
                },

                // Two-column layout: General Info and Vehicle Info
                {
                    columns: [
                        // Left column: General Info
                        {
                            width: '50%',
                            stack: [
                                { text: 'ข้อมูลทั่วไป (General Info)', style: 'sectionHeader' },
                                { text: 'วันที่แจ้ง (Date)', style: 'label' },
                                { text: new Date(ticket.created_at).toLocaleDateString('th-TH'), style: 'value' },
                                { text: 'สถานะ (Status)', style: 'label' },
                                { text: 'รอซ่อม', style: 'value' },
                                { text: 'ผู้แจ้ง (Reporter)', style: 'label' },
                                { text: ticket.reporter_name, style: 'value' },
                                { text: 'สาขา (Branch)', style: 'label' },
                                { text: ticket.branch || '-', style: 'value' }
                            ]
                        },
                        // Right column: Vehicle Info
                        {
                            width: '50%',
                            stack: [
                                { text: 'ข้อมูลรถยนต์ (Vehicle Info)', style: 'sectionHeader' },
                                { text: 'ทะเบียน (Plate)', style: 'label' },
                                { text: ticket.vehicle_plate, style: 'value' },
                                { text: 'ยี่ห้อ/รุ่น (Make/Model)', style: 'label' },
                                { text: makeModel, style: 'value' },
                                { text: 'ประเภท (Type)', style: 'label' },
                                { text: ticket.vehicle_type || '-', style: 'value' },
                                { text: 'เลขไมล์ (Odometer)', style: 'label' },
                                { text: ticket.odometer ? `${ticket.odometer.toLocaleString()} km` : '-', style: 'value' }
                            ]
                        }
                    ],
                    columnGap: 20
                },

                {
                    canvas: [
                        { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }
                    ],
                    margin: [0, 10, 0, 10] as [number, number, number, number]
                },

                // Repair Details and Repair Info
                {
                    columns: [
                        // Left column: Repair Details
                        {
                            width: '50%',
                            stack: [
                                { text: 'รายละเอียดการซ่อม (Repair Details)', style: 'sectionHeader' },
                                { text: 'ประเภทการซ่อม (Repair Type)', style: 'label' },
                                { text: repairType, style: 'value' },
                                { text: 'ปัญหา/อาการ (Problem Description)', style: 'label' },
                                { text: problemDescription, style: 'value', margin: [0, 0, 0, 8] as [number, number, number, number] },
                                { text: 'ความเร่งด่วน (Urgency)', style: 'label' },
                                { text: ticket.urgency, style: 'value' }
                            ]
                        },
                        // Right column: Repair Info
                        {
                            width: '50%',
                            stack: [
                                { text: 'ข้อมูลการซ่อม (Repair Info)', style: 'sectionHeader' },
                                { text: 'อู่/ร้านที่จะเข้าซ่อม (Garage)', style: 'label' },
                                { text: repairGarage, style: 'value' },
                                { text: 'หมายเหตุ (Notes)', style: 'label' },
                                { text: repairNotes, style: 'value' },
                                { text: 'ประวัติการซ่อมล่าสุด (Last Repair Date)', style: 'label' },
                                { text: lastRepairDate, style: 'value' }
                            ]
                        }
                    ],
                    columnGap: 20
                },

                // Spacer before signatures
                { text: '', margin: [0, 20, 0, 20] as [number, number, number, number] },

                // Signatures
                {
                    columns: [
                        {
                            width: '33%',
                            stack: [
                                {
                                    canvas: [
                                        { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                    ]
                                },
                                { text: 'ผู้ตรวจสอบ (Inspector)', style: 'signatureLabel' },
                                { text: 'Date: ____/____/____', style: 'signatureDate' }
                            ]
                        },
                        {
                            width: '33%',
                            stack: [
                                {
                                    canvas: [
                                        { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                    ]
                                },
                                { text: 'ผู้จัดการ (Manager)', style: 'signatureLabel' },
                                { text: 'Date: ____/____/____', style: 'signatureDate' }
                            ]
                        },
                        {
                            width: '33%',
                            stack: [
                                {
                                    canvas: [
                                        { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                    ]
                                },
                                { text: 'ผู้บริหาร (Executive)', style: 'signatureLabel' },
                                { text: 'Date: ____/____/____', style: 'signatureDate' }
                            ]
                        }
                    ],
                    columnGap: 10,
                    margin: [0, 40, 0, 0] as [number, number, number, number]
                }
            ];

            // Create document definition
            const docDefinition: TDocumentDefinitions = {
                pageSize: 'A4',
                pageMargins: [40, 40, 40, 40] as [number, number, number, number],
                defaultStyle: {
                    font: 'Sarabun',
                    fontSize: 12,
                    lineHeight: 1.3
                },
                content,
                styles
            };

            // ตรวจสอบว่า vfs ถูกตั้งค่าจริงๆ ก่อนสร้าง PDF
            if (!(pdfMake as any).vfs || !(pdfMake as any).vfs['Sarabun-Regular.ttf']) {
                throw new Error('Fonts not loaded. VFS is not properly initialized.');
            }

            // ตรวจสอบว่า vfs ถูกตั้งค่าจริงๆ ก่อนสร้าง PDF
            if (!(pdfMake as any).vfs || !(pdfMake as any).vfs['Sarabun-Regular.ttf']) {
                throw new Error('Fonts not loaded. VFS is not properly initialized.');
            }

            // Generate and download PDF
            pdfMake.createPdf(docDefinition).download(`Maintenance_Ticket_${ticket.ticket_number || ticket.id}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('เกิดข้อผิดพลาดในการสร้าง PDF');
        }
    },

    // Generate PDF as Blob (for sending via notifications)
    generateMaintenanceTicketPDFAsBlob: async (ticket: Ticket): Promise<Blob> => {
        await ensurePdfFontsLoaded();
        return new Promise((resolve, reject) => {
            try {
                console.log('[pdfService] generateMaintenanceTicketPDFAsBlob input:', ticket);

                // Normalized fields
                const repairType = ticket.problem || (ticket as any).repair_type || '-';
                const problemDescription = ticket.description || (ticket as any).problem_description || '-';
                const makeModel = `${ticket.vehicle_make || (ticket as any).vehicle_make || ''} ${ticket.vehicle_model || (ticket as any).vehicle_model || ''}`.trim() || '-';
                const repairGarage = ticket.garage || (ticket as any).repair_garage || '-';
                const repairNotes = ticket.notes || (ticket as any).repair_notes || '-';
                const lastRepairDate = ticket.last_repair_date
                    ? new Date(ticket.last_repair_date).toLocaleDateString('th-TH')
                    : '-';

                // Define styles (same as above)
                const styles: StyleDictionary = {
                    header: {
                        fontSize: 16,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 0, 0, 10] as [number, number, number, number]
                    },
                    docNumber: {
                        fontSize: 12,
                        bold: true,
                        alignment: 'right',
                        margin: [0, 0, 0, 0] as [number, number, number, number]
                    },
                    sectionHeader: {
                        fontSize: 14,
                        bold: true,
                        margin: [0, 10, 0, 5] as [number, number, number, number]
                    },
                    label: {
                        fontSize: 10,
                        bold: true,
                        color: '#666666',
                        margin: [0, 0, 0, 2] as [number, number, number, number]
                    },
                    value: {
                        fontSize: 12,
                        margin: [0, 0, 0, 8] as [number, number, number, number]
                    },
                    signatureLabel: {
                        fontSize: 10,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 5, 0, 2] as [number, number, number, number]
                    },
                    signatureDate: {
                        fontSize: 10,
                        alignment: 'center'
                    }
                };

                // Build document content (same structure as download version)
                const content: Content[] = [
                    {
                        columns: [
                            { text: '', width: '*' },
                            { text: 'ใบแจ้งซ่อม', style: 'header', width: 'auto' },
                            { text: `เลขที่เอกสาร: ${ticket.ticket_number || ticket.id}`, style: 'docNumber', width: '*' }
                        ]
                    },
                    {
                        canvas: [
                            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }
                        ],
                        margin: [0, 10, 0, 10] as [number, number, number, number]
                    },
                    {
                        columns: [
                            {
                                width: '50%',
                                stack: [
                                    { text: 'ข้อมูลทั่วไป (General Info)', style: 'sectionHeader' },
                                    { text: 'วันที่แจ้ง (Date)', style: 'label' },
                                    { text: new Date(ticket.created_at).toLocaleDateString('th-TH'), style: 'value' },
                                    { text: 'สถานะ (Status)', style: 'label' },
                                    { text: 'รอซ่อม', style: 'value' },
                                    { text: 'ผู้แจ้ง (Reporter)', style: 'label' },
                                    { text: ticket.reporter_name, style: 'value' },
                                    { text: 'สาขา (Branch)', style: 'label' },
                                    { text: ticket.branch || '-', style: 'value' }
                                ]
                            },
                            {
                                width: '50%',
                                stack: [
                                    { text: 'ข้อมูลรถยนต์ (Vehicle Info)', style: 'sectionHeader' },
                                    { text: 'ทะเบียน (Plate)', style: 'label' },
                                    { text: ticket.vehicle_plate, style: 'value' },
                                    { text: 'ยี่ห้อ/รุ่น (Make/Model)', style: 'label' },
                                    { text: makeModel, style: 'value' },
                                    { text: 'ประเภท (Type)', style: 'label' },
                                    { text: ticket.vehicle_type || '-', style: 'value' },
                                    { text: 'เลขไมล์ (Odometer)', style: 'label' },
                                    { text: ticket.odometer ? `${ticket.odometer.toLocaleString()} km` : '-', style: 'value' }
                                ]
                            }
                        ],
                        columnGap: 20
                    },
                    {
                        canvas: [
                            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }
                        ],
                        margin: [0, 10, 0, 10] as [number, number, number, number]
                    },
                    {
                        columns: [
                            {
                                width: '50%',
                                stack: [
                                    { text: 'รายละเอียดการซ่อม (Repair Details)', style: 'sectionHeader' },
                                    { text: 'ประเภทการซ่อม (Repair Type)', style: 'label' },
                                    { text: repairType, style: 'value' },
                                    { text: 'ปัญหา/อาการ (Problem Description)', style: 'label' },
                                    { text: problemDescription, style: 'value', margin: [0, 0, 0, 8] as [number, number, number, number] },
                                    { text: 'ความเร่งด่วน (Urgency)', style: 'label' },
                                    { text: ticket.urgency, style: 'value' }
                                ]
                            },
                            {
                                width: '50%',
                                stack: [
                                    { text: 'ข้อมูลการซ่อม (Repair Info)', style: 'sectionHeader' },
                                    { text: 'อู่/ร้านที่จะเข้าซ่อม (Garage)', style: 'label' },
                                    { text: repairGarage, style: 'value' },
                                    { text: 'หมายเหตุ (Notes)', style: 'label' },
                                    { text: repairNotes, style: 'value' },
                                    { text: 'ประวัติการซ่อมล่าสุด (Last Repair Date)', style: 'label' },
                                    { text: lastRepairDate, style: 'value' }
                                ]
                            }
                        ],
                        columnGap: 20
                    },
                    { text: '', margin: [0, 20, 0, 20] as [number, number, number, number] },
                    {
                        columns: [
                            {
                                width: '33%',
                                stack: [
                                    {
                                        canvas: [
                                            { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                        ]
                                    },
                                    { text: 'ผู้ตรวจสอบ (Inspector)', style: 'signatureLabel' },
                                    { text: 'Date: ____/____/____', style: 'signatureDate' }
                                ]
                            },
                            {
                                width: '33%',
                                stack: [
                                    {
                                        canvas: [
                                            { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                        ]
                                    },
                                    { text: 'ผู้จัดการ (Manager)', style: 'signatureLabel' },
                                    { text: 'Date: ____/____/____', style: 'signatureDate' }
                                ]
                            },
                            {
                                width: '33%',
                                stack: [
                                    {
                                        canvas: [
                                            { type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5 }
                                        ]
                                    },
                                    { text: 'ผู้บริหาร (Executive)', style: 'signatureLabel' },
                                    { text: 'Date: ____/____/____', style: 'signatureDate' }
                                ]
                            }
                        ],
                        columnGap: 10,
                        margin: [0, 40, 0, 0] as [number, number, number, number]
                    }
                ];

                // Create document definition
                const docDefinition: TDocumentDefinitions = {
                    pageSize: 'A4',
                    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
                    defaultStyle: {
                        font: 'Sarabun',
                        fontSize: 12,
                        lineHeight: 1.3
                    },
                    content,
                    styles
                };

                // ตรวจสอบว่า vfs ถูกตั้งค่าจริงๆ ก่อนสร้าง PDF
                if (!(pdfMake as any).vfs || !(pdfMake as any).vfs['Sarabun-Regular.ttf']) {
                    throw new Error('Fonts not loaded. VFS is not properly initialized.');
                }

                // Generate PDF as Blob
                pdfMake.createPdf(docDefinition).getBlob((blob) => {
                    resolve(blob);
                });
            } catch (error) {
                console.error('Error generating PDF as Blob:', error);
                reject(error);
            }
        });
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
            console.log('[pdfService] Starting generateDeliveryTripPDFA5 for trip:', trip.trip_number || trip.id);
            await ensurePdfFontsLoaded();
            console.log('[pdfService] Fonts loaded, proceeding with PDF generation');
            console.log('[pdfService] generateDeliveryTripPDFA5 input:', trip);

            // Build stores section
            const storesContent: Content[] = [];
            if (trip.stores && trip.stores.length > 0) {
                storesContent.push({ text: 'ร้านค้า', fontSize: 14, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] });

                trip.stores
                    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
                    .forEach((storeWithDetails: any) => {
                        const store = storeWithDetails.store;
                        if (!store) return;

                        // Store header
                        storesContent.push({
                            text: `${storeWithDetails.sequence_order}. ${store.customer_code} - ${store.customer_name}`,
                            fontSize: 11,
                            bold: true,
                            margin: [0, 3, 0, 2] as [number, number, number, number]
                        });

                        // Store address
                        if (store.address) {
                            storesContent.push({
                                text: `   ที่อยู่: ${store.address}`,
                                fontSize: 9,
                                margin: [0, 0, 0, 2] as [number, number, number, number]
                            });
                        }

                        // Products for this store
                        if (storeWithDetails.items && storeWithDetails.items.length > 0) {
                            const productItems: Content[] = [];
                            storeWithDetails.items.forEach((item: any) => {
                                const product = item.product;
                                if (!product) return;

                                productItems.push({
                                    columns: [
                                        {
                                            text: `   • ${product.product_code} - ${product.product_name}`,
                                            width: '*'
                                        },
                                        {
                                            text: item.quantity.toLocaleString(),
                                            width: 'auto',
                                            alignment: 'right'
                                        },
                                        {
                                            text: product.unit,
                                            width: 30,
                                            alignment: 'right'
                                        }
                                    ],
                                    fontSize: 9,
                                    margin: [0, 0, 0, 1] as [number, number, number, number]
                                });
                            });
                            storesContent.push(...productItems);
                        }

                        storesContent.push({ text: '', margin: [0, 2, 0, 0] as [number, number, number, number] });
                    });
            }

            // Build aggregated products table
            const aggregatedContent: Content[] = [];
            if (aggregatedProducts.length > 0) {
                const tableBody = [
                    [
                        { text: 'รหัส', bold: true },
                        { text: 'ชื่อสินค้า', bold: true },
                        { text: 'หมวดหมู่', bold: true },
                        { text: 'จำนวน', bold: true }
                    ],
                    ...aggregatedProducts.map((product) => [
                        product.product_code,
                        product.product_name,
                        product.category,
                        `${product.total_quantity.toLocaleString()} ${product.unit}`
                    ])
                ];

                aggregatedContent.push({
                    text: 'สรุปสินค้าทั้งหมด',
                    fontSize: 14,
                    bold: true,
                    margin: [0, 5, 0, 5] as [number, number, number, number]
                });

                aggregatedContent.push({
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto'],
                        body: tableBody
                    },
                    layout: 'lightHorizontalLines',
                    fontSize: 8
                });
            }

            // Build content
            const content: Content[] = [
                // Header
                { text: 'ใบเบิกสินค้า', fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 5] as [number, number, number, number] },

                // Date and Trip Number
                {
                    columns: [
                        {
                            text: `วันที่: ${new Date(trip.planned_date).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}`,
                            width: '*'
                        },
                        {
                            text: `รหัสทริป: ${trip.trip_number || 'N/A'}`,
                            width: '*',
                            alignment: 'right'
                        }
                    ],
                    fontSize: 11,
                    margin: [0, 0, 0, 3] as [number, number, number, number]
                },

                // Vehicle and Driver
                {
                    columns: [
                        {
                            text: trip.vehicle ? `รถ: ${trip.vehicle.plate}${trip.vehicle.make && trip.vehicle.model ? ` (${trip.vehicle.make} ${trip.vehicle.model})` : ''}` : '',
                            width: '*'
                        },
                        {
                            text: trip.driver ? `คนขับ: ${trip.driver.full_name}` : '',
                            width: '*',
                            alignment: 'right'
                        }
                    ],
                    fontSize: 11,
                    margin: [0, 0, 0, 5] as [number, number, number, number]
                },

                // Stores section
                ...storesContent,

                // Aggregated products
                ...aggregatedContent,

                // Notes
                ...(trip.notes ? [
                    { text: 'หมายเหตุ:', fontSize: 10, bold: true, margin: [0, 5, 0, 2] as [number, number, number, number] },
                    { text: trip.notes, fontSize: 9, margin: [0, 0, 0, 0] as [number, number, number, number] }
                ] : [])
            ];

            // Create document definition
            const docDefinition: TDocumentDefinitions = {
                pageSize: 'A5',
                pageOrientation: 'portrait',
                pageMargins: [10, 15, 10, 15] as [number, number, number, number],
                defaultStyle: {
                    font: 'Sarabun',
                    fontSize: 10
                },
                content,
                styles: {
                    normal: {
                        font: 'Sarabun'
                    }
                }
            };

            // ตรวจสอบว่า vfs ถูกตั้งค่าจริงๆ ก่อนสร้าง PDF
            console.log('[pdfService] Before PDF creation check:', {
                hasVfs: !!pdfMake.vfs,
                hasSarabunRegular: !!pdfMake.vfs?.['Sarabun-Regular.ttf'],
                hasSarabunBold: !!pdfMake.vfs?.['Sarabun-Bold.ttf'],
                sarabunFont: pdfMake.fonts?.Sarabun,
                defaultFont: docDefinition.defaultStyle?.font
            });

            if (!pdfMake.vfs || !pdfMake.vfs['Sarabun-Regular.ttf']) {
                throw new Error('Fonts not loaded. VFS is not properly initialized.');
            }

            console.log('[pdfService] Creating PDF with docDefinition:', docDefinition);

            // รอให้ pdfMake อัพเดท font registry ก่อนสร้าง PDF
            await new Promise(resolve => setTimeout(resolve, 100));

            // Generate and download PDF
            pdfMake.createPdf(docDefinition).download(`delivery-trip-${trip.trip_number || trip.id}.pdf`);
        } catch (error) {
            console.error('[pdfService] Error generating delivery trip PDF:', error);
            throw error;
        }
    },
};
