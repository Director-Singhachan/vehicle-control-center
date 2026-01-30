  # 🚚 ออกแบบฟีเจอร์ AI สำหรับการจัดทริป (3D Bin Packing)

## 📋 สรุปปัญหา

ต้องการให้ AI ช่วยวิเคราะห์ว่า:
- **จำนวนสินค้าเท่านี้** ควรใช้ **รถกี่คัน** และ **คันไหน**
- แต่ละคันสามารถ **จัดเรียงสินค้าได้อย่างไร** (3D packing)
- แต่ละคันมี **พื้นที่ไม่เท่ากัน** และ **การจัดเรียงซับซ้อนได้หลายรูปแบบ**

---

## 🎯 เป้าหมาย

1. **Input**: รายการสินค้าที่ต้องส่ง (product_id, quantity) + รายการร้านค้า
2. **Output**: 
   - แนะนำจำนวนรถที่เหมาะสม
   - แนะนำรถแต่ละคันที่ควรใช้
   - แสดงการจัดเรียงสินค้าในแต่ละคัน (3D visualization)
   - ประมาณการระยะทาง/เวลา

---

## 🏗️ โครงสร้างข้อมูลที่ต้องเพิ่ม

### 1. เพิ่มข้อมูลรถ (Vehicles) - ขนาดและความจุ

```sql
-- Migration: เพิ่มคอลัมน์สำหรับการจัดเรียงสินค้า
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS cargo_length_cm DECIMAL(10, 2),      -- ความยาวพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS cargo_width_cm DECIMAL(10, 2),       -- ความกว้างพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS cargo_height_cm DECIMAL(10, 2),     -- ความสูงพื้นที่บรรทุก (ซม.)
ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(10, 2),       -- น้ำหนักสูงสุดที่รับได้ (กก.)
ADD COLUMN IF NOT EXISTS cargo_volume_liter DECIMAL(10, 2),  -- ปริมาตรรวม (ลิตร)
ADD COLUMN IF NOT EXISTS has_shelves BOOLEAN DEFAULT FALSE,  -- มีชั้นวางหรือไม่
ADD COLUMN IF NOT EXISTS shelf_config JSONB,                 -- รูปแบบชั้นวาง (JSON: [{level: 1, height: 100, ...}])
ADD COLUMN IF NOT EXISTS cargo_shape_type TEXT,              -- รูปแบบ: 'box', 'van', 'truck', 'refrigerated'
ADD COLUMN IF NOT EXISTS loading_constraints JSONB;          -- ข้อจำกัดการจัดเรียง (JSON: {no_stack_above: [...], fragile_zones: [...]})
```

**ตัวอย่าง `shelf_config`:**
```json
{
  "shelves": [
    {"level": 1, "height_cm": 120, "max_weight_kg": 500},
    {"level": 2, "height_cm": 100, "max_weight_kg": 400},
    {"level": 3, "height_cm": 80, "max_weight_kg": 300}
  ],
  "floor": {"height_cm": 150, "max_weight_kg": 1000}
}
```

**ตัวอย่าง `loading_constraints`:**
```json
{
  "no_stack_above": ["fragile", "liquid"],
  "fragile_zones": [{"x": 0, "y": 0, "width": 50, "height": 50}],
  "temperature_zones": [
    {"zone": "cold", "x": 0, "y": 0, "width": 100, "height": 100, "temp_c": 4}
  ]
}
```

### 2. เพิ่มข้อมูลสินค้า (Products) - ขนาด 3D + พาเลท

```sql
-- Migration: เพิ่มคอลัมน์ขนาด 3D สำหรับสินค้า
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10, 2),           -- ความยาว (ซม.)
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10, 2),            -- ความกว้าง (ซม.)
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10, 2),           -- ความสูง (ซม.)
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE,   -- ของแตกง่ายหรือไม่
ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN DEFAULT FALSE,    -- ของเหลวหรือไม่
ADD COLUMN IF NOT EXISTS requires_temperature TEXT,          -- อุณหภูมิที่ต้องการ: 'room', 'cold', 'frozen'
ADD COLUMN IF NOT EXISTS stacking_limit INTEGER DEFAULT 5,    -- จำนวนสูงสุดที่ซ้อนได้
ADD COLUMN IF NOT EXISTS orientation_constraints JSONB,      -- ข้อจำกัดการวาง: {can_rotate: true, must_stand: false}
ADD COLUMN IF NOT EXISTS packaging_type TEXT,                -- ประเภทบรรจุ: 'box', 'pallet', 'loose', 'bag'
ADD COLUMN IF NOT EXISTS uses_pallet BOOLEAN DEFAULT FALSE,  -- ใช้พาเลทหรือไม่
ADD COLUMN IF NOT EXISTS pallet_id UUID REFERENCES public.pallets(id); -- พาเลทที่ใช้ (ถ้า uses_pallet = true)
```

### 2.1. ตารางใหม่: Pallets (พาเลท)

```sql
-- ตารางเก็บข้อมูลพาเลทแต่ละประเภท
CREATE TABLE IF NOT EXISTS public.pallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_code TEXT NOT NULL UNIQUE,                          -- รหัสพาเลท (เช่น "PAL-STD", "PAL-EUR")
  pallet_name TEXT NOT NULL,                                 -- ชื่อพาเลท (เช่น "พาเลทมาตรฐาน", "พาเลทยุโรป")
  description TEXT,
  
  -- ขนาดพาเลท (ซม.)
  length_cm DECIMAL(10, 2) NOT NULL,                         -- ความยาวพาเลท
  width_cm DECIMAL(10, 2) NOT NULL,                          -- ความกว้างพาเลท
  height_cm DECIMAL(10, 2) NOT NULL,                         -- ความสูงพาเลท (รวมสินค้าที่ซ้อนได้)
  weight_kg DECIMAL(10, 2) DEFAULT 0,                       -- น้ำหนักพาเลทเปล่า (กก.)
  
  -- ข้อมูลการซ้อน
  max_stack_height_cm DECIMAL(10, 2),                        -- ความสูงสูงสุดที่ซ้อนได้ (รวมพาเลท)
  max_stack_count INTEGER DEFAULT 1,                        -- จำนวนพาเลทที่ซ้อนได้สูงสุด
  max_weight_per_pallet_kg DECIMAL(10, 2),                  -- น้ำหนักสูงสุดต่อพาเลท (กก.)
  
  -- ข้อมูลสินค้าบนพาเลท
  items_per_pallet INTEGER,                                  -- จำนวนสินค้าต่อพาเลท (ถ้าคงที่)
  pallet_layout_config JSONB,                                -- รูปแบบการจัดเรียงสินค้าบนพาเลท (JSON)
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_pallets_code ON public.pallets(pallet_code);
CREATE INDEX idx_pallets_active ON public.pallets(is_active);
```

**ตัวอย่าง `pallet_layout_config`:**
```json
{
  "layout_type": "grid",
  "rows": 4,
  "columns": 3,
  "items_per_pallet": 12,
  "spacing_cm": {
    "between_items": 2,
    "from_edge": 5
  }
}
```

**ตัวอย่าง `orientation_constraints`:**
```json
{
  "can_rotate": true,
  "must_stand": false,
  "allowed_orientations": ["upright", "sideways", "upside_down"]
}
```

### 3. ตารางใหม่: Vehicle Loading Templates (เทมเพลตการจัดเรียง)

```sql
-- ตารางเก็บ "เทมเพลตการจัดเรียง" ที่ AI เรียนรู้มา
CREATE TABLE IF NOT EXISTS public.vehicle_loading_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,                               -- ชื่อเทมเพลต (เช่น "จัดเต็ม", "สินค้าเบา")
  description TEXT,
  
  -- ข้อมูลการจัดเรียง (JSON)
  layout_config JSONB NOT NULL,                              -- รูปแบบการจัดเรียง
  
  -- สถิติ
  total_items_packed INTEGER,                                -- จำนวนสินค้าที่จัดได้
  utilization_percentage DECIMAL(5, 2),                     -- % การใช้พื้นที่
  weight_utilization_percentage DECIMAL(5, 2),              -- % การใช้น้ำหนัก
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(vehicle_id, template_name)
);

-- Index
CREATE INDEX idx_vehicle_loading_templates_vehicle ON public.vehicle_loading_templates(vehicle_id);
```

**ตัวอย่าง `layout_config`:**
```json
{
  "zones": [
    {
      "zone_id": "front-left",
      "x": 0, "y": 0, "z": 0,
      "width": 100, "depth": 150, "height": 120,
      "items": [
        {"product_id": "xxx", "quantity": 10, "x": 0, "y": 0, "z": 0, "orientation": "upright"}
      ]
    }
  ],
  "total_volume_used": 500000,
  "total_weight_used": 800
}
```

### 4. ตารางใหม่: AI Trip Recommendations (คำแนะนำจาก AI)

```sql
-- ตารางเก็บคำแนะนำการจัดทริปจาก AI
CREATE TABLE IF NOT EXISTS public.ai_trip_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Input
  input_hash TEXT NOT NULL,                                  -- Hash ของ input เพื่อป้องกัน duplicate
  requested_products JSONB NOT NULL,                        -- [{product_id, quantity, store_id}]
  requested_stores JSONB NOT NULL,                          -- [{store_id, sequence_order}]
  planned_date DATE NOT NULL,
  
  -- Output: คำแนะนำ
  recommended_trips JSONB NOT NULL,                         -- [{vehicle_id, items[], layout[]}]
  total_vehicles_needed INTEGER,
  estimated_distance_km DECIMAL(10, 2),
  estimated_duration_hours DECIMAL(10, 2),
  utilization_scores JSONB,                                 -- {vehicle_id: {volume: 85, weight: 90}}
  
  -- AI Metadata
  ai_model_version TEXT,                                    -- เวอร์ชันโมเดลที่ใช้
  confidence_score DECIMAL(5, 2),                           -- ความมั่นใจ (0-100)
  reasoning TEXT,                                            -- เหตุผลที่ AI แนะนำแบบนี้
  
  -- Status
  status TEXT DEFAULT 'pending',                            -- 'pending', 'accepted', 'rejected', 'modified'
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_ai_trip_recommendations_hash ON public.ai_trip_recommendations(input_hash);
CREATE INDEX idx_ai_trip_recommendations_date ON public.ai_trip_recommendations(planned_date);
```

---

## 🤖 แนวทาง AI/Algorithm

### Phase 1: Rule-Based Algorithm (เริ่มต้น - เร็ว, ใช้งานได้ทันที)

**ใช้ Algorithm แบบ Deterministic:**

1. **First Fit Decreasing (FFD)** - จัดเรียงสินค้าตามขนาดใหญ่ → เล็ก แล้วใส่รถทีละคัน
2. **Best Fit** - หารถที่เหลือพื้นที่น้อยที่สุดที่ใส่ได้
3. **3D Bin Packing Algorithm** - ใช้ library เช่น:
   - **Python**: `py3dbp` (3D Bin Packing)
   - **JavaScript**: `bin-packing` (2D/3D)
   - **Rust**: `bin_packer_3d` (เร็วมาก)

**Flow:**
```
Input: [{product_id, quantity, store_id}, ...]
↓
1. คำนวณขนาดรวมของสินค้าแต่ละร้าน
2. เรียงลำดับร้านตาม sequence_order
3. สำหรับแต่ละร้าน:
   - หารถที่เหมาะสม (มีพื้นที่พอ + ใกล้ร้านก่อนหน้า)
   - ใช้ 3D packing algorithm จัดเรียงสินค้า
   - ถ้าใส่ไม่หมด → แบ่งไปรถคันถัดไป
↓
Output: [{vehicle_id, stores[], layout_3d[]}, ...]
```

### Phase 2: Machine Learning (ระยะยาว - เรียนรู้จากข้อมูลจริง)

**Train Model จากข้อมูลทริปที่ผ่านมา:**

1. **Features (Input)**:
   - ขนาดสินค้า (length, width, height, weight)
   - จำนวนสินค้า
   - ลำดับร้าน
   - ขนาดรถ
   - สภาพอากาศ (ถ้ามี)
   - วันในสัปดาห์

2. **Labels (Output)**:
   - จำนวนรถที่ใช้จริง
   - รถแต่ละคันที่ใช้จริง
   - การจัดเรียงที่ใช้จริง (จาก `vehicle_loading_templates`)

3. **Model Options**:
   - **Regression**: ทำนายจำนวนรถ
   - **Classification**: ทำนายรถที่เหมาะสม
   - **Reinforcement Learning**: เรียนรู้การจัดเรียงที่ดีที่สุด

4. **Training Data**:
   - เก็บข้อมูลทริปที่ "สำเร็จ" (utilization สูง, ไม่มีปัญหา)
   - เก็บข้อมูลทริปที่ "มีปัญหา" (ต้องแก้ไข, ใส่ไม่หมด)

---

## 💻 Implementation Plan

### Step 1: เพิ่มข้อมูลพื้นฐาน (Database)

1. ✅ สร้าง migration สำหรับเพิ่มคอลัมน์ `vehicles` (cargo dimensions)
2. ✅ สร้าง migration สำหรับเพิ่มคอลัมน์ `products` (3D dimensions)
3. ✅ สร้างตาราง `vehicle_loading_templates`
4. ✅ สร้างตาราง `ai_trip_recommendations`

### Step 2: สร้าง Service สำหรับ Packing Algorithm

**ไฟล์: `services/tripPackingService.ts`**

```typescript
interface PackingInput {
  products: Array<{
    product_id: string;
    quantity: number;
    store_id: string;
  }>;
  stores: Array<{
    store_id: string;
    sequence_order: number;
  }>;
  available_vehicles: string[]; // vehicle_ids
  planned_date: string;
}

interface PackingResult {
  trips: Array<{
    vehicle_id: string;
    vehicle_plate: string;
    stores: Array<{
      store_id: string;
      sequence_order: number;
      items: Array<{
        product_id: string;
        quantity: number;
        position?: { x: number; y: number; z: number };
      }>;
    }>;
    layout_3d: {
      total_volume_used: number;
      total_weight_used: number;
      utilization_percentage: number;
      zones: Array<{
        zone_id: string;
        items: Array<{...}>;
      }>;
    };
  }>;
  summary: {
    total_vehicles_needed: number;
    estimated_distance_km: number;
    estimated_duration_hours: number;
  };
}

export const tripPackingService = {
  // ใช้ Rule-Based Algorithm
  calculateOptimalPacking: async (input: PackingInput): Promise<PackingResult> => {
    // 1. โหลดข้อมูลรถ + สินค้า
    // 2. เรียก 3D Bin Packing Algorithm
    // 3. คำนวณระยะทาง/เวลา
    // 4. Return ผลลัพธ์
  },
  
  // บันทึกคำแนะนำลง database
  saveRecommendation: async (input: PackingInput, result: PackingResult): Promise<string> => {
    // บันทึกลง ai_trip_recommendations
  },
  
  // ใช้ ML Model (Phase 2)
  predictWithML: async (input: PackingInput): Promise<PackingResult> => {
    // เรียก ML API / Edge Function
  }
};
```

### Step 3: สร้าง Edge Function สำหรับ 3D Packing

**ไฟล์: `supabase/functions/trip-packing-optimizer/index.ts`**

```typescript
// ใช้ Python library ผ่าน Deno หรือเรียก external API
// หรือใช้ JavaScript library สำหรับ 3D packing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { products, vehicles } = await req.json();
  
  // เรียก 3D Bin Packing Algorithm
  const result = await pack3D(products, vehicles);
  
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Step 4: สร้าง UI Component

**ไฟล์: `views/AITripOptimizerView.tsx`**

```typescript
export const AITripOptimizerView: React.FC = () => {
  const [inputProducts, setInputProducts] = useState<...>([]);
  const [recommendations, setRecommendations] = useState<...>(null);
  const [loading, setLoading] = useState(false);
  
  const handleOptimize = async () => {
    setLoading(true);
    const result = await tripPackingService.calculateOptimalPacking({
      products: inputProducts,
      stores: selectedStores,
      available_vehicles: availableVehicles.map(v => v.id),
      planned_date: selectedDate,
    });
    setRecommendations(result);
    setLoading(false);
  };
  
  return (
    <div>
      {/* Input Form */}
      <ProductInputForm />
      
      {/* AI Recommendations */}
      {recommendations && (
        <TripRecommendationsView 
          recommendations={recommendations}
          onAccept={handleAcceptRecommendation}
        />
      )}
      
      {/* 3D Visualization */}
      {recommendations && (
        <Vehicle3DVisualization 
          layouts={recommendations.trips.map(t => t.layout_3d)}
        />
      )}
    </div>
  );
};
```

### Step 5: 3D Visualization Component

**ใช้ Library:**
- **Three.js** + **React Three Fiber** - สำหรับแสดงผล 3D
- **Babylon.js** - ทางเลือกอื่น

**ไฟล์: `components/trip/Vehicle3DVisualization.tsx`**

```typescript
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';

export const Vehicle3DVisualization: React.FC<{layout: Layout3D}> = ({ layout }) => {
  return (
    <Canvas>
      {/* วาดรถ (container) */}
      <Box args={[vehicle.length, vehicle.width, vehicle.height]} />
      
      {/* วาดสินค้าแต่ละชิ้น */}
      {layout.zones.map(zone => 
        zone.items.map(item => (
          <Box 
            key={item.id}
            position={[item.x, item.y, item.z]}
            args={[item.length, item.width, item.height]}
          />
        ))
      )}
      
      <OrbitControls />
    </Canvas>
  );
};
```

---

## 📊 ตัวอย่าง Output

```json
{
  "trips": [
    {
      "vehicle_id": "xxx",
      "vehicle_plate": "กข-1234",
      "stores": [
        {
          "store_id": "store-1",
          "sequence_order": 1,
          "items": [
            {"product_id": "prod-1", "quantity": 10}
          ]
        }
      ],
      "layout_3d": {
        "total_volume_used": 500000,
        "total_weight_used": 800,
        "utilization_percentage": 85.5,
        "zones": [
          {
            "zone_id": "front-left",
            "items": [
              {
                "product_id": "prod-1",
                "quantity": 5,
                "position": {"x": 0, "y": 0, "z": 0},
                "orientation": "upright"
              }
            ]
          }
        ]
      }
    }
  ],
  "summary": {
    "total_vehicles_needed": 2,
    "estimated_distance_km": 150,
    "estimated_duration_hours": 4.5
  }
}
```

---

## 🚀 Roadmap

### Phase 1 (1-2 เดือน): Rule-Based
- ✅ เพิ่มข้อมูลรถ/สินค้า (dimensions)
- ✅ สร้าง service สำหรับ 3D packing
- ✅ สร้าง UI สำหรับ input + แสดงผลคำแนะนำ
- ✅ 3D visualization พื้นฐาน

### Phase 2 (3-6 เดือน): Machine Learning
- ✅ เก็บข้อมูลทริปที่ผ่านมา
- ✅ Train ML model
- ✅ Integrate ML predictions
- ✅ A/B testing เปรียบเทียบ Rule-based vs ML

### Phase 3 (6+ เดือน): Advanced Features
- ✅ Real-time optimization (ปรับตาม traffic)
- ✅ Multi-objective optimization (ระยะทาง + เวลา + ค่าใช้จ่าย)
- ✅ Learning from user feedback (accept/reject recommendations)

---

## 📚 Resources

### 3D Bin Packing Libraries:
- **Python**: `py3dbp`, `rectpack`
- **JavaScript**: `bin-packing`, `three-dimensional-bin-packing`
- **Rust**: `bin_packer_3d` (เร็วมาก, ใช้ผ่าน WebAssembly)

### ML/AI Libraries:
- **Python**: `scikit-learn`, `TensorFlow`, `PyTorch`
- **JavaScript**: `TensorFlow.js` (รันใน browser)

### Visualization:
- **Three.js** + **React Three Fiber**
- **Babylon.js**

---

## ❓ คำถามที่ต้องตอบก่อนเริ่มทำ

1. **ข้อมูลรถ**: มีข้อมูลขนาดพื้นที่บรรทุกของรถแต่ละคันอยู่แล้วหรือยัง?
2. **ข้อมูลสินค้า**: มีข้อมูลขนาด 3D ของสินค้าแต่ละชิ้นอยู่แล้วหรือยัง?
3. **Priority**: ต้องการให้เร็ว (Rule-based) หรือแม่นยำ (ML)?
4. **Budget**: มี budget สำหรับ ML training/inference หรือไม่?
5. **Timeline**: ต้องการใช้ได้เมื่อไหร่?

---

## 🎯 Next Steps

1. **Review & Approve** design นี้
2. **Create Database Migrations** สำหรับเพิ่มข้อมูลรถ/สินค้า
3. **Choose 3D Packing Library** (แนะนำเริ่มด้วย Python `py3dbp` แล้วเรียกผ่าน Edge Function)
4. **Create MVP** (Minimum Viable Product) - Rule-based ก่อน
5. **Collect Data** จากทริปจริงเพื่อ train ML ต่อไป
