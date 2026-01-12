# แก้ไขปัญหา 401 Unauthorized สำหรับ Telegram Webhook

## ปัญหา
Telegram webhook ยังคงได้รับ error `401 Unauthorized` แม้ว่าจะเปลี่ยนเป็น `Deno.serve` แล้ว

## สาเหตุ
Supabase Edge Functions ต้องการ JWT authorization header โดยค่าเริ่มต้น แต่ Telegram webhook ไม่สามารถส่ง header นี้ได้

## วิธีแก้ไข

### วิธีที่ 1: ใช้ Supabase CLI (แนะนำ)

1. **ติดตั้ง Supabase CLI** (ถ้ายังไม่มี):
   ```bash
   npm install -g supabase@latest
   ```

2. **Login และ Link Project**:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Deploy Function พร้อม Config**:
   ```bash
   cd supabase/functions/telegram-webhook
   supabase functions deploy telegram-webhook
   ```

   ไฟล์ `supabase.functions.config.json` จะถูก deploy อัตโนมัติ

4. **ทดสอบ Webhook**:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```

### วิธีที่ 2: อัปโหลดไฟล์ Config ผ่าน Dashboard

1. ไปที่ **Supabase Dashboard** → **Edge Functions** → **telegram-webhook**
2. เปิดแท็บ **Code**
3. ดูว่ามีตัวเลือก **Upload Files** หรือ **Config** หรือไม่
4. ถ้ามี ให้อัปโหลดไฟล์ `supabase.functions.config.json` ที่มีเนื้อหา:
   ```json
   {
     "auth": false
   }
   ```

### วิธีที่ 3: ใช้ Anon Key ใน URL (Workaround)

ถ้าไม่สามารถใช้ config file ได้ ให้แก้ไข webhook URL เป็น:

```
https://oqacrkcfpdhcntbldgrm.supabase.co/functions/v1/telegram-webhook?apikey=<YOUR_ANON_KEY>
```

**หมายเหตุ:** วิธีนี้ไม่แนะนำเพราะ anon key จะถูก expose ใน webhook URL

---

## ไฟล์ที่สร้างแล้ว

✅ `supabase/functions/telegram-webhook/supabase.functions.config.json`
- ตั้งค่า `auth: false` เพื่อปิดการตรวจสอบ JWT

✅ `supabase/functions/telegram-webhook/index.ts`
- ใช้ `Deno.serve` แทน `serve`
- ใช้ `SUPABASE_SERVICE_ROLE_KEY` เพื่อ bypass RLS

---

## ตรวจสอบผลลัพธ์

หลังจาก deploy แล้ว ตรวจสอบ webhook info:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
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

## หมายเหตุ

- ไฟล์ `supabase.functions.config.json` ต้องอยู่ในโฟลเดอร์เดียวกับ `index.ts`
- หลังจาก deploy แล้ว ต้องรอสักครู่เพื่อให้การตั้งค่าใหม่มีผล
- ถ้ายังมี error อยู่ ให้ตรวจสอบว่า:
  1. ไฟล์ config ถูก deploy แล้ว
  2. Function ถูก redeploy แล้ว
  3. Webhook URL ถูกต้อง

