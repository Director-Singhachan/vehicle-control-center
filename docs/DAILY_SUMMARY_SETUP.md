# 📊 การตั้งค่าสรุปการใช้รถรายวัน (Daily Summary)

ระบบจะส่งสรุปการใช้รถรายวันไปยัง Telegram แยกตามสาขาอัตโนมัติทุกวัน

## 🎯 ฟีเจอร์

- สรุปการใช้รถรายวัน
- แสดงจำนวนรถที่ใช้งาน
- แสดงจำนวนทริปทั้งหมด
- แสดงระยะทางรวม (กิโลเมตร)
- แสดงรายละเอียดตามรถ (ทะเบียน, จำนวนทริป, ระยะทาง)

## 📋 ข้อมูลที่แสดง

### ภาพรวม
- จำนวนรถที่ใช้งาน
- จำนวนทริปทั้งหมด
- ระยะทางรวม

### รายละเอียดตามรถ
- ทะเบียนรถ (พร้อมยี่ห้อ/รุ่นถ้ามี)
- จำนวนทริป
- ระยะทางรวม (กิโลเมตร)

## ⚙️ การตั้งค่า

### 1. Environment Variables

ตั้งค่าใน Supabase Dashboard → Edge Functions → daily-summary-worker:

- `TELEGRAM_BOT_TOKEN` - Token จาก BotFather
- `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID_<BRANCH>` - Chat ID ของกลุ่ม Telegram ต่อสาขา เช่น `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID_HQ`, `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID_SD`, `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID_ASIA`
- `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID` - ค่า fallback ถ้ายังไม่ได้ตั้งแยกตามสาขา
- `TELEGRAM_MAINTENANCE_GROUP_CHAT_ID` - ค่า fallback เดิม (รองรับของเก่า)

หมายเหตุ:
- worker จะพยายามหาห้องแชตตามสาขาของรถก่อน แล้วค่อย fallback ไปค่ากลาง
- ฝั่งแจ้งเตือนการใช้รถจาก `notification-worker` ใช้ชื่อ environment แบบเดียวกัน

### 2. การเรียกใช้

#### วิธีที่ 1: เรียกด้วยตนเอง (Manual)

```bash
# สรุปของเมื่อวาน (default)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# สรุปของวันที่กำหนด
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker?date=2025-01-15" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### วิธีที่ 2: ตั้งค่า Cron Job (แนะนำ)

ใช้ Supabase Cron Jobs หรือ external service เช่น:
- **GitHub Actions** (ฟรี)
- **Vercel Cron** (ฟรี)
- **Supabase Cron** (ถ้ามี)

##### ตัวอย่าง: GitHub Actions

สร้างไฟล์ `.github/workflows/daily-summary.yml`:

```yaml
name: Daily Summary

on:
  schedule:
    # รันทุกวันเวลา 00:00 UTC (07:00 เวลาไทย)
    - cron: '0 0 * * *'
  workflow_dispatch: # อนุญาตให้เรียกด้วยตนเอง

jobs:
  send-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Call Daily Summary Worker
        run: |
          curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
        env:
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

##### ตัวอย่าง: Vercel Cron

สร้างไฟล์ `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-summary",
      "schedule": "0 0 * * *"
    }
  ]
}
```

สร้างไฟล์ `api/daily-summary.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    'https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const data = await response.json();
  res.json(data);
}
```

## 📝 ตัวอย่างข้อความที่ส่ง

```
📊 สรุปการใช้รถรายวัน

📅 วันที่: วันจันทร์ที่ 15 มกราคม 2568

📈 ภาพรวม:
🚗 จำนวนรถที่ใช้งาน: 5 คัน
🔄 จำนวนทริปทั้งหมด: 12 ทริป
📏 ระยะทางรวม: 1,234.56 กิโลเมตร

🚙 รายละเอียดตามรถ:

🚗 กข 1234 (Toyota Camry)
   🔄 3 ทริป
   📏 450.25 กิโลเมตร

🚗 คง 5678 (Honda Civic)
   🔄 2 ทริป
   📏 320.10 กิโลเมตร

...
```

## 🔍 การทดสอบ

### ทดสอบด้วยตนเอง

```bash
# สรุปของเมื่อวาน
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# สรุปของวันที่กำหนด
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/daily-summary-worker?date=2025-01-15" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### ตรวจสอบ Logs

ดู logs ใน Supabase Dashboard → Edge Functions → daily-summary-worker → Logs

## ⚠️ หมายเหตุ

- ระบบจะสรุปทริปที่ **check-in แล้ว** ในวันที่กำหนด
- ใช้ `checkout_time` เป็นเกณฑ์ (เพราะทริปอาจ check-in ในวันถัดไป)
- ถ้าไม่มีทริปในวันนั้น จะไม่ส่งข้อความ
- ระยะทางคำนวณจาก `odometer_end - odometer_start`

## 🛠️ Troubleshooting

### ไม่ได้รับข้อความ

1. ตรวจสอบ `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_MAINTENANCE_GROUP_CHAT_ID`
2. ตรวจสอบว่า Bot อยู่ในกลุ่มและมีสิทธิ์ส่งข้อความ
3. ตรวจสอบ Logs ใน Supabase Dashboard

### ข้อมูลไม่ถูกต้อง

1. ตรวจสอบว่า trip_logs มีข้อมูลในวันที่กำหนด
2. ตรวจสอบว่า status = 'checked_in'
3. ตรวจสอบว่า odometer_start และ odometer_end ถูกต้อง

