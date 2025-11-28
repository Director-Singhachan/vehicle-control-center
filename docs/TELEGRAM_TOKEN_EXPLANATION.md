# คำอธิบาย: ระบบใช้ Telegram Token อย่างไร?

## 🎯 หลักการทำงาน

ระบบใช้ **Token เดียวกัน** สำหรับ Bot ทั้งหมด แต่ใช้ **Chat ID ต่างกัน** สำหรับแต่ละคน/กลุ่ม

## 📋 โครงสร้างการทำงาน

### 1. **Telegram Bot Token** (Token เดียว)
- **ใช้สำหรับ:** Bot ทั้งหมด (ส่งข้อความ, รับ webhook)
- **ตั้งค่า:** Environment Variable `TELEGRAM_BOT_TOKEN` ใน Edge Function
- **หรือ:** ตั้งใน `notification_settings.telegram_bot_token` (ถ้าแต่ละ user ใช้ token ต่างกัน)

### 2. **Telegram Chat ID** (ต่างกันตามคน/กลุ่ม)
- **ใช้สำหรับ:** ระบุว่าจะส่งข้อความไปที่ไหน
- **ตั้งค่า:** ใน `notification_settings.telegram_chat_id` ของแต่ละ user
- **ตัวอย่าง:**
  - User A (Inspector): Chat ID = `123456789` (ส่งไปที่ Inspector)
  - User B (Manager): Chat ID = `987654321` (ส่งไปที่ Manager)
  - Group: Chat ID = `-1001234567890` (ส่งไปที่กลุ่ม)

## 🔄 วิธีการทำงาน

### **notification-worker** (ส่งข้อความออก)
```
1. รับ notification event
2. ดูว่า target_user_id เป็นใคร
3. ดึง notification_settings ของ user นั้น
4. ใช้ telegram_bot_token จาก settings (หรือ fallback ไปที่ Environment Variable)
5. ใช้ telegram_chat_id จาก settings
6. ส่งข้อความไปที่ chat_id นั้น
```

### **telegram-webhook** (รับข้อความเข้า)
```
1. รับ webhook จาก Telegram
2. ใช้ telegram_bot_token จาก Environment Variable (หรือจาก database)
3. ดูว่า chat_id เป็นของใคร (จาก notification_settings)
4. ดึงข้อมูล user และ role
5. อัปโหลด PDF และอัปเดต signature URL
```

## 💡 คำตอบสำหรับคำถาม

**Q: ถ้าเพิ่ม token ใหม่เข้าไป ระบบจะรู้ได้ยังไงว่า token นี้ใช้สำหรับอะไร?**

**A:** ระบบจะใช้ token ตามลำดับนี้:

1. **สำหรับ notification-worker (ส่งออก):**
   - ใช้ `notification_settings.telegram_bot_token` ของแต่ละ user **ก่อน**
   - ถ้าไม่มี → ใช้ `TELEGRAM_BOT_TOKEN` จาก Environment Variable

2. **สำหรับ telegram-webhook (รับเข้า):**
   - ใช้ `TELEGRAM_BOT_TOKEN` จาก Environment Variable **ก่อน**
   - ถ้าไม่มี → ดึงจาก `notification_settings` ของ user ใดๆ ที่มี token

## 🎯 แนะนำการตั้งค่า

### **วิธีที่ 1: ใช้ Token เดียว (แนะนำ)**
```
✅ ตั้ง TELEGRAM_BOT_TOKEN ใน Environment Variable (1 token)
✅ แต่ละ user ตั้ง telegram_chat_id ของตัวเอง (ต่างกัน)
✅ ระบบจะส่งข้อความไปที่ chat_id ตามที่ตั้งไว้
```

**ข้อดี:**
- จัดการง่าย
- ใช้ Bot เดียว
- แต่ละคนได้ข้อความไปที่ Chat ID ของตัวเอง

### **วิธีที่ 2: ใช้ Token หลายตัว (ขั้นสูง)**
```
✅ แต่ละ user ตั้ง telegram_bot_token ของตัวเอง
✅ แต่ละ user ตั้ง telegram_chat_id ของตัวเอง
✅ ระบบจะใช้ token และ chat_id ของแต่ละ user
```

**ข้อดี:**
- แต่ละ user ใช้ Bot ของตัวเองได้
- ยืดหยุ่นกว่า

**ข้อเสีย:**
- ต้องตั้ง webhook หลายตัว (ถ้าต้องการรับ PDF กลับมา)
- จัดการซับซ้อนกว่า

## 📝 ตัวอย่างการตั้งค่า

### **Scenario 1: ใช้ Token เดียว + Chat ID ต่างกัน**

**Environment Variable:**
```
TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
```

**notification_settings:**
```
User A (Inspector):
  telegram_bot_token = null (ใช้จาก Environment)
  telegram_chat_id = "123456789" (Chat ID ของ Inspector)

User B (Manager):
  telegram_bot_token = null (ใช้จาก Environment)
  telegram_chat_id = "987654321" (Chat ID ของ Manager)

Group:
  telegram_bot_token = null (ใช้จาก Environment)
  telegram_chat_id = "-1001234567890" (Chat ID ของกลุ่ม)
```

### **Scenario 2: ใช้ Token หลายตัว**

**notification_settings:**
```
User A (Inspector):
  telegram_bot_token = "111111111:TokenA"
  telegram_chat_id = "123456789"

User B (Manager):
  telegram_bot_token = "222222222:TokenB"
  telegram_chat_id = "987654321"
```

## ✅ สรุป

**คำตอบสั้นๆ:**
- ใช้ **Token เดียว** สำหรับ Bot ทั้งหมด
- ใช้ **Chat ID ต่างกัน** สำหรับแต่ละคน/กลุ่ม
- ตั้ง `TELEGRAM_BOT_TOKEN` ใน Environment Variable **1 ครั้ง**
- แต่ละ user ตั้ง `telegram_chat_id` ของตัวเองใน Settings

**ระบบจะรู้ว่า:**
- Token ไหนใช้สำหรับ Bot (จาก Environment Variable)
- Chat ID ไหนส่งไปที่ใคร (จาก notification_settings ของแต่ละ user)

