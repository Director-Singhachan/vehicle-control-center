# ✅ Checklist: ขั้นตอนต่อไปหลังจากแก้ไข Telegram Webhook

## 📋 สรุปสิ่งที่ทำไปแล้ว

✅ แก้ไขโค้ด `telegram-webhook/index.ts` ใช้ `Deno.serve` แทน `serve`  
✅ สร้างไฟล์ `supabase.functions.config.json` ตั้งค่า `auth: false`  
✅ แก้ไขโค้ดให้รองรับการรับ PDF จาก Telegram  

---

## 🚀 ขั้นตอนที่ต้องทำต่อ

### ขั้นตอนที่ 1: Deploy Function

**วิธีที่ 1: ใช้ Supabase Dashboard (ง่ายที่สุด)**

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. เปิดแท็บ **Code**
3. Copy โค้ดจาก `supabase/functions/telegram-webhook/index.ts` ไปวาง
4. **Ignore error สีแดง** (เป็นเรื่องปกติ - TypeScript ไม่รู้จัก Deno types)
5. คลิก **Deploy** หรือ **Save**

**วิธีที่ 2: ใช้ CLI (ถ้ามี)**

```powershell
# Login (ถ้ายังไม่ได้ login)
npx supabase login

# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy
npx supabase functions deploy telegram-webhook
```

---

### ขั้นตอนที่ 2: ตั้งค่า Config File (ถ้าใช้ Dashboard)

**สำคัญ:** ไฟล์ `supabase.functions.config.json` อาจต้องอัปโหลดแยก

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. ดูว่ามีแท็บ **Config** หรือ **Settings** หรือไม่
3. ถ้ามี ให้อัปโหลดหรือสร้างไฟล์ที่มีเนื้อหา:
   ```json
   {
     "auth": false
   }
   ```
4. ถ้าไม่มี ให้ใช้ CLI deploy (วิธีที่ 2) เพื่อให้ config file ถูก deploy อัตโนมัติ

---

### ขั้นตอนที่ 3: ตั้งค่า Environment Variables

ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook** → **Settings** → **Environment Variables**

ตั้งค่า:
- `TELEGRAM_BOT_TOKEN` = `YOUR_TELEGRAM_BOT_TOKEN`

**วิธีหา Telegram Bot Token:**
1. เปิด Telegram และค้นหา `@BotFather`
2. ส่งคำสั่ง `/mybots`
3. เลือก Bot ของคุณ
4. เลือก **API Token**
5. Copy Token (รูปแบบ: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
- `SUPABASE_URL` = (มีอยู่แล้วอัตโนมัติ)
- `SUPABASE_SERVICE_ROLE_KEY` = (มีอยู่แล้วอัตโนมัติ)

---

### ขั้นตอนที่ 4: ตั้งค่า Telegram Webhook

หลังจาก Deploy แล้ว ตั้งค่า webhook URL:

**วิธีที่ 1: ใช้ Browser**

เปิด URL นี้ใน browser (แทน `<YOUR_BOT_TOKEN>` และ `<YOUR_PROJECT_REF>`):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook
```

**วิธีที่ 2: ใช้ PowerShell**

```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook"
```

**ผลลัพธ์ที่ต้องการ:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

### ขั้นตอนที่ 5: ตรวจสอบ Webhook Status

เปิด URL นี้ใน browser (แทน `<YOUR_BOT_TOKEN>`):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**ผลลัพธ์ที่ต้องการ:**
```json
{
  "ok": true,
  "result": {
    "url": "https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0,  ← ควรเป็น 0
    "last_error_message": null,  ← ควรเป็น null (ไม่ใช่ "401 Unauthorized")
    "max_connections": 40
  }
}
```

---

### ขั้นตอนที่ 6: ทดสอบระบบ

1. **ทดสอบรับข้อความ:**
   - ส่งข้อความ `/start` หรือ `help` ไปยัง Bot
   - ควรได้รับข้อความตอบกลับ

2. **ทดสอบรับ PDF:**
   - สร้างตั๋วแจ้งซ่อมใหม่ (ระบบจะส่ง PDF ไปยังผู้ตรวจสอบ)
   - ผู้ตรวจสอบเซ็น PDF แล้วส่งกลับมาพร้อมข้อความ "Ticket #2501-001"
   - ตรวจสอบว่า PDF ถูกอัปโหลดและ URL ถูกบันทึกในฐานข้อมูล

---

## 🔍 ตรวจสอบปัญหา

### ถ้ายังมี `401 Unauthorized`:

1. ตรวจสอบว่าไฟล์ `supabase.functions.config.json` ถูก deploy แล้ว
2. ตรวจสอบว่าใช้ `Deno.serve` ไม่ใช่ `serve`
3. ลอง Deploy Function ใหม่

### ถ้า Bot ไม่ตอบกลับ:

1. ตรวจสอบ `TELEGRAM_BOT_TOKEN` ใน Environment Variables
2. ตรวจสอบ webhook URL ว่าถูกต้อง
3. ดู Logs ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs

### ถ้า PDF ไม่ถูกอัปโหลด:

1. ตรวจสอบว่า Storage bucket `ticket-attachments` มีอยู่
2. ตรวจสอบ RLS policies ของ Storage
3. ดู Logs เพื่อดู error message

---

## 📝 ไฟล์ที่เกี่ยวข้อง

- `supabase/functions/telegram-webhook/index.ts` - Function code
- `supabase/functions/telegram-webhook/supabase.functions.config.json` - Config file
- `docs/DEPLOY_TELEGRAM_WEBHOOK.md` - คู่มือ deploy
- `docs/FIX_401_UNAUTHORIZED_FINAL.md` - วิธีแก้ 401 error

---

## ✅ Checklist สรุป

- [ ] Deploy `telegram-webhook` function
- [ ] ตั้งค่า `supabase.functions.config.json` (auth: false)
- [ ] ตั้งค่า Environment Variables (`TELEGRAM_BOT_TOKEN`)
- [ ] ตั้งค่า Telegram Webhook URL
- [ ] ตรวจสอบ Webhook Status (ไม่มี error)
- [ ] ทดสอบรับข้อความจาก Bot
- [ ] ทดสอบรับ PDF และอัปเดต ticket

---

**หมายเหตุ:** Error สีแดงใน Dashboard editor เป็นเรื่องปกติ - Function จะทำงานได้ปกติเมื่อ Deploy แล้ว

