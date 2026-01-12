# วิธีตั้งค่า Telegram Bot Webhook (แบบละเอียด)

## 🎯 สิ่งที่ต้องมีก่อนเริ่ม

1. ✅ Function URL จาก Supabase (เช่น: `https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook`)
2. ✅ Bot Token จาก BotFather (เช่น: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

---

## 📝 ขั้นตอนที่ 3: ตั้งค่า Webhook (แบบละเอียด)

### **วิธีที่ 1: ใช้ Browser (แนะนำ - ง่ายที่สุด)**

#### **ขั้นตอน:**

1. **เปิด Browser** (Chrome, Edge, Firefox - อะไรก็ได้)

2. **คลิกที่ Address Bar** (ช่องพิมพ์ URL ด้านบน)

3. **พิมพ์ URL นี้** (แทนค่าด้วยข้อมูลจริงของคุณ):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_FUNCTION_URL>
```

**ตัวอย่างจริง:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook
```

**หมายเหตุ:**
- แทน `<YOUR_BOT_TOKEN>` ด้วย Token จาก BotFather
- แทน `<YOUR_FUNCTION_URL>` ด้วย Function URL จาก Supabase
- **อย่าลืมลบ `<` และ `>` ออกด้วย!**

4. **กด Enter** หรือคลิก Go

5. **ดูผลลัพธ์** - ควรเห็นหน้าข้อความ JSON แบบนี้:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

**ถ้าเห็น `"ok": true` = สำเร็จ! ✅**

---

### **ตัวอย่างการแทนค่า:**

**สมมติว่า:**
- Bot Token ของคุณ: `987654321:XYZabcDEFghiJKLmnoPQRstuVWX`
- Function URL ของคุณ: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook`

**วิธีหา Project Reference:**
1. ไปที่ Supabase Dashboard → Settings → General
2. Copy **Reference ID**

**URL ที่ต้องพิมพ์:**
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/telegram-webhook
```

**Copy URL นี้ไปวางใน Browser แล้วกด Enter**

---

### **วิธีที่ 2: ใช้ PowerShell (Windows)**

1. **เปิด PowerShell** (กด Windows + X → เลือก Windows PowerShell)

2. **พิมพ์คำสั่งนี้** (แทนค่าด้วยข้อมูลจริง):

```powershell
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"<YOUR_FUNCTION_URL>\"}"
```

**ตัวอย่างจริง:**
```powershell
curl -X POST "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://abcdefghijklmnop.supabase.co/functions/v1/telegram-webhook\"}"
```

3. **กด Enter**

4. **ดูผลลัพธ์** - ควรเห็น:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## 🔍 ตรวจสอบว่า Webhook ตั้งค่าสำเร็จ

### **วิธีตรวจสอบ:**

1. **เปิด Browser**

2. **พิมพ์ URL นี้** (แทน `<YOUR_BOT_TOKEN>`):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**ตัวอย่าง:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getWebhookInfo
```

3. **กด Enter**

4. **ดูผลลัพธ์** - ควรเห็น:

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

## 🧪 ทดสอบว่า Webhook ทำงาน

1. **เปิด Telegram**

2. **ค้นหา Bot ของคุณ** (ชื่อที่ตั้งไว้ใน BotFather)

3. **ส่งข้อความ** `/start` หรือ `help`

4. **Bot ควรตอบกลับ** (ถ้า webhook ทำงาน)

**ถ้า Bot ไม่ตอบกลับ:**
- ตรวจสอบ Logs ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs
- ตรวจสอบว่า `TELEGRAM_BOT_TOKEN` ใน Environment Variables ถูกต้อง

---

## ❓ คำถามที่พบบ่อย

### **Q: ต้องใส่ `<` และ `>` ด้วยไหม?**
**A:** ไม่ต้อง! ลบออกแล้วใส่ค่าจริงแทน

### **Q: URL ยาวมาก พิมพ์ผิดพลาดง่าย ทำยังไง?**
**A:** 
1. Copy Function URL จาก Supabase ไปวาง
2. Copy Bot Token จาก BotFather ไปวาง
3. ใช้วิธี Browser (วิธีที่ 1) จะง่ายที่สุด

### **Q: ได้ error "Bad Request" หรือ "Unauthorized"**
**A:**
- ตรวจสอบว่า Bot Token ถูกต้อง
- ตรวจสอบว่า Function URL ถูกต้อง
- ตรวจสอบว่าไม่มี space หรือตัวอักษรพิเศษ

### **Q: ได้ error "Webhook was set" แต่ Bot ไม่ตอบกลับ**
**A:**
- ตรวจสอบ Logs ใน Supabase Dashboard
- ตรวจสอบว่า `TELEGRAM_BOT_TOKEN` ใน Environment Variables ถูกต้อง
- ตรวจสอบว่า Function Deploy แล้ว

---

## 📝 Checklist

- [ ] Copy Function URL จาก Supabase
- [ ] Copy Bot Token จาก BotFather
- [ ] เปิด Browser → พิมพ์ URL ตามตัวอย่าง
- [ ] ตรวจสอบผลลัพธ์ว่า `"ok": true`
- [ ] ตรวจสอบด้วย `getWebhookInfo`
- [ ] ทดสอบส่งข้อความไปยัง Bot

---

## 🎯 สรุปแบบสั้นๆ

**3 ขั้นตอน:**
1. Copy Function URL และ Bot Token
2. เปิด Browser → พิมพ์ URL: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FUNCTION_URL>`
3. ตรวจสอบด้วย `getWebhookInfo`

**เสร็จแล้ว! 🎉**

