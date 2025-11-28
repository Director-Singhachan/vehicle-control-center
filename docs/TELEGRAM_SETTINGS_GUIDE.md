# คู่มือตั้งค่า Telegram ใน Settings

## 📋 คำถาม: ต้องใส่ Telegram Bot Token ใน Settings ไหม?

### ✅ คำตอบสั้นๆ

**ไม่จำเป็น** ถ้าใช้ Token เดียวกันกับระบบ (แนะนำ)  
**จำเป็น** ถ้าต้องการใช้ Token ต่างกัน

---

## 🎯 วิธีตั้งค่า 2 แบบ

### **แบบที่ 1: ใช้ Token เดียวกัน (แนะนำ) ✅**

**ตั้งค่า:**
- **Telegram Bot Token**: **เว้นว่างไว้** (ไม่ต้องใส่)
- **Telegram Chat ID**: **ต้องใส่** (Chat ID ของคุณ/กลุ่ม)

**ระบบจะทำงาน:**
1. ระบบจะใช้ Token จาก Environment Variable (`TELEGRAM_BOT_TOKEN`)
2. ส่งข้อความไปที่ Chat ID ที่คุณตั้งไว้

**ข้อดี:**
- จัดการง่าย (ตั้ง Token ครั้งเดียวใน Environment Variable)
- แต่ละคนแค่ตั้ง Chat ID ของตัวเอง
- ใช้ Bot เดียวกันทั้งหมด

**ตัวอย่าง:**
```
User A (Inspector):
  Telegram Bot Token: (เว้นว่าง)
  Telegram Chat ID: 123456789

User B (Manager):
  Telegram Bot Token: (เว้นว่าง)
  Telegram Chat ID: 987654321

Group:
  Telegram Bot Token: (เว้นว่าง)
  Telegram Chat ID: -1001234567890
```

---

### **แบบที่ 2: ใช้ Token ต่างกัน (ขั้นสูง)**

**ตั้งค่า:**
- **Telegram Bot Token**: **ใส่ Token ของคุณ**
- **Telegram Chat ID**: **ต้องใส่** (Chat ID ของคุณ/กลุ่ม)

**ระบบจะทำงาน:**
1. ระบบจะใช้ Token ที่คุณตั้งไว้ใน Settings
2. ส่งข้อความไปที่ Chat ID ที่คุณตั้งไว้

**ข้อดี:**
- แต่ละคนใช้ Bot ของตัวเองได้
- ยืดหยุ่นกว่า

**ข้อเสีย:**
- ต้องตั้ง webhook หลายตัว (ถ้าต้องการรับ PDF กลับมา)
- จัดการซับซ้อนกว่า

**ตัวอย่าง:**
```
User A (Inspector):
  Telegram Bot Token: 111111111:TokenA
  Telegram Chat ID: 123456789

User B (Manager):
  Telegram Bot Token: 222222222:TokenB
  Telegram Chat ID: 987654321
```

---

## 📝 สรุปการตั้งค่า

### **สิ่งที่ต้องทำ:**

1. **ตั้ง `TELEGRAM_BOT_TOKEN` ใน Environment Variable** (1 ครั้ง)
   - ไปที่ Supabase Dashboard → Edge Functions → Environment Variables
   - ตั้ง `TELEGRAM_BOT_TOKEN` = Token จาก BotFather

2. **แต่ละ User ตั้งค่าใน Settings:**
   - **Telegram Bot Token**: **เว้นว่าง** (ถ้าใช้ Token เดียวกัน) หรือ **ใส่ Token** (ถ้าต้องการใช้ Token ต่างกัน)
   - **Telegram Chat ID**: **ต้องใส่** (Chat ID ของคุณ/กลุ่ม)

---

## 🔍 วิธีหา Chat ID

### **สำหรับ Personal Chat:**
1. เปิด Telegram → ค้นหา `@userinfobot` หรือ `@getidsbot`
2. ส่งคำสั่ง `/start`
3. Bot จะส่ง Chat ID มาให้ (ตัวเลข เช่น `123456789`)

### **สำหรับ Group:**
1. เพิ่ม Bot เข้าไปในกลุ่ม
2. ส่งข้อความในกลุ่ม
3. เปิด: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. หา `"chat":{"id":-1001234567890}` (ตัวเลขติดลบ = กลุ่ม)

---

## ✅ Checklist

- [ ] ตั้ง `TELEGRAM_BOT_TOKEN` ใน Environment Variable (1 ครั้ง)
- [ ] แต่ละ User ตั้ง `telegram_chat_id` ใน Settings (จำเป็น)
- [ ] แต่ละ User ตั้ง `telegram_bot_token` ใน Settings (ไม่จำเป็น ถ้าใช้ Token เดียวกัน)

---

## 💡 คำแนะนำ

**สำหรับการใช้งานทั่วไป:**
- ใช้ **Token เดียวกัน** (เว้นว่าง `telegram_bot_token` ใน Settings)
- แต่ละคนตั้ง **Chat ID ของตัวเอง** เท่านั้น

**สำหรับการใช้งานขั้นสูง:**
- แต่ละคนใช้ **Token ของตัวเอง** (ใส่ `telegram_bot_token` ใน Settings)
- แต่ละคนตั้ง **Chat ID ของตัวเอง**

