# คู่มือตั้งค่าระบบส่ง PDF และรับ PDF ที่เซ็นแล้ว

## 📋 ขั้นตอนการตั้งค่า

### ✅ ขั้นตอนที่ 1: อัปเดต Database Schema

1. ไปที่ **Supabase Dashboard** → **SQL Editor**
2. สร้าง Query ใหม่
3. Copy เนื้อหาจากไฟล์ `sql/20251213000000_add_pdf_support_to_notifications.sql`
4. Run Query
5. ตรวจสอบว่าไม่มี error

**สิ่งที่ทำ:**
- เพิ่ม column `pdf_data` และ `target_user_id` ใน `notification_events`
- อัปเดต CHECK constraint เพื่อรองรับ `ticket_pdf_for_approval`
- อัปเดต RLS policies

---

### ✅ ขั้นตอนที่ 2: Deploy Edge Function `notification-worker`

1. ไปที่ **Supabase Dashboard** → **Edge Functions**
2. คลิก **Create a new function**
3. ตั้งชื่อ: `notification-worker`
4. Copy เนื้อหาจากไฟล์ `supabase/functions/notification-worker/index.ts`
5. Paste ลงใน editor
6. คลิก **Deploy**

**Environment Variables ที่ต้องตั้งค่า:**
- `SUPABASE_URL` - จะตั้งอัตโนมัติ
- `SUPABASE_SERVICE_ROLE_KEY` - จะตั้งอัตโนมัติ
- `TELEGRAM_BOT_TOKEN` - ตั้งค่าถ้าต้องการใช้ Telegram (ถ้ามี)
- `LINE_NOTIFY_TOKEN` - ตั้งค่าถ้าต้องการใช้ LINE (ถ้ามี)

---

### ✅ ขั้นตอนที่ 3: Deploy Edge Function `telegram-webhook`

1. ไปที่ **Supabase Dashboard** → **Edge Functions**
2. คลิก **Create a new function**
3. ตั้งชื่อ: `telegram-webhook`
4. Copy เนื้อหาจากไฟล์ `supabase/functions/telegram-webhook/index.ts`
5. Paste ลงใน editor
6. คลิก **Deploy**

### ✅ ขั้นตอนที่ 3.1: ตั้งค่า Environment Variable `TELEGRAM_BOT_TOKEN`

**วิธีที่ 1: ตั้งค่าใน Project Settings (แนะนำ)**
1. ไปที่ **Supabase Dashboard** → **Project Settings** (ไอคอนฟันเฟือง ⚙️)
2. เลือก **Edge Functions** ในเมนูด้านซ้าย
3. หาส่วน **Environment Variables** หรือ **Secrets**
4. คลิก **Add new secret** หรือ **Add variable**
5. ตั้งค่า:
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: วาง Token จาก BotFather
6. คลิก **Save**

**วิธีที่ 2: ตั้งค่าใน Function Details**
1. ไปที่ **Edge Functions** → **telegram-webhook**
2. คลิกแท็บ **Details**
3. หาส่วน **Environment Variables** หรือ **Secrets**
4. เพิ่ม `TELEGRAM_BOT_TOKEN` และใส่ค่า Token

**วิธีที่ 3: ตั้งค่าใน Code Editor (ถ้ามี)**
1. ไปที่ **Edge Functions** → **telegram-webhook**
2. คลิกแท็บ **Code**
3. หาส่วน **Environment Variables** หรือ **Settings** ด้านข้าง
4. เพิ่ม `TELEGRAM_BOT_TOKEN`

**วิธีหา TELEGRAM_BOT_TOKEN:**
1. เปิด Telegram → ค้นหา `@BotFather`
2. ส่งคำสั่ง `/newbot` (ถ้ายังไม่มี bot) หรือ `/mybots` (ถ้ามี bot อยู่แล้ว)
3. เลือก bot ที่ต้องการ
4. เลือก **API Token** หรือ **Token**
5. Copy **Token** (รูปแบบ: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**หมายเหตุ:** 
- Environment Variables ใน Supabase อาจจะเรียกว่า "Secrets" หรือ "Environment Secrets"
- หลังจากตั้งค่าแล้ว อาจต้อง Deploy function ใหม่
- `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` จะถูกตั้งค่าอัตโนมัติ ไม่ต้องตั้งเอง

---

### ✅ ขั้นตอนที่ 4: ตั้งค่า Telegram Bot Webhook

หลังจาก deploy `telegram-webhook` แล้ว ต้องตั้งค่า webhook เพื่อให้ Telegram ส่งข้อมูลมาที่ function ของเรา

**วิธีที่ 1: ใช้ Supabase Dashboard**
1. ไปที่ **Edge Functions** → **telegram-webhook**
2. Copy **Function URL** (รูปแบบ: `https://<project>.supabase.co/functions/v1/telegram-webhook`)
3. เปิด Terminal หรือใช้ Postman/curl

**วิธีที่ 2: ใช้ curl (Terminal)**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<YOUR_PROJECT>.supabase.co/functions/v1/telegram-webhook"}'
```

**วิธีที่ 3: ใช้ Browser**
เปิด URL นี้ใน browser (แทน `<YOUR_BOT_TOKEN>` และ `<YOUR_PROJECT>`):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT>.supabase.co/functions/v1/telegram-webhook
```

**ตรวจสอบว่า webhook ตั้งค่าสำเร็จ:**
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

ควรเห็น `"url": "https://<YOUR_PROJECT>.supabase.co/functions/v1/telegram-webhook"`

---

### ✅ ขั้นตอนที่ 5: ตั้งค่า Telegram Chat ID สำหรับผู้ใช้

ผู้ใช้แต่ละคนต้องตั้งค่า Telegram Chat ID ในระบบ:

1. เปิด Telegram → ค้นหา `@userinfobot` หรือ `@getidsbot`
2. ส่งคำสั่ง `/start`
3. Bot จะส่ง Chat ID มาให้ (ตัวเลข เช่น `123456789`)
4. ไปที่แอป → **Settings** → **Notifications**
5. เปิด **Enable Telegram**
6. ใส่ **Telegram Chat ID** ที่ได้จาก bot
7. บันทึก

---

## 🧪 การทดสอบ

### ทดสอบการส่ง PDF (ออก)

1. สร้าง Ticket ใหม่ในระบบ
2. ระบบจะส่ง PDF ไปยัง Telegram ของ Inspector อัตโนมัติ
3. ตรวจสอบว่า Inspector ได้รับ PDF ใน Telegram

### ทดสอบการรับ PDF (เข้า)

**วิธีที่ 1: ผ่าน Telegram**
1. เปิด Telegram
2. ส่ง PDF ที่เซ็นแล้วไปยัง Bot
3. พร้อมระบุเลขที่ตั๋ว เช่น: `"Ticket #2501-001"`
4. Bot จะตอบกลับว่า "✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!"
5. ตรวจสอบในระบบว่า signature URL ถูกอัปเดต

**วิธีที่ 2: ผ่าน Web Interface**
1. ไปที่หน้า Ticket Detail
2. เลื่อนลงไปที่ส่วน "อัปโหลด PDF ที่เซ็นแล้ว"
3. เลือกไฟล์ PDF
4. กดปุ่ม "อัปโหลด PDF ที่เซ็นแล้ว"
5. ตรวจสอบว่า signature URL ถูกอัปเดต

---

## 🔍 ตรวจสอบปัญหา

### ปัญหา: ไม่ได้รับ PDF ใน Telegram

**ตรวจสอบ:**
1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **notification-worker** → **Logs**
2. ดูว่ามี error หรือไม่
3. ตรวจสอบว่า `TELEGRAM_BOT_TOKEN` ตั้งค่าถูกต้อง
4. ตรวจสอบว่า `telegram_chat_id` ใน `notification_settings` ถูกต้อง

### ปัญหา: Telegram Bot ไม่รับ PDF

**ตรวจสอบ:**
1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook** → **Logs**
2. ดูว่ามี error หรือไม่
3. ตรวจสอบว่า webhook ตั้งค่าถูกต้อง:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```
4. ตรวจสอบว่า `TELEGRAM_BOT_TOKEN` ใน Environment Variables ถูกต้อง

### ปัญหา: ไม่พบเลขที่ตั๋ว

**วิธีแก้:**
- ระบุเลขที่ตั๋วให้ชัดเจน เช่น:
  - `"Ticket #2501-001"`
  - `"เลขที่ 2501-001"`
  - `"#2501-001"`

---

## 📝 สรุป Checklist

- [ ] รัน SQL migration (`20251213000000_add_pdf_support_to_notifications.sql`)
- [ ] Deploy Edge Function `notification-worker`
- [ ] Deploy Edge Function `telegram-webhook`
- [ ] ตั้งค่า `TELEGRAM_BOT_TOKEN` ใน Environment Variables
- [ ] ตั้งค่า Telegram Bot Webhook
- [ ] ตั้งค่า Telegram Chat ID สำหรับผู้ใช้แต่ละคน
- [ ] ทดสอบการส่ง PDF
- [ ] ทดสอบการรับ PDF

---

## 🎯 ข้อมูลเพิ่มเติม

- **Function URLs:**
  - `notification-worker`: `https://<project>.supabase.co/functions/v1/notification-worker`
  - `telegram-webhook`: `https://<project>.supabase.co/functions/v1/telegram-webhook`

- **Storage Bucket:**
  - `ticket-attachments` - สำหรับเก็บ PDF ที่เซ็นแล้ว
  - Path: `signed-tickets/{ticket_id}/{role}_{timestamp}.pdf`

- **Database Columns:**
  - `notification_events.pdf_data` - เก็บ PDF base64
  - `notification_events.target_user_id` - ระบุผู้รับ
  - `tickets.inspector_signature_url` - URL ของ PDF ที่ inspector เซ็น
  - `tickets.manager_signature_url` - URL ของ PDF ที่ manager เซ็น
  - `tickets.executive_signature_url` - URL ของ PDF ที่ executive เซ็น

