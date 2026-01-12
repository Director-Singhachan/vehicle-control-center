# 📘 คู่มือ Deploy Telegram Webhook ผ่าน CLI แบบละเอียด

## 🎯 เป้าหมาย
Deploy `telegram-webhook` function พร้อม config file (`supabase.functions.config.json`) ผ่าน Supabase CLI

---

## 📋 ขั้นตอนที่ 1: ตรวจสอบไฟล์

ก่อน deploy ให้ตรวจสอบว่าไฟล์เหล่านี้มีอยู่:

### ✅ ไฟล์ที่ต้องมี:

1. **`supabase/functions/telegram-webhook/index.ts`**
   - โค้ด function หลัก
   - ใช้ `Deno.serve` แทน `serve`

2. **`supabase/functions/telegram-webhook/supabase.functions.config.json`**
   - ตั้งค่า `auth: false`
   - เนื้อหา:
     ```json
     {
       "auth": false
     }
     ```

### 🔍 ตรวจสอบไฟล์:

เปิด PowerShell ในโฟลเดอร์โปรเจกต์:

```powershell
# ตรวจสอบว่าไฟล์มีอยู่
Test-Path "supabase\functions\telegram-webhook\index.ts"
Test-Path "supabase\functions\telegram-webhook\supabase.functions.config.json"
```

ควรได้ผลลัพธ์:
```
True
True
```

---

## 📋 ขั้นตอนที่ 2: ติดตั้ง/ตรวจสอบ Supabase CLI

### ตรวจสอบว่า CLI ติดตั้งแล้วหรือยัง:

```powershell
npx supabase --version
```

**ผลลัพธ์ที่ต้องการ:** แสดง version number เช่น `2.63.1`

**ถ้ายังไม่มี:** CLI จะถูกติดตั้งอัตโนมัติเมื่อรันคำสั่ง `npx supabase`

---

## 📋 ขั้นตอนที่ 3: Login Supabase

### วิธีที่ 1: Login แบบ Interactive (แนะนำ)

```powershell
npx supabase login
```

**สิ่งที่เกิดขึ้น:**
1. จะเปิด browser อัตโนมัติ
2. ถ้ายังไม่ได้ login ให้ login ใน browser
3. Authorize Supabase CLI
4. กลับมาที่ PowerShell จะเห็น "Login successful"

**ผลลัพธ์ที่ต้องการ:**
```
> npx supabase login
Opening browser...
Logged in as: your-email@example.com
```

### วิธีที่ 2: Login ด้วย Access Token

ถ้า browser ไม่เปิดอัตโนมัติ:

1. ไปที่: https://supabase.com/dashboard/account/tokens
2. สร้าง Access Token ใหม่
3. Copy token
4. รัน:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "your-access-token-here"
npx supabase login --token $env:SUPABASE_ACCESS_TOKEN
```

---

## 📋 ขั้นตอนที่ 4: Link Project

Link project กับ Supabase project ของคุณ:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
```

**วิธีหา Project Reference:**
1. ไปที่ Supabase Dashboard
2. เลือก Project ของคุณ
3. ไปที่ Settings → General
4. Copy **Reference ID** (รูปแบบ: `xxxxxxxxxxxxxxxxxx`)

**สิ่งที่เกิดขึ้น:**
1. จะถาม **Database password**
   - ใส่ password ที่ตั้งไว้ตอนสร้าง project
   - ถ้าลืม password: ไปที่ Supabase Dashboard → Settings → Database → Reset password

2. จะถาม **Git branch** (ถ้ามี)
   - กด Enter เพื่อใช้ default

**ผลลัพธ์ที่ต้องการ:**
```
> npx supabase link --project-ref YOUR_PROJECT_REF
Enter your database password: [hidden]
Linked to project YOUR_PROJECT_REF
```

**ถ้ามี Error:**
- `Project not found`: ตรวจสอบ project-ref ว่าถูกต้อง
- `Invalid password`: ตรวจสอบ database password
- `Already linked`: ไม่เป็นไร ใช้ project ที่ link อยู่แล้วได้

---

## 📋 ขั้นตอนที่ 5: Deploy Function

### Deploy function พร้อม config file:

```powershell
npx supabase functions deploy telegram-webhook
```

**สิ่งที่เกิดขึ้น:**
1. CLI จะอ่านไฟล์ `index.ts` และ `supabase.functions.config.json`
2. Package และ upload ไปยัง Supabase
3. Deploy function พร้อม config

**ผลลัพธ์ที่ต้องการ:**
```
> npx supabase functions deploy telegram-webhook
Deploying function telegram-webhook...
Function deployed successfully!
```

**ถ้ามี Error:**
- `Function not found`: ตรวจสอบว่าไฟล์ `index.ts` อยู่ใน `supabase/functions/telegram-webhook/`
- `Config file not found`: ตรวจสอบว่า `supabase.functions.config.json` อยู่ในโฟลเดอร์เดียวกัน

---

## 📋 ขั้นตอนที่ 6: ตรวจสอบการ Deploy

### ตรวจสอบใน Dashboard:

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. ตรวจสอบว่า:
   - ✅ Code ถูก deploy แล้ว
   - ✅ Config ถูกตั้งค่าแล้ว (auth: false)

### ตรวจสอบผ่าน CLI:

```powershell
npx supabase functions list
```

ควรเห็น `telegram-webhook` ในรายการ

---

## 📋 ขั้นตอนที่ 7: ตั้งค่า Environment Variables

ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook** → **Settings** → **Environment Variables**

ตั้งค่า:
- `TELEGRAM_BOT_TOKEN` = `YOUR_TELEGRAM_BOT_TOKEN`

**วิธีหา Telegram Bot Token:**
1. เปิด Telegram และค้นหา `@BotFather`
2. ส่งคำสั่ง `/mybots`
3. เลือก Bot ของคุณ
4. เลือก **API Token**
5. Copy Token (รูปแบบ: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**หมายเหตุ:** Environment Variables ไม่สามารถตั้งค่าผ่าน CLI ได้ ต้องตั้งใน Dashboard

---

## 📋 ขั้นตอนที่ 8: ตั้งค่า Telegram Webhook

หลังจาก Deploy แล้ว ตั้งค่า webhook URL:

### วิธีที่ 1: ใช้ Browser

เปิด URL นี้ใน browser (แทน `<YOUR_BOT_TOKEN>` และ `<YOUR_PROJECT_REF>`):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook
```

**ตัวอย่าง:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://abcdefghijklmnopqrs.supabase.co/functions/v1/telegram-webhook
```

### วิธีที่ 2: ใช้ PowerShell

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

## 📋 ขั้นตอนที่ 9: ตรวจสอบ Webhook Status

### ตรวจสอบว่า webhook ทำงานได้:

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
    "last_error_date": 0,
    "last_error_message": null,  ← ควรเป็น null (ไม่ใช่ "401 Unauthorized")
    "max_connections": 40
  }
}
```

---

## 🔧 Troubleshooting

### ❌ Error: "Cannot use automatic login flow"

**แก้ไข:**
```powershell
# ใช้ token แทน
$env:SUPABASE_ACCESS_TOKEN = "your-token"
npx supabase login --token $env:SUPABASE_ACCESS_TOKEN
```

### ❌ Error: "Project not found"

**แก้ไข:**
- ตรวจสอบ project-ref ว่าถูกต้อง
- หรือใช้: `npx supabase projects list` เพื่อดู project ที่มี
- Project Reference อยู่ใน Supabase Dashboard → Settings → General

### ❌ Error: "Invalid password"

**แก้ไข:**
1. ไปที่ Supabase Dashboard → Settings → Database
2. Reset database password
3. ใช้ password ใหม่ในการ link

### ❌ Error: "Function not found"

**แก้ไข:**
- ตรวจสอบว่าไฟล์ `index.ts` อยู่ใน `supabase/functions/telegram-webhook/`
- ตรวจสอบชื่อ function: `telegram-webhook` (ต้องตรงกับชื่อโฟลเดอร์)

### ❌ Webhook ยังมี `401 Unauthorized`

**แก้ไข:**
1. ตรวจสอบว่า `supabase.functions.config.json` ถูก deploy แล้ว
2. ตรวจสอบว่าใช้ `Deno.serve` ไม่ใช่ `serve`
3. ลอง Deploy ใหม่:
   ```powershell
   npx supabase functions deploy telegram-webhook
   ```

---

## 📝 สรุปคำสั่งทั้งหมด

```powershell
# 1. Login
npx supabase login

# 2. Link Project
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Deploy Function
npx supabase functions deploy telegram-webhook

# 4. ตรวจสอบ
npx supabase functions list
```

---

## ✅ Checklist

- [ ] ตรวจสอบไฟล์ `index.ts` และ `supabase.functions.config.json` มีอยู่
- [ ] Login Supabase CLI สำเร็จ
- [ ] Link project สำเร็จ
- [ ] Deploy function สำเร็จ
- [ ] ตั้งค่า Environment Variables (`TELEGRAM_BOT_TOKEN`)
- [ ] ตั้งค่า Telegram Webhook URL
- [ ] ตรวจสอบ Webhook Status (ไม่มี error)
- [ ] ทดสอบส่งข้อความไปยัง Bot

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว ระบบ Telegram webhook ควรทำงานได้ปกติแล้ว!

**ถ้ามีปัญหา:** ดู Logs ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs

