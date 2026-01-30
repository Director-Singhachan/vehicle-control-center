# 📊 โครงสร้างข้อมูลสำหรับ AI Training

**อัปเดตล่าสุด:** 2026-01-30

---

## 🎯 ภาพรวม

ระบบมี 2 รูปแบบการ export ข้อมูลสำหรับ AI training:

1. **`exportTrainingData()`** - ข้อมูลสรุป (เหมาะสำหรับการวิเคราะห์เบื้องต้น)
2. **`exportDetailedTrainingData()`** - ข้อมูลละเอียด (เหมาะสำหรับการวิเคราะห์การจัดเรียงแบบละเอียด)

---

## 📋 1. ข้อมูลสรุป (`exportTrainingData`)

### ใช้เมื่อ:
- ต้องการวิเคราะห์ภาพรวม
- ต้องการข้อมูลพื้นฐานสำหรับ ML model แบบง่าย
- ต้องการ export เร็ว

### โครงสร้างข้อมูล:

```typescript
{
  // Trip Info
  id: string;
  trip_number: string | null;
  vehicle_id: string;
  planned_date: string;
  
  // Metrics (ที่บันทึก)
  actual_pallets_used: number | null;
  actual_weight_kg: number | null;
  space_utilization_percent: number | null;
  packing_efficiency_score: number | null;
  had_packing_issues: boolean;
  packing_issues_notes: string | null;
  actual_distance_km: number | null;
  actual_duration_hours: number | null;
  
  // สรุปข้อมูลทริป (ดึงอัตโนมัติ)
  total_products_quantity: number;      // จำนวนสินค้าทั้งหมด
  total_items_count: number;             // จำนวนรายการสินค้า
  stores_count: number;                  // จำนวนร้าน
  distance_from_logs_km: number | null;   // ระยะทาง
  duration_from_logs_hours: number | null; // ระยะเวลา
}
```

---

## 🔍 2. ข้อมูลละเอียด (`exportDetailedTrainingData`) ⭐ **แนะนำ**

### ใช้เมื่อ:
- ต้องการวิเคราะห์การจัดเรียงแบบละเอียด
- ต้องการให้ AI เรียนรู้บริบทของรถแต่ละคัน
- ต้องการให้ AI เรียนรู้รายละเอียดสินค้าแต่ละรายการ
- ต้องการวิเคราะห์การจัดเรียงที่ซับซ้อน

### โครงสร้างข้อมูล:

```typescript
{
  // Trip Info (เหมือนข้อมูลสรุป)
  id: string;
  trip_number: string | null;
  vehicle_id: string;
  planned_date: string;
  
  // Metrics (ที่บันทึก)
  actual_pallets_used: number | null;
  actual_weight_kg: number | null;
  space_utilization_percent: number | null;
  packing_efficiency_score: number | null;
  had_packing_issues: boolean;
  packing_issues_notes: string | null;
  actual_distance_km: number | null;
  actual_duration_hours: number | null;
  
  // สรุปข้อมูลทริป (ดึงอัตโนมัติ)
  total_products_quantity: number;
  total_items_count: number;
  stores_count: number;
  distance_from_logs_km: number | null;
  duration_from_logs_hours: number | null;
  
  // ⭐ รายละเอียดรถ (สำคัญมาก!)
  vehicle: {
    vehicle_id: string;
    plate: string | null;
    
    // ขนาดพื้นที่บรรทุก
    cargo_length_cm: number | null;      // ความยาว (ซม.)
    cargo_width_cm: number | null;       // ความกว้าง (ซม.)
    cargo_height_cm: number | null;       // ความสูง (ซม.)
    cargo_volume_liter: number | null;    // ปริมาตรรวม (ลิตร)
    max_weight_kg: number | null;         // น้ำหนักสูงสุดที่รับได้
    
    // คุณสมบัติรถ
    has_shelves: boolean;                  // มีชั้นวางหรือไม่
    shelf_config: {                       // รูปแบบชั้นวาง (JSON)
      shelves: [
        {
          level: number;
          height_cm: number;
          max_weight_kg: number;
        }
      ];
      floor: {
        height_cm: number;
        max_weight_kg: number;
      };
    } | null;
    cargo_shape_type: string | null;      // 'box', 'van', 'truck', 'refrigerated', 'flatbed'
    loading_constraints: {                // ข้อจำกัดการจัดเรียง (JSON)
      max_pallets?: number;
      max_weight_kg?: number;
      no_stack_above?: string[];
      fragile_zones?: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    } | null;
  };
  
  // ⭐ รายละเอียดสินค้าแต่ละรายการ (สำคัญมาก!)
  items: [
    {
      // Product Info
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      quantity: number;                   // จำนวนสินค้าในรายการนี้
      
      // Product Dimensions
      length_cm: number | null;           // ความยาว (ซม.)
      width_cm: number | null;            // ความกว้าง (ซม.)
      height_cm: number | null;           // ความสูง (ซม.)
      weight_kg: number | null;           // น้ำหนักต่อหน่วย (กก.)
      volume_liter: number | null;        // ปริมาตรต่อหน่วย (ลิตร)
      
      // Product Properties
      is_fragile: boolean;                 // ของแตกง่ายหรือไม่
      is_liquid: boolean;                  // ของเหลวหรือไม่
      requires_temperature: string | null; // 'room', 'cold', 'frozen'
      stacking_limit: number | null;        // จำนวนสูงสุดที่ซ้อนได้
      packaging_type: string | null;        // 'box', 'pallet', 'loose', 'bag'
      uses_pallet: boolean;                // ใช้พาเลทหรือไม่
      
      // Pallet Config ที่เลือกใช้
      selected_pallet_config_id: string | null;
      pallet_config: {
        config_name: string | null;         // เช่น "มาตรฐาน 60 ลัง"
        layers: number | null;              // จำนวนชั้น
        units_per_layer: number | null;     // จำนวนลัง/ถาดต่อชั้น
        total_units: number | null;         // จำนวนรวม (layers × units_per_layer)
        total_height_cm: number | null;     // ความสูงรวม (รวมพาเลท + สินค้า)
        total_weight_kg: number | null;     // น้ำหนักรวม (รวมพาเลท + สินค้า)
      } | null;
      
      // Store Info
      store_id: string;
      store_sequence: number;               // ลำดับการส่ง (1, 2, 3, ...)
      is_bonus: boolean;                    // เป็นของแถมหรือไม่
    }
  ];
}
```

---

## 💡 ตัวอย่างการใช้งาน

### ตัวอย่างข้อมูลละเอียด:

```json
{
  "id": "trip-123",
  "trip_number": "DT-2601-0001",
  "vehicle_id": "vehicle-456",
  "planned_date": "2026-01-30",
  
  "actual_pallets_used": 12,
  "actual_weight_kg": 850.5,
  "space_utilization_percent": 75.0,
  "packing_efficiency_score": 80.0,
  "had_packing_issues": false,
  
  "total_products_quantity": 150,
  "total_items_count": 5,
  "stores_count": 3,
  "distance_from_logs_km": 120,
  "duration_from_logs_hours": 4.5,
  
  "vehicle": {
    "vehicle_id": "vehicle-456",
    "plate": "กข-1234",
    "cargo_length_cm": 400,
    "cargo_width_cm": 200,
    "cargo_height_cm": 200,
    "cargo_volume_liter": 16000,
    "max_weight_kg": 2000,
    "has_shelves": true,
    "shelf_config": {
      "shelves": [
        {"level": 1, "height_cm": 120, "max_weight_kg": 500},
        {"level": 2, "height_cm": 120, "max_weight_kg": 500}
      ],
      "floor": {"height_cm": 150, "max_weight_kg": 1000}
    },
    "cargo_shape_type": "box",
    "loading_constraints": {
      "max_pallets": 15,
      "max_weight_kg": 2000
    }
  },
  
  "items": [
    {
      "product_id": "product-001",
      "product_code": "P001",
      "product_name": "น้ำดื่ม 500ml",
      "category": "เครื่องดื่ม",
      "quantity": 60,
      "length_cm": 20,
      "width_cm": 15,
      "height_cm": 30,
      "weight_kg": 0.5,
      "volume_liter": 0.5,
      "is_fragile": false,
      "is_liquid": true,
      "requires_temperature": "room",
      "stacking_limit": 10,
      "packaging_type": "box",
      "uses_pallet": true,
      "selected_pallet_config_id": "config-001",
      "pallet_config": {
        "config_name": "มาตรฐาน 60 ลัง",
        "layers": 5,
        "units_per_layer": 12,
        "total_units": 60,
        "total_height_cm": 165,
        "total_weight_kg": 35
      },
      "store_id": "store-001",
      "store_sequence": 1,
      "is_bonus": false
    },
    {
      "product_id": "product-002",
      "product_code": "P002",
      "product_name": "ขนมกรุบกรอบ",
      "category": "ขนม",
      "quantity": 90,
      "length_cm": 25,
      "width_cm": 20,
      "height_cm": 10,
      "weight_kg": 0.2,
      "volume_liter": 0.2,
      "is_fragile": true,
      "is_liquid": false,
      "requires_temperature": "room",
      "stacking_limit": 5,
      "packaging_type": "box",
      "uses_pallet": true,
      "selected_pallet_config_id": "config-002",
      "pallet_config": {
        "config_name": "อัดแน่น 90 ลัง",
        "layers": 6,
        "units_per_layer": 15,
        "total_units": 90,
        "total_height_cm": 75,
        "total_weight_kg": 20
      },
      "store_id": "store-002",
      "store_sequence": 2,
      "is_bonus": false
    }
  ]
}
```

---

## 🎯 ข้อมูลที่สำคัญสำหรับ AI

### 1. **บริบทของรถแต่ละคัน** 🚗
- **ขนาดพื้นที่บรรทุก** (length, width, height, volume)
- **น้ำหนักสูงสุด** (max_weight_kg)
- **มีชั้นวางหรือไม่** (has_shelves, shelf_config)
- **รูปแบบรถ** (cargo_shape_type)
- **ข้อจำกัดการจัดเรียง** (loading_constraints)

**ทำไมสำคัญ:**
- AI ต้องรู้ว่ารถแต่ละคันมีพื้นที่เท่าไร
- AI ต้องรู้ว่ารถแต่ละคันมีข้อจำกัดอะไรบ้าง
- AI ต้องรู้ว่ารถแต่ละคันมีชั้นวางหรือไม่

### 2. **รายละเอียดสินค้าแต่ละรายการ** 📦
- **ขนาดสินค้า** (length, width, height, volume)
- **น้ำหนักสินค้า** (weight_kg)
- **คุณสมบัติสินค้า** (is_fragile, is_liquid, requires_temperature)
- **ข้อจำกัดการซ้อน** (stacking_limit)
- **พาเลท config ที่ใช้** (pallet_config)

**ทำไมสำคัญ:**
- AI ต้องรู้ว่าสินค้าแต่ละชนิดมีขนาดเท่าไร
- AI ต้องรู้ว่าสินค้าแต่ละชนิดมีข้อจำกัดอะไรบ้าง
- AI ต้องรู้ว่าสินค้าแต่ละชนิดใช้พาเลทแบบไหน

### 3. **ลำดับการส่ง** 🏪
- **store_sequence** - ลำดับการส่ง (1, 2, 3, ...)

**ทำไมสำคัญ:**
- AI ต้องรู้ว่าสินค้าต้องส่งที่ไหนก่อน
- AI ต้องจัดเรียงให้สินค้าที่ส่งก่อนอยู่ด้านนอก (ง่ายต่อการขนถ่าย)

### 4. **ผลลัพธ์จริง** ✅
- **actual_pallets_used** - จำนวนพาเลทที่ใช้จริง
- **space_utilization_percent** - % การใช้พื้นที่
- **packing_efficiency_score** - คะแนนประสิทธิภาพ
- **had_packing_issues** - มีปัญหาหรือไม่

**ทำไมสำคัญ:**
- AI ต้องเรียนรู้จากผลลัพธ์จริง
- AI ต้องรู้ว่าการจัดเรียงแบบไหนดี/ไม่ดี

---

## 📊 เปรียบเทียบ 2 รูปแบบ

| คุณสมบัติ | ข้อมูลสรุป | ข้อมูลละเอียด |
|---------|----------|-------------|
| **รายละเอียดสินค้า** | ❌ ไม่มี | ✅ มีทุกรายการ |
| **รายละเอียดรถ** | ❌ ไม่มี | ✅ มีครบถ้วน |
| **ลำดับการส่ง** | ❌ ไม่มี | ✅ มี |
| **Pallet Config** | ❌ ไม่มี | ✅ มี |
| **ขนาดไฟล์** | เล็ก | ใหญ่ |
| **ความเร็ว** | เร็ว | ช้ากว่า |
| **เหมาะสำหรับ** | วิเคราะห์ภาพรวม | วิเคราะห์ละเอียด |

---

## 🚀 คำแนะนำการใช้งาน

### ใช้ข้อมูลสรุป เมื่อ:
- ✅ ต้องการวิเคราะห์ภาพรวม
- ✅ ต้องการข้อมูลพื้นฐานสำหรับ ML model แบบง่าย
- ✅ ต้องการ export เร็ว

### ใช้ข้อมูลละเอียด เมื่อ:
- ✅ ต้องการวิเคราะห์การจัดเรียงแบบละเอียด
- ✅ ต้องการให้ AI เรียนรู้บริบทของรถแต่ละคัน
- ✅ ต้องการให้ AI เรียนรู้รายละเอียดสินค้าแต่ละรายการ
- ✅ ต้องการวิเคราะห์การจัดเรียงที่ซับซ้อน
- ✅ **แนะนำสำหรับการเทรน AI จริง** ⭐

---

## 💻 ตัวอย่างโค้ด

```typescript
import { tripMetricsService } from './services/tripMetricsService';

// Export ข้อมูลสรุป
const summaryData = await tripMetricsService.exportTrainingData({
  from: '2026-01-01',
  to: '2026-01-31',
});

// Export ข้อมูลละเอียด (แนะนำ)
const detailedData = await tripMetricsService.exportDetailedTrainingData({
  from: '2026-01-01',
  to: '2026-01-31',
});

// Export เป็น JSON
const jsonData = JSON.stringify(detailedData, null, 2);
console.log(jsonData);
```

---

## 📈 ผลลัพธ์ที่คาดหวัง

เมื่อใช้ข้อมูลละเอียด AI จะสามารถ:
- ✅ เรียนรู้ว่าสินค้าแต่ละชนิดใช้พาเลทกี่ใบ
- ✅ เรียนรู้ว่าสินค้าแต่ละชนิดจัดเรียงอย่างไร
- ✅ เรียนรู้ว่าสินค้าแต่ละชนิดมีข้อจำกัดอะไรบ้าง
- ✅ เรียนรู้ว่ารถแต่ละคันมีพื้นที่เท่าไร
- ✅ เรียนรู้ว่าการจัดเรียงแบบไหนดี/ไม่ดี
- ✅ **ทำนายการจัดเรียงที่เหมาะสมสำหรับทริปใหม่**

---

**Last Updated:** 2026-01-30
