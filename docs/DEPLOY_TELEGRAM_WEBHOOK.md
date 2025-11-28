# คู่มือ Deploy Telegram Webhook Function

## ขั้นตอนที่ 1: Login Supabase CLI

เปิด PowerShell หรือ Terminal แล้วรัน:

```bash
npx supabase login
```

จะเปิด browser ให้ login และ authorize

---

## ขั้นตอนที่ 2: Link Project

หลังจาก login แล้ว รัน:

```bash
cd C:\Users\pepsi\projects\vehicle-control-center
npx supabase link --project-ref oqacrkcfpdhcntbldgrm
```

จะถาม password (Database password) - ใส่ password ที่ตั้งไว้ตอนสร้าง project

---

## ขั้นตอนที่ 3: Deploy Function

```bash
npx supabase functions deploy telegram-webhook
```

จะ deploy function พร้อมไฟล์ `supabase.functions.config.json` อัตโนมัติ

---

## ขั้นตอนที่ 4: ตรวจสอบผลลัพธ์

หลังจาก deploy แล้ว ทดสอบ webhook:

```
https://api.telegram.org/bot7656958369:AAFbWIRZwTbLTUf2WFZXTU9EZRCcw3IGnhk/getWebhookInfo
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

- ไฟล์ `supabase.functions.config.json` จะถูก deploy อัตโนมัติ
- Function จะมี `auth: false` ทำให้ Telegram webhook เรียกได้โดยไม่ต้องมี JWT
- หลังจาก deploy แล้ว รอสักครู่เพื่อให้การตั้งค่าใหม่มีผล

---

## ถ้ามีปัญหา

### Error: "Cannot use automatic login flow"
- ใช้ `npx supabase login --token <YOUR_ACCESS_TOKEN>`
- หรือเปิด browser แล้ว login ผ่าน URL ที่แสดง

### Error: "Project not found"
- ตรวจสอบ project-ref ว่าถูกต้อง: `oqacrkcfpdhcntbldgrm`
- หรือใช้ `npx supabase projects list` เพื่อดู project ที่มี

### Error: "Function not found"
- ตรวจสอบว่าไฟล์ `index.ts` อยู่ใน `supabase/functions/telegram-webhook/`
- ตรวจสอบว่าไฟล์ `supabase.functions.config.json` อยู่ในโฟลเดอร์เดียวกัน

