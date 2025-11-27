# การใช้งาน Fuel Efficiency Alerts Components

## 📋 Overview

Components สำหรับแสดงการแจ้งเตือนประสิทธิภาพน้ำมันของรถที่ลดลงมากกว่า 20% จากค่าเฉลี่ยปกติ

## 🎨 Components

### 1. `FuelEfficiencyAlerts`

Component หลักสำหรับแสดงรายการ alerts ทั้งหมด

**Props:**
- `maxItems?: number` - จำนวน alerts สูงสุดที่จะแสดง (ถ้าไม่ระบุจะแสดงทั้งหมด)
- `showHeader?: boolean` - แสดง header หรือไม่ (default: true)
- `onVehicleClick?: (vehicleId: string) => void` - callback เมื่อคลิกที่รถ

**ตัวอย่างการใช้งาน:**

```tsx
import { FuelEfficiencyAlerts } from '../components/FuelEfficiencyAlerts';

// แสดงทั้งหมด
<FuelEfficiencyAlerts />

// แสดงแค่ 5 รายการแรก
<FuelEfficiencyAlerts maxItems={5} />

// ไม่แสดง header และมี callback เมื่อคลิก
<FuelEfficiencyAlerts 
  showHeader={false}
  onVehicleClick={(vehicleId) => {
    // Navigate to vehicle detail
    navigate(`/vehicles/${vehicleId}`);
  }}
/>
```

### 2. `FuelEfficiencyAlertsWidget`

Widget สำหรับแสดงใน Dashboard (แสดงเป็น StatusCard)

**Props:**
- `onViewAll?: () => void` - callback เมื่อต้องการดูทั้งหมด

**ตัวอย่างการใช้งาน:**

```tsx
import { FuelEfficiencyAlertsWidget } from '../components/FuelEfficiencyAlertsWidget';

// ใน Dashboard
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <FuelEfficiencyAlertsWidget 
    onViewAll={() => setActiveTab('fuel-alerts')}
  />
  {/* Other cards... */}
</div>
```

## 📊 ข้อมูลที่แสดง

แต่ละ Alert Card จะแสดง:

1. **ข้อมูลรถ**
   - ทะเบียนรถ
   - ยี่ห้อและรุ่น

2. **ประสิทธิภาพน้ำมัน**
   - ประสิทธิภาพปัจจุบัน (km/L)
   - ค่าเฉลี่ยปกติ (km/L)
   - เปอร์เซ็นต์ที่ลดลง

3. **ระดับความรุนแรง**
   - 🟡 **ควรตรวจสอบ** (20-29%): สี amber
   - 🟠 **รุนแรง** (30-39%): สี orange
   - 🔴 **วิกฤต** (≥40%): สี red

4. **วันที่เติมน้ำมันล่าสุด**

## 🎯 ตัวอย่างการใช้งานในหน้า Reports

```tsx
import { FuelEfficiencyAlerts } from '../components/FuelEfficiencyAlerts';
import { PageLayout } from '../components/layout/PageLayout';

export const FuelReportsView = () => {
  return (
    <PageLayout
      title="รายงานประสิทธิภาพน้ำมัน"
      subtitle="การแจ้งเตือนและสถิติการใช้น้ำมัน"
    >
      <div className="space-y-6">
        {/* Alerts Section */}
        <FuelEfficiencyAlerts 
          onVehicleClick={(vehicleId) => {
            // Navigate to vehicle detail
            console.log('View vehicle:', vehicleId);
          }}
        />
        
        {/* Other reports... */}
      </div>
    </PageLayout>
  );
};
```

## 🎨 Customization

### สีตามระดับความรุนแรง

Component จะใช้สีอัตโนมัติตามเปอร์เซ็นต์ที่ลดลง:

- **20-29%**: Amber (ควรตรวจสอบ)
- **30-39%**: Orange (รุนแรง)
- **≥40%**: Red (วิกฤต)

### Empty State

เมื่อไม่มี alerts จะแสดง:
- Icon: Droplet (สีเขียว)
- ข้อความ: "ไม่มีการแจ้งเตือน"
- คำอธิบาย: "รถทั้งหมดมีประสิทธิภาพน้ำมันอยู่ในเกณฑ์ปกติ"

## 🔄 Auto Refresh

Components จะ refresh ข้อมูลอัตโนมัติ:
- Cache 5 นาที
- Background refresh เมื่อมี cached data
- Manual refresh ผ่านปุ่ม "รีเฟรช"

## 📝 Notes

- ต้องมีข้อมูลอย่างน้อย 2 เดือนเพื่อเปรียบเทียบ
- คำนวณจากค่าเฉลี่ยของเดือนก่อนหน้า (ไม่รวมเดือนล่าสุด)
- แสดงเฉพาะรถที่มีประสิทธิภาพลดลง ≥20%

