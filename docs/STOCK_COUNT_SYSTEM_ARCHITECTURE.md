# 📊 Stock Count System Architecture
## ระบบนับสต๊อกที่รองรับ SML Integration และ Automation

---

## 🎯 3 หัวใจหลักของระบบ

### 1. **Zero Manual Entry** 
- ✅ รองรับ Barcode/QR Code Scanning
- ✅ Auto-fill ข้อมูลสินค้าจาก Barcode
- ✅ Mobile-friendly interface สำหรับการนับ

### 2. **Instant Comparison**
- ✅ Real-time variance calculation
- ✅ Instant comparison หลัง Import จาก SML
- ✅ Visual indicators สำหรับส่วนต่าง

### 3. **Traceability**
- ✅ Detailed transaction logs
- ✅ Inventory snapshots (เก็บสถานะ ณ เวลาที่ export)
- ✅ Complete audit trail

---

## 📋 คำตอบคำถามทั้ง 3 ด้าน

### 1️⃣ คำถามด้านโครงสร้างข้อมูล (The Data Blueprint)

#### ❓ **Q1: ออกแบบ `inventory_snapshots` ให้รองรับการเก็บ 'สถานะ ณ เวลาที่ Export' อย่างไร?**

**คำตอบ:**

```sql
-- ตาราง inventory_snapshots
CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY,
  snapshot_type TEXT,              -- 'sml_export', 'pre_count', 'post_count'
  source_system TEXT,              -- 'SML', 'Manual', 'System'
  export_file_name TEXT,           -- ชื่อไฟล์ที่ import
  export_file_hash TEXT,           -- Hash เพื่อตรวจสอบความซ้ำ
  export_timestamp TIMESTAMPTZ,    -- เวลาที่ export จาก SML
  warehouse_id UUID,
  snapshot_data JSONB,             -- ข้อมูลสต็อกทั้งหมด ณ เวลานั้น
  total_products INTEGER,
  total_quantity NUMERIC,
  is_validated BOOLEAN,
  created_at TIMESTAMPTZ
);
```

**ประโยชน์:**
- ✅ **ย้อนกลับได้**: ดูได้ว่าสถานะสต็อกเป็นอย่างไร ณ เวลาที่ export จาก SML
- ✅ **ตรวจสอบความผิดพลาด**: เปรียบเทียบ snapshot กับข้อมูลจริงเพื่อหาว่าปัญหาอยู่ฝั่งไหน
- ✅ **Audit Trail**: มีหลักฐานครบถ้วนสำหรับการตรวจสอบ

**ตัวอย่างการใช้งาน:**
```typescript
// เมื่อ Import จาก SML
const snapshot = await createInventorySnapshot({
  snapshot_type: 'sml_export',
  source_system: 'SML',
  export_file_name: 'SML_Export_2026-02-01.xlsx',
  export_file_hash: hashFile(file),
  export_timestamp: '2026-02-01T10:30:00Z',
  warehouse_id: warehouseId,
  snapshot_data: {
    'PROD001': { quantity: 100, unit: 'kg' },
    'PROD002': { quantity: 50, unit: 'pcs' },
    // ...
  }
});

// เมื่อนับสต๊อกจริง
const countSession = await createStockCountSession({
  warehouse_id: warehouseId,
  sml_snapshot_id: snapshot.id,  // Link กับ snapshot
  count_date: '2026-02-01'
});

// เปรียบเทียบ
const comparison = await compareSnapshotWithCount(
  snapshot.id,
  countSession.id
);
// ผลลัพธ์: รู้ว่าส่วนต่างเกิดจาก SML หรือระบบใหม่
```

---

#### ❓ **Q2: จัดการรหัสสินค้า (ID Mapping) อย่างไร?**

**คำตอบ:**

```sql
-- ตาราง product_mappings
CREATE TABLE product_mappings (
  id UUID PRIMARY KEY,
  product_id UUID,                 -- ID ในระบบใหม่
  sml_product_code TEXT,           -- รหัสใน SML
  sml_product_name TEXT,           -- ชื่อใน SML (ถ้าต่าง)
  external_system TEXT,            -- 'SML', 'ERP', etc.
  mapping_type TEXT,               -- 'exact', 'fuzzy', 'manual', 'auto'
  confidence_score NUMERIC,        -- 0-100
  is_verified BOOLEAN
);
```

**Workflow:**
1. **Auto-Mapping**: ระบบพยายาม map อัตโนมัติจาก `product_code`
2. **Fuzzy Matching**: ถ้าไม่เจอ exact match ใช้ fuzzy matching
3. **Manual Review**: แสดงรายการที่ต้องตรวจสอบ
4. **Verification**: Admin/Manager ตรวจสอบและ approve

**ตัวอย่าง:**
```typescript
// Auto-mapping เมื่อ Import
const mapping = await autoMapProduct({
  sml_product_code: 'SML-PROD-001',
  sml_product_name: 'สินค้า A',
  external_system: 'SML'
});

if (mapping.confidence_score < 80) {
  // แสดงให้ Admin ตรวจสอบ
  await notifyAdminForReview(mapping);
}

// ใช้ mapping เมื่อ Import
const product = await findProductByMapping('SML-PROD-001', 'SML');
```

---

### 2️⃣ คำถามด้านตรรกะและการควบคุม (The Puppeteer's Logic)

#### ❓ **Q3: ควรเพิ่มสถานะ 'Under Review' ใน Workflow หรือไม่?**

**คำตอบ: ✅ ควรเพิ่ม!**

**Workflow ที่ออกแบบไว้:**
```
draft → in_progress → under_review → completed → approved
                              ↑
                    (สำหรับรายการที่มีส่วนต่างสูง)
```

**การทำงาน:**
1. เมื่อนับเสร็จ → ระบบคำนวณ `variance_severity` อัตโนมัติ
2. ถ้า `variance_severity` เป็น `major` หรือ `critical` → ตั้ง `requires_approval = TRUE`
3. Session status เปลี่ยนเป็น `under_review` อัตโนมัติ
4. Admin/Manager ตรวจสอบรายการที่มีส่วนต่างสูง
5. อนุมัติหรือปฏิเสธ → เปลี่ยน status เป็น `approved` หรือ `rejected`

**ตัวอย่าง:**
```typescript
// หลังนับเสร็จ
const session = await completeStockCount(sessionId);

// ระบบตรวจสอบอัตโนมัติ
if (session.variance_items > 0) {
  const criticalItems = await getItemsRequiringApproval(sessionId);
  
  if (criticalItems.length > 0) {
    // เปลี่ยน status เป็น under_review
    await updateSessionStatus(sessionId, 'under_review');
    
    // แจ้งเตือน Admin
    await notifyAdmin({
      message: `มี ${criticalItems.length} รายการที่ต้องตรวจสอบ`,
      items: criticalItems
    });
  }
}

// Admin ตรวจสอบ
await reviewVarianceItem(itemId, {
  review_notes: 'ตรวจสอบแล้ว พบว่าสินค้าชำรุด',
  approved: true
});

// อนุมัติ session
await approveStockCountSession(sessionId);
```

---

#### ❓ **Q4: จัดการสินค้าที่ไม่มีในระบบใหม่อย่างไร?**

**คำตอบ: ใช้ระบบ Auto-Create Product**

**Workflow:**
1. **Detection**: เมื่อ Import จาก SML พบสินค้าใหม่
2. **Suggestion**: ระบบสร้าง suggestion record
3. **Auto-Create (Optional)**: ถ้าเปิดใช้งาน auto-create → สร้างสินค้าอัตโนมัติ
4. **Notification**: แจ้งเตือน Admin ให้ตรวจสอบ
5. **Verification**: Admin ตรวจสอบและ approve/reject

**ตาราง:**
```sql
CREATE TABLE auto_create_product_logs (
  id UUID PRIMARY KEY,
  source_system TEXT,
  source_product_code TEXT,
  source_product_name TEXT,
  product_id UUID,              -- NULL ถ้ายังไม่สร้าง
  action_type TEXT,             -- 'created', 'suggested', 'rejected'
  created_data JSONB,
  is_verified BOOLEAN
);
```

**ตัวอย่าง:**
```typescript
// เมื่อ Import จาก SML
const importResult = await importSMLFile(file);

for (const item of importResult.items) {
  const product = await findProductByMapping(item.product_code, 'SML');
  
  if (!product) {
    // ไม่พบสินค้า → สร้าง suggestion
    const suggestion = await createProductSuggestion({
      source_system: 'SML',
      source_product_code: item.product_code,
      source_product_name: item.product_name,
      action_type: 'suggested'
    });
    
    // ถ้าเปิด auto-create
    if (config.autoCreateProducts) {
      const newProduct = await createProductFromSuggestion(suggestion);
      await updateSuggestion(suggestion.id, {
        product_id: newProduct.id,
        action_type: 'created'
      });
    }
    
    // แจ้งเตือน Admin
    await notifyAdmin({
      message: `พบสินค้าใหม่: ${item.product_name}`,
      suggestion_id: suggestion.id
    });
  }
}
```

---

### 3️⃣ คำถามด้านความฉลาดและอัตโนมัติ (Automation & Insights)

#### ❓ **Q5: ใช้ AI วิเคราะห์ประวัติเพื่อทำนาย Variance ได้หรือไม่?**

**คำตอบ: ✅ ได้! ใช้ตาราง `variance_analysis`**

**ตาราง:**
```sql
CREATE TABLE variance_analysis (
  id UUID PRIMARY KEY,
  product_id UUID,
  warehouse_id UUID,
  analysis_period_start DATE,
  analysis_period_end DATE,
  
  -- Statistics
  total_count_sessions INTEGER,
  variance_occurrences INTEGER,
  variance_frequency NUMERIC,        -- %
  
  -- Pattern Detection
  frequent_variance_pattern TEXT,
  typical_variance_amount NUMERIC,
  variance_trend TEXT,                -- 'increasing', 'decreasing', 'stable'
  
  -- Time-based Patterns
  high_variance_days TEXT[],          -- ['Saturday', 'Sunday']
  high_variance_periods TEXT[],      -- ['end_of_month']
  
  -- AI Predictions
  predicted_variance_probability NUMERIC,  -- 0-100
  predicted_variance_amount NUMERIC,
  prediction_confidence NUMERIC,           -- 0-100
  
  -- Recommendations
  recommendation TEXT,
  priority_level TEXT
);
```

**Algorithm:**
1. **Data Collection**: รวบรวมข้อมูลการนับสต๊อกย้อนหลัง 3-6 เดือน
2. **Pattern Analysis**: วิเคราะห์รูปแบบส่วนต่าง
   - วันที่มีส่วนต่างสูง (เช่น เสาร์-อาทิตย์)
   - ช่วงเวลาที่มีส่วนต่างสูง (เช่น สิ้นเดือน)
   - สินค้าที่มีส่วนต่างบ่อย
3. **ML Model**: ใช้ Simple ML หรือ Statistical Model
   - Linear Regression สำหรับทำนายจำนวนส่วนต่าง
   - Classification สำหรับทำนายความน่าจะเป็น
4. **Recommendations**: สร้างคำแนะนำอัตโนมัติ

**ตัวอย่าง:**
```typescript
// วิเคราะห์สินค้า
const analysis = await analyzeVariance({
  product_id: 'prod-123',
  warehouse_id: 'wh-001',
  period_start: '2025-08-01',
  period_end: '2026-01-31'
});

// ผลลัพธ์
{
  variance_frequency: 45.5,  // 45.5% ของครั้งที่นับมีส่วนต่าง
  variance_trend: 'increasing',
  high_variance_days: ['Saturday', 'Sunday'],
  high_variance_periods: ['end_of_month'],
  predicted_variance_probability: 68.5,
  predicted_variance_amount: 12.5,
  recommendation: 'ควรนับสต๊อกบ่อยขึ้นในช่วงวันหยุดและสิ้นเดือน',
  priority_level: 'high'
}

// ใช้ทำนายก่อนนับสต๊อก
const prediction = await predictVarianceForProduct('prod-123', 'wh-001');
if (prediction.predicted_variance_probability > 70) {
  // แจ้งเตือนให้ระวัง
  await notifyCounter({
    message: `สินค้านี้มีแนวโน้มเกิดส่วนต่างสูง (${prediction.predicted_variance_probability}%)`,
    recommendation: prediction.recommendation
  });
}
```

---

#### ❓ **Q6: ออกแบบ Data Transformer ให้ยืดหยุ่นอย่างไร?**

**คำตอบ: ใช้ Configuration-based Transformer**

**ตาราง:**
```sql
CREATE TABLE data_transformers (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,              -- 'SML Excel', 'ERP CSV'
  source_system TEXT,            -- 'SML', 'ERP', etc.
  file_format TEXT,               -- 'xlsx', 'csv', 'json'
  config JSONB                   -- Configuration
);
```

**Configuration Format:**
```json
{
  "column_mapping": {
    "product_code": "A",
    "product_name": "B",
    "quantity": "C",
    "unit": "D"
  },
  "skip_rows": 2,
  "date_format": "DD/MM/YYYY",
  "validation_rules": {
    "product_code": {
      "required": true,
      "pattern": "^[A-Z0-9-]+$"
    },
    "quantity": {
      "required": true,
      "type": "number",
      "min": 0
    }
  },
  "transformations": [
    {
      "field": "product_code",
      "type": "uppercase"
    },
    {
      "field": "quantity",
      "type": "round",
      "decimals": 2
    }
  ]
}
```

**ตัวอย่างการใช้งาน:**
```typescript
// สร้าง Transformer ใหม่
const transformer = await createDataTransformer({
  name: 'SML Excel Format 2026',
  source_system: 'SML',
  file_format: 'xlsx',
  config: {
    column_mapping: { /* ... */ },
    skip_rows: 2,
    validation_rules: { /* ... */ }
  }
});

// ใช้ Transformer Import ไฟล์
const result = await importFile(file, {
  transformer_id: transformer.id
});

// หรือใช้ default transformer
const result = await importFile(file, {
  source_system: 'SML',
  file_format: 'xlsx'
  // ระบบจะหา default transformer อัตโนมัติ
});
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SML Export File                           │
│              (Excel/CSV/JSON)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Transformer                                │
│  - Parse file based on config                                │
│  - Map columns                                               │
│  - Validate data                                             │
│  - Transform data                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Product Mapping Engine                               │
│  - Auto-map products                                         │
│  - Fuzzy matching                                            │
│  - Manual review queue                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Inventory Snapshot                                   │
│  - Store SML data at export time                            │
│  - Full audit trail                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Stock Count Session                                  │
│  - Link to snapshot                                         │
│  - Count items (Barcode/Manual)                             │
│  - Calculate variance                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Variance Analysis                                    │
│  - Auto-detect severity                                     │
│  - Under Review workflow                                     │
│  - AI predictions                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Approval & Adjustment                                │
│  - Admin review                                             │
│  - Auto-adjust inventory                                    │
│  - Create transactions                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Implementation Roadmap

### Phase 1: Core System (Week 1-2)
- [x] Database schema
- [ ] Stock Count Session UI
- [ ] Barcode scanning
- [ ] Basic variance calculation

### Phase 2: SML Integration (Week 3-4)
- [ ] File import (Excel/CSV)
- [ ] Data transformer
- [ ] Product mapping
- [ ] Snapshot creation

### Phase 3: Advanced Features (Week 5-6)
- [ ] Under Review workflow
- [ ] Auto-create products
- [ ] Variance analysis
- [ ] AI predictions

### Phase 4: Mobile & Optimization (Week 7-8)
- [ ] Mobile app for counting
- [ ] Offline support
- [ ] Performance optimization
- [ ] Reports & Analytics

---

## 🔐 Security & Permissions

- **Admin/Manager**: Full access
- **Inspector**: Can create sessions, count items, review variances
- **User/Driver**: Can count items (read-only for sessions)
- **View-only**: All authenticated users can view

---

## 📊 Key Metrics

- **Counting Speed**: Target < 2 seconds per item (with barcode)
- **Variance Detection**: Real-time calculation
- **Approval Time**: Average < 5 minutes for review
- **Data Accuracy**: 99.9%+ with barcode scanning

---

## 🚀 Next Steps

1. Review and approve schema
2. Create TypeScript types
3. Build UI components
4. Implement services
5. Test with real SML data
