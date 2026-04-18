# ปัญหาหน่วยสินค้าเพี้ยนใน flow ทริปจัดส่ง (เกิดซ้ำหลายรอบ)

บันทึกนี้ใช้เตือนเมื่อแก้/เพิ่มฟีเจอร์เกี่ยวกับ **ทริปจัดส่ง (delivery trip)** และ **ออเดอร์** — หน่วยที่ลูกค้าเห็นต้องสอดคล้องกับ **บรรทัดออเดอร์ / บรรทัดทริป** ไม่ใช่แค่ `products.unit` (หน่วยหลักของ SKU)

## อาการที่ผู้ใช้พบ

- หน้าออเดอร์รอจัดทริป: หน่วยถูก (มาจาก `order_items.unit`)
- หลังจัดทริปหรือดูรายละเอียดทริป: หน่วยกลายเป็นถาด/ลัง ทั้งที่บรรทัดนั้นเป็นขวด (เช่น ของแถม)
- ตารางสรุปสินค้าในเที่ยว: จำนวนรวมกับหน่วย “มั่ว” เพราะไปรวมหลายบรรทัดที่หน่วยต่างกันเข้าด้วยกัน

## สาเหตุหลัก (รากที่เคยพลาด)

1. **แสดงผล UI ใช้ `product.unit` แทน `delivery_trip_items.unit`**  
   ตาราง `products` เป็นหน่วยหลักของ SKU เดียว — บรรทัดออเดอร์อาจสั่งเป็นหน่วยย่อย/โปรโมชัน (ขวด) ได้ ต้องโชว์จากคอลัมน์บรรทัดทริปก่อน

2. **สรุปยอด (aggregate) ใช้ key แค่ `product_id`**  
   SKU เดียวกันอาจมีหลายบรรทัด: ของแถม vs ขายปกติ, หน่วยต่างกัน — ถ้ารวมแค่ `product_id` จะบวกจำนวนรวมกันผิดและเลือกหน่วยผิด

## แนวทางที่ถูกต้อง (สรุป)

- **แสดงจำนวนต่อบรรทัดในทริป:** ใช้  
  `(item.unit != null && String(item.unit).trim() !== '' ? item.unit : product.unit)`  
  หรือ helper เดียวกัน — **ห้าม** hardcode แค่ `product.unit` เมื่อมี `item` จาก `delivery_trip_items`
- **สรุปสินค้าทั้งเที่ยว:** รวมกลุ่มด้วย key ที่แยกอย่างน้อย **`product_id` + `is_bonus` + หน่วยบรรทัดที่ใช้แสดง** (ดู implementation ใน `tripHistoryAggregatesService.getAggregatedProducts`)
- **สร้างทริปจาก wizard:** payload ต้องส่ง `unit` ต่อบรรทัด (มีอยู่แล้วใน `useCreateTripWizard` / `tripCrudService` insert) — ถ้าเพิ่ม flow ใหม่ต้องไม่ทำให้ `unit` หลุด

## ไฟล์ที่เกี่ยวข้อง (ควรเช็กก่อน merge ถ้าแตะโดเมนนี้)

| พื้นที่ | ไฟล์ |
|--------|------|
| รายละเอียดร้านในทริป | `components/trip/TripStoresDetailSection.tsx` |
| ฟอร์มแก้ทริป / จำนวน | `components/trip/TripOrdersSection.tsx` |
| ตารางสรุปสินค้าเที่ยว | `components/trip/TripProductsDetailSection.tsx`, `TripProductSummarySection.tsx`, `TripItemsSection.tsx` |
| Logic สรุป | `services/deliveryTrip/tripHistoryAggregatesService.ts` → `getAggregatedProducts` |
| สรุปข้ามทริปต่อรถ | `services/vehicleTripUsageService.ts` → `getVehicleProductSummary` |
| PDF | `services/pdfService.ts` (แถวสรุปสินค้า) |
| สร้าง payload ทริป | `hooks/useCreateTripWizard.ts`, `hooks/useDeliveryTripForm.ts` |
| DB / ข้อมูลเก่า | `delivery_trip_items.unit`, สคริปต์ `sql/backfill_trip_item_unit_from_orders.sql` |

## Checklist ก่อนปิดงาน (เมื่อแตะหน่วยในทริป)

- [ ] ทุกที่ที่แสดงจำนวนจาก `delivery_trip_items` ใช้หน่วยจากบรรทัดก่อน `products.unit`
- [ ] การรวมยอดไม่ใช้แค่ `product_id` ถ้ามีความเป็นไปได้ที่หน่วยหรือของแถมต่างกัน
- [ ] React `key` ของแถวสรุปไม่ใช้แค่ `product_id` ถ้ามีหลายแถวต่อ SKU

อัปเดตล่าสุด: เก็บไว้ตามคำขอทีม — ปัญหานี้เคยกลับมาหลายรอบจาก regression ด้านแสดงผลและ aggregation
