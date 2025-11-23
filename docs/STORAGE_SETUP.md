# การตั้งค่า Storage Bucket สำหรับ Ticket Attachments

## ปัญหา
Error: `Bucket not found` เมื่อพยายาม upload ไฟล์ใน TicketFormView

## วิธีแก้ไข

### วิธีที่ 1: ใช้ SQL Migration (แนะนำ)

1. เปิด Supabase Dashboard → **SQL Editor**
2. คัดลอกและรัน SQL จากไฟล์:
   ```
   sql/20251204000001_create_storage_bucket.sql
   ```
3. ตรวจสอบว่า bucket ถูกสร้างแล้ว:
   - ไปที่ **Storage** → ควรเห็น bucket `ticket-attachments`

### วิธีที่ 2: สร้างผ่าน Supabase Dashboard

1. เปิด Supabase Dashboard → **Storage**
2. คลิก **New bucket**
3. ตั้งค่าดังนี้:
   - **Name**: `ticket-attachments`
   - **Public bucket**: ✅ เปิดใช้งาน (เพื่อให้ไฟล์เข้าถึงได้ผ่าน public URL)
   - **File size limit**: `50 MB` (52428800 bytes)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
     - `image/svg+xml`
     - `application/pdf`
     - `video/mp4`
     - `video/quicktime`
4. คลิก **Create bucket**

### ตั้งค่า Policies (ถ้ายังไม่มี)

1. ไปที่ **Storage** → `ticket-attachments` → **Policies**
2. สร้าง policies ดังนี้:

#### Policy 1: Allow Upload (INSERT)
- **Policy name**: `Allow authenticated users to upload ticket attachments`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'ticket-attachments' AND
auth.role() = 'authenticated'
```

#### Policy 2: Allow Read (SELECT)
- **Policy name**: `Allow authenticated users to read ticket attachments`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'ticket-attachments' AND
auth.role() = 'authenticated'
```

#### Policy 3: Allow Update (UPDATE)
- **Policy name**: `Allow authenticated users to update ticket attachments`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'ticket-attachments' AND
auth.role() = 'authenticated'
```

#### Policy 4: Allow Delete (DELETE)
- **Policy name**: `Allow authenticated users to delete ticket attachments`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'ticket-attachments' AND
auth.role() = 'authenticated'
```

#### Policy 5: Public Read (SELECT) - Optional
- **Policy name**: `Allow public read access to ticket attachments`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**:
```sql
bucket_id = 'ticket-attachments'
```

## ทดสอบ

หลังจากตั้งค่าแล้ว ทดสอบโดย:

1. เปิดแอป → ไปที่หน้า **สร้างตั๋วซ่อมบำรุง**
2. เลือกไฟล์รูปภาพ
3. คลิก **บันทึก**
4. ควร upload สำเร็จและแสดง URL ของไฟล์

## หมายเหตุ

- Bucket ต้องเป็น **Public** เพื่อให้สามารถเข้าถึงไฟล์ผ่าน public URL
- File size limit: 50MB (สามารถปรับได้ตามต้องการ)
- Allowed MIME types: กำหนดประเภทไฟล์ที่อนุญาตให้ upload

