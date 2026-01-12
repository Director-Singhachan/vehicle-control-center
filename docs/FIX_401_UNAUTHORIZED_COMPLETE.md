# แก้ไขปัญหา 401 Unauthorized ใน Telegram Webhook (วิธีที่ถูกต้อง)

## 🔍 ปัญหา

เมื่อตั้งค่า Telegram Bot Webhook แล้ว ได้ error:
```json
{
  "last_error_message": "Wrong response from the webhook: 401 Unauthorized"
}
```

## 🎯 สาเหตุ

Supabase Edge Functions **ต้องการ JWT authorization header** โดยค่าเริ่มต้น แต่ Telegram webhook **ไม่ส่ง** authorization header มา

## ✅ วิธีแก้ไข (เลือก 1 วิธี)

### **วิธีที่ 1: ปิดการตรวจสอบ JWT (ง่ายที่สุด) ✅**

1. ไปที่ **Supabase Dashboard** → **Edge Functions**
2. คลิกที่ function **telegram-webhook**
3. เปิดแท็บ **Settings** หรือ **Details**
4. หาส่วน **"Verify JWT"** หรือ **"JWT Verification"** หรือ **"Require Authorization"**
5. **ปิด/Disable** การตรวจสอบ JWT
6. **Save** หรือ **Deploy** ใหม่

**หมายเหตุ:** 
- ใน Supabase Dashboard อาจจะอยู่ใน Settings → Security หรือ Details → Configuration
- ถ้าหาไม่เจอ อาจจะต้องดูใน Project Settings → Edge Functions

---

### **วิธีที่ 2: ใช้ Secret Token (ปลอดภัยกว่า)**

#### **ขั้นตอนที่ 1: ตั้งค่า Secret Token ใน Environment Variable**

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. เปิดแท็บ **Settings** หรือ **Environment Variables**
3. เพิ่ม Environment Variable:
   - **Name**: `TELEGRAM_SECRET_TOKEN`
   - **Value**: สร้าง random string (เช่น: `my-secret-token-12345`)

#### **ขั้นตอนที่ 2: ตั้งค่า Webhook พร้อม Secret Token**

ตั้งค่า Webhook ใหม่พร้อม secret token:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_FUNCTION_URL>&secret_token=<YOUR_SECRET_TOKEN>
```

**ตัวอย่าง:**
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook&secret_token=<YOUR_SECRET_TOKEN>
```

#### **ขั้นตอนที่ 3: Deploy Function ใหม่**

โค้ดจะตรวจสอบ secret token อัตโนมัติ

---

## 🎯 แนะนำ

**ใช้วิธีที่ 1 (ปิด JWT)** ถ้าต้องการแก้ไขเร็ว  
**ใช้วิธีที่ 2 (Secret Token)** ถ้าต้องการความปลอดภัยเพิ่ม

---

## 🧪 ทดสอบหลังแก้ไข

1. **Deploy Function ใหม่** (ถ้าใช้วิธีที่ 2)
2. **ส่งข้อความไปยัง Bot** (เช่น `/start`)
3. **ตรวจสอบ Webhook Info:**

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

ควรเห็น:
```json
{
  "ok": true,
  "result": {
    "url": "...",
    "pending_update_count": 0,
    "last_error_message": null  ← ควรเป็น null
  }
}
```

---

## 📝 Checklist

- [ ] ปิด JWT Verification ใน Supabase Dashboard (วิธีที่ 1)
- [ ] หรือตั้งค่า Secret Token และ Deploy Function ใหม่ (วิธีที่ 2)
- [ ] ทดสอบส่งข้อความไปยัง Bot
- [ ] ตรวจสอบ Webhook Info อีกครั้ง

