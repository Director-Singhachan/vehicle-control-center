# LINE PDF Approval Setup

## Overview
ระบบรองรับการอนุมัติตั๋วผ่าน LINE โดยการส่ง PDF ที่เซ็นแล้วกลับมา

## Database Migration

ก่อนใช้งานต้องรัน migration เพื่อเพิ่ม columns ใน `notification_settings` table:

```sql
-- Run this SQL in Supabase SQL Editor
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS line_pending_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS line_pending_ticket_number TEXT,
ADD COLUMN IF NOT EXISTS line_pending_pdf_uploaded_at TIMESTAMPTZ;
```

หรือรันไฟล์ migration:
```bash
# ใน Supabase Dashboard > SQL Editor > New Query
# Copy เนื้อหาจาก supabase/migrations/add_line_pending_fields.sql
```

## How It Works

### Flow 1: ส่ง PDF ก่อน แล้วส่ง Ticket Number ตามมา
1. ผู้ใช้ส่ง PDF มาทาง LINE
2. ระบบอัปโหลด PDF ไปยัง Supabase Storage (`pending-pdfs/{lineUserId}/{timestamp}.pdf`)
3. ระบบเก็บ path ไว้ใน `notification_settings.line_pending_pdf_path`
4. ผู้ใช้ส่ง Ticket Number เช่น "Ticket #2511-046"
5. ระบบดาวน์โหลด PDF จาก Storage
6. ระบบประมวลผลและอนุมัติอัตโนมัติ
7. ระบบย้าย PDF ไปยัง `signed-tickets/{ticketId}/{role}_{timestamp}.pdf`
8. ระบบลบไฟล์ชั่วคราว

### Flow 2: ส่ง Ticket Number ก่อน แล้วส่ง PDF ตามมา
1. ผู้ใช้ส่ง Ticket Number เช่น "Ticket #2511-046"
2. ระบบเก็บ Ticket Number ไว้ใน `notification_settings.line_pending_ticket_number`
3. ผู้ใช้ส่ง PDF มาทาง LINE
4. ระบบประมวลผลทันที (เพราะมี Ticket Number รออยู่)
5. ระบบอนุมัติอัตโนมัติ

## Storage Structure

```
ticket-attachments/
├── pending-pdfs/              # PDFs รอ Ticket Number
│   └── {lineUserId}/
│       └── {timestamp}.pdf
└── signed-tickets/            # PDFs ที่เซ็นแล้ว
    └── {ticketId}/
        └── {role}_{timestamp}.pdf
```

## Environment Variables

ต้องตั้งค่าใน Supabase Edge Functions:
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Messaging API Channel Access Token

## Testing

1. ส่ง PDF มาทาง LINE Bot
2. ส่ง Ticket Number ตามมา เช่น "Ticket #2511-046"
3. ตรวจสอบว่า PDF ถูกอัปโหลดและอนุมัติอัตโนมัติ

## Troubleshooting

### PDF หายไปหลังจากส่ง Ticket Number
- ตรวจสอบว่า migration รันแล้วหรือยัง
- ตรวจสอบ logs ใน Supabase Edge Functions
- ตรวจสอบว่า `line_pending_pdf_path` ถูกเก็บไว้ใน database หรือไม่

### ไม่สามารถดาวน์โหลด PDF จาก Storage
- ตรวจสอบว่า Storage bucket `ticket-attachments` มีอยู่
- ตรวจสอบ permissions ของ Storage bucket

