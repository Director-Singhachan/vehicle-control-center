# คู่มือตั้งค่า Telegram Bot Webhook

## 🎯 วัตถุประสงค์

ตั้งค่า Webhook เพื่อให้ Telegram ส่งข้อมูล (ข้อความ, ไฟล์ PDF) มาที่ Edge Function `telegram-webhook` ของเรา

---

## 📋 ขั้นตอนการตั้งค่า

### **ขั้นตอนที่ 1: หา Function URL**

1. ไปที่ **Supabase Dashboard** → **Edge Functions**
2. คลิกที่ function **telegram-webhook**
3. Copy **Function URL** (จะอยู่ด้านบน หรือในแท็บ Details)
   - รูปแบบ: `https://<YOUR_PROJECT>.supabase.co/functions/v1/telegram-webhook`
   - ตัวอย่าง: `https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook`

---

### **ขั้นตอนที่ 2: หา Telegram Bot Token**

1. เปิด Telegram (มือถือหรือ Desktop)
2. ค้นหา `@BotFather`
3. ส่งคำสั่ง `/mybots` (ถ้ามี bot อยู่แล้ว) หรือ `/newbot` (ถ้ายังไม่มี)
4. เลือก bot ที่ต้องการ
5. เลือก **API Token** หรือ **Token**
6. Copy **Token** ที่ได้
   - รูปแบบ: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

---

### **ขั้นตอนที่ 3: ตั้งค่า Webhook**

มี 3 วิธีให้เลือก:

#### **วิธีที่ 1: ใช้ Browser (ง่ายที่สุด) ✅**

1. เปิด Browser (Chrome, Edge, Firefox)
2. เปิด URL นี้ (แทน `<YOUR_BOT_TOKEN>` และ `<YOUR_FUNCTION_URL>`):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_FUNCTION_URL>
```

**ตัวอย่าง:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook
```

3. กด Enter
4. ควรเห็นข้อความ:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

#### **วิธีที่ 2: ใช้ curl (Terminal/Command Prompt)**

**Windows (PowerShell):**
```powershell
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" `
  -H "Content-Type: application/json" `
  -d '{\"url\": \"<YOUR_FUNCTION_URL>\"}'
```

**Windows (CMD):**
```cmd
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"<YOUR_FUNCTION_URL>\"}"
```

**Mac/Linux:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<YOUR_FUNCTION_URL>"}'
```

**ตัวอย่าง:**
```bash
curl -X POST "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook"}'
```

---

#### **วิธีที่ 3: ใช้ Postman หรือ HTTP Client**

1. เปิด Postman หรือ HTTP Client อื่น
2. สร้าง **POST** request
3. URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook`
4. Headers:
   - `Content-Type: application/json`
5. Body (JSON):
```json
{
  "url": "https://<YOUR_PROJECT>.supabase.co/functions/v1/telegram-webhook"
}
```
6. กด Send

---

### **ขั้นตอนที่ 4: ตรวจสอบว่า Webhook ตั้งค่าสำเร็จ**

เปิด URL นี้ใน Browser (แทน `<YOUR_BOT_TOKEN>`):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**ตัวอย่าง:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getWebhookInfo
```

**ผลลัพธ์ที่ควรเห็น:**
```json
{
  "ok": true,
  "result": {
    "url": "https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**ถ้าเห็น `"url": "..."` ตรงกับ Function URL ของคุณ = สำเร็จ! ✅**

---

## 🧪 ทดสอบ Webhook

### **ทดสอบการรับข้อความ:**

1. เปิด Telegram
2. ค้นหา Bot ของคุณ (ชื่อที่ตั้งไว้ใน BotFather)
3. ส่งข้อความ `/start` หรือ `help`
4. Bot ควรตอบกลับ (ถ้า webhook ทำงาน)

### **ทดสอบการรับ PDF:**

1. ส่ง PDF ไปยัง Bot
2. พร้อมระบุเลขที่ตั๋ว เช่น: `"Ticket #2501-001"`
3. Bot ควรตอบกลับว่า "✅ อัปโหลด PDF ที่เซ็นแล้วสำเร็จ!"

---

## 🔍 แก้ไขปัญหา

### **ปัญหา: Webhook ไม่ทำงาน**

**ตรวจสอบ:**
1. Function URL ถูกต้องหรือไม่
2. Bot Token ถูกต้องหรือไม่
3. Function `telegram-webhook` Deploy แล้วหรือยัง
4. ดู Logs ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs

### **ปัญหา: Bot ไม่ตอบกลับ**

**ตรวจสอบ:**
1. ดู Logs ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs
2. ตรวจสอบว่า `TELEGRAM_BOT_TOKEN` ใน Environment Variables ถูกต้อง
3. ตรวจสอบว่า user มี `telegram_chat_id` ใน `notification_settings` หรือไม่

### **ปัญหา: Error 404 หรือ 500**

**ตรวจสอบ:**
1. Function URL ถูกต้องหรือไม่
2. Function Deploy แล้วหรือยัง
3. ดู Logs ใน Supabase Dashboard

---

## 📝 Checklist

- [ ] หา Function URL จาก Supabase Dashboard
- [ ] หา Bot Token จาก BotFather
- [ ] ตั้งค่า Webhook (ใช้วิธีใดวิธีหนึ่ง)
- [ ] ตรวจสอบว่า Webhook ตั้งค่าสำเร็จ (`getWebhookInfo`)
- [ ] ทดสอบส่งข้อความไปยัง Bot
- [ ] ทดสอบส่ง PDF ไปยัง Bot

---

## 💡 หมายเหตุ

- **Webhook ตั้งค่าครั้งเดียว** - ไม่ต้องตั้งใหม่ทุกครั้ง
- **ถ้า Deploy Function ใหม่** - Webhook ยังใช้งานได้ (URL เดิม)
- **ถ้าเปลี่ยน Function URL** - ต้องตั้ง Webhook ใหม่

---

## 🎯 สรุป

**ขั้นตอนสั้นๆ:**
1. Copy Function URL จาก Supabase
2. Copy Bot Token จาก BotFather
3. เปิด URL นี้ใน Browser:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNCTION_URL>
   ```
4. ตรวจสอบด้วย `getWebhookInfo`
5. ทดสอบส่งข้อความไปยัง Bot

**เสร็จแล้ว! 🎉**

