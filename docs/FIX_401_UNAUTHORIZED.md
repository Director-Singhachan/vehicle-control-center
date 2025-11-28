# แก้ไขปัญหา 401 Unauthorized ใน Telegram Webhook

## 🔍 ปัญหา

เมื่อตั้งค่า Telegram Bot Webhook แล้ว ได้ error:
```json
{
  "last_error_message": "Wrong response from the webhook: 401 Unauthorized"
}
```

## 🎯 สาเหตุ

Supabase Edge Functions ต้องการ authorization header แต่ Telegram webhook **ไม่ส่ง** authorization header มา

## ✅ วิธีแก้ไข

### **แก้ไขโค้ด:**

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. เปิดแท็บ **Code**
3. แก้ไขบรรทัดแรก:

**เปลี่ยนจาก:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
```

**เป็น:**
```typescript
// ลบ import serve ออก (ไม่ต้องใช้)
```

4. แก้ไขบรรทัดที่เรียกใช้ `serve`:

**เปลี่ยนจาก:**
```typescript
serve(async (req) => {
```

**เป็น:**
```typescript
Deno.serve(async (req) => {
```

5. **Deploy Function ใหม่**

---

## 📝 สรุปการแก้ไข

**เปลี่ยน:**
- `import { serve }` → ลบออก
- `serve(async (req) => {` → `Deno.serve(async (req) => {`

**เหตุผล:**
- `Deno.serve` เป็น native Deno API ที่ไม่ต้องการ authorization header
- เหมาะสำหรับ webhook จาก external services (เช่น Telegram)

---

## 🧪 ทดสอบหลังแก้ไข

1. **Deploy Function ใหม่**
2. **ส่งข้อความไปยัง Bot** (เช่น `/start`)
3. **ตรวจสอบ Logs** ใน Supabase Dashboard → Edge Functions → telegram-webhook → Logs
4. **ตรวจสอบ Webhook Info** อีกครั้ง:

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
    "last_error_message": null
  }
}
```

**ถ้า `"last_error_message": null` = แก้ไขสำเร็จ! ✅**

---

## ⚠️ หมายเหตุ

- Linter errors ใน local environment เป็นเรื่องปกติ (TypeScript ไม่รู้จัก Deno types)
- ใน Supabase Edge Functions runtime จะทำงานได้ปกติ
- หลังจากแก้ไขแล้ว ต้อง Deploy Function ใหม่

