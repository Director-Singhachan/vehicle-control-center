# 📱 Mobile App Documentation - Customer App Only

## ⚠️ สิ่งสำคัญที่ต้องรู้

**Mobile App (Flutter) นี้สำหรับลูกค้าเท่านั้น**

- ✅ **Customer App**: ลูกค้าสั่งสินค้า, ดูออเดอร์, ติดตามสถานะ
- ❌ **Sales App**: ไม่มีใน Mobile App (ฝ่ายขายใช้ Web App)

---

## 📚 เอกสารที่เกี่ยวข้อง

### สำหรับ Mobile App (Customer)
- [`FLUTTER_QUICK_START.md`](../FLUTTER_QUICK_START.md) - Quick start guide
- [`docs/FLUTTER_MOBILE_APP_SETUP.md`](./FLUTTER_MOBILE_APP_SETUP.md) - คู่มือตั้งค่าแบบละเอียด
- [`docs/MOBILE_APP_ARCHITECTURE.md`](./MOBILE_APP_ARCHITECTURE.md) - Architecture (Customer App เท่านั้น)

### สำหรับ Web App (Sales + Warehouse)
- [`docs/FINAL_ARCHITECTURE.md`](./FINAL_ARCHITECTURE.md) - Architecture สุดท้าย (แนะนำให้อ่าน)
- [`docs/CORRECT_WORKFLOW.md`](./CORRECT_WORKFLOW.md) - Workflow ที่ถูกต้อง
- [`docs/SALES_TEAM_WORKFLOW.md`](./SALES_TEAM_WORKFLOW.md) - Workflow ของฝ่ายขาย

---

## 🎯 สรุป

| แอพ | สำหรับ | Technology |
|-----|--------|------------|
| **Mobile App** | ลูกค้าเท่านั้น | Flutter (Dart) |
| **Web App** | ฝ่ายขาย + คลังและจัดส่ง | React + TypeScript |

---

## 📝 หมายเหตุ

- ไฟล์ `docs/MOBILE_APP_ARCHITECTURE.md` และ `docs/FLUTTER_MOBILE_APP_SETUP.md` อาจมีข้อมูลเก่าเกี่ยวกับ Sales App ใน Mobile ซึ่งไม่ถูกต้องแล้ว
- **ฝ่ายขายใช้ Web App (React) ไม่ใช่ Mobile App**
- อ่าน [`docs/FINAL_ARCHITECTURE.md`](./FINAL_ARCHITECTURE.md) สำหรับ architecture ที่ถูกต้อง

