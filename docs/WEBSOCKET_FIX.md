# 🔧 แก้ไขปัญหา WebSocket Connection Error

## สาเหตุของปัญหา

Vite ใช้ WebSocket สำหรับ Hot Module Replacement (HMR) ซึ่งทำให้:
- แก้ไขโค้ดแล้วหน้าเว็บอัปเดตอัตโนมัติ
- ไม่ต้อง refresh หน้าเว็บเอง

แต่บางครั้ง WebSocket connection อาจล้มเหลวเนื่องจาก:
- Port mismatch
- Network/firewall blocking
- Browser security settings

## ✅ วิธีแก้ไข

### Solution 1: Restart Dev Server (แนะนำ)

```bash
# หยุด server (Ctrl+C)
npm run dev
```

### Solution 2: ตรวจสอบ Port

1. ดูใน Terminal ว่า Vite รันที่ port ไหน
2. เปิด URL ที่ถูกต้องใน Browser (ควรเป็น `http://localhost:3000`)

### Solution 3: Disable HMR (ถ้ายังแก้ไม่ได้)

แก้ไข `vite.config.ts`:

```typescript
server: {
  port: 3000,
  host: 'localhost',
  // Disable HMR
  hmr: false,
},
```

**หมายเหตุ:** ถ้า disable HMR แล้ว คุณต้อง refresh หน้าเว็บเองเมื่อแก้ไขโค้ด

### Solution 4: ใช้ Polling แทน WebSocket

แก้ไข `vite.config.ts`:

```typescript
server: {
  port: 3000,
  host: 'localhost',
  watch: {
    usePolling: true, // Use polling instead of native file system events
  },
},
```

---

## ⚠️ หมายเหตุ

- **WebSocket error ไม่ทำให้ app ไม่ทำงาน** - App ยังทำงานได้ปกติ
- **แค่ hot reload ไม่ทำงาน** - ต้อง refresh หน้าเว็บเองเมื่อแก้ไขโค้ด
- **ไม่ใช่ปัญหาใหญ่** - ถ้า app ทำงานได้ปกติแล้ว ไม่ต้องกังวลเรื่องนี้

---

## 🔍 ตรวจสอบปัญหา

1. **ตรวจสอบ Browser Console (F12)**
   - ดูว่ามี error อะไรเพิ่มเติมหรือไม่
   - ดูว่า app ทำงานได้หรือไม่

2. **ตรวจสอบ Terminal**
   - ดูว่า Vite รันสำเร็จหรือไม่
   - ดู URL ที่แสดง

3. **ลองเปิดใน Incognito/Private mode**
   - อาจเป็นปัญหา browser extension

---

## 📚 เอกสารเพิ่มเติม

- [Vite HMR Documentation](https://vite.dev/guide/api-hmr.html)
- [Vite Server Options](https://vite.dev/config/server-options.html)

