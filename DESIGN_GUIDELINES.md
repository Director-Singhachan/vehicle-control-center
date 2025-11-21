# Design Guidelines - มาตรฐานการออกแบบ UI

เอกสารนี้กำหนดมาตรฐานการออกแบบ UI สำหรับแอปพลิเคชัน Vehicle Control Center เพื่อให้ทุกหน้าสอดคล้องกัน

## 🎨 Design System

### สีหลัก (Colors)

- **Enterprise Blue**: สีหลักของแอป (`enterprise-600: #0284c7`)
- **Charcoal**: สีพื้นหลังสำหรับ dark mode (`charcoal-800: #1e293b`)
- **Neon Blue**: สี accent สำหรับ dark mode (`neon-blue: #3b82f6`)

### Typography

- **Font Family**: Inter (sans-serif)
- **Headings**: 
  - Page Title: `text-2xl font-bold`
  - Section Title: `text-lg font-semibold`
  - Card Title: `text-base font-medium`

### Spacing

ใช้ spacing ที่กำหนดไว้ใน `designTokens.ts`:
- `xs`: 8px
- `sm`: 12px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px

### Border Radius

- Cards: `rounded-xl` (12px)
- Buttons: `rounded-lg` (8px)
- Inputs: `rounded-lg` (8px)

## 📦 Components ที่ใช้ซ้ำได้

### 1. Button

```tsx
import { Button } from '../components/ui/Button';

<Button variant="primary" size="md">Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="danger">Delete</Button>
<Button isLoading={true}>Loading...</Button>
```

**Variants:**
- `primary`: สีหลัก (enterprise blue)
- `secondary`: สีรอง (gray)
- `outline`: แบบ outline
- `danger`: สีแดงสำหรับการลบ

**Sizes:**
- `sm`: เล็ก
- `md`: ปานกลาง (default)
- `lg`: ใหญ่

### 2. Card

```tsx
import { Card, CardHeader, CardContent } from '../components/ui/Card';

<Card hover={true} padding="md">
  <CardHeader title="Title" subtitle="Subtitle" action={<Button>Action</Button>} />
  <CardContent>
    Content here
  </CardContent>
</Card>
```

### 3. Input

```tsx
import { Input } from '../components/ui/Input';

<Input 
  label="Email" 
  type="email" 
  placeholder="Enter email"
  error="This field is required"
/>
```

### 4. PageLayout

```tsx
import { PageLayout } from '../components/layout/PageLayout';

<PageLayout
  title="Page Title"
  subtitle="Page description"
  actions={<Button>Action</Button>}
  loading={isLoading}
  error={hasError}
  onRetry={handleRetry}
>
  {/* Page content */}
</PageLayout>
```

## 📄 การสร้างหน้าใหม่

### ขั้นตอนการสร้างหน้าใหม่:

1. **สร้างไฟล์ใน `views/`**
   ```tsx
   // views/VehiclesView.tsx
   import { PageLayout } from '../components/layout/PageLayout';
   import { Card } from '../components/ui/Card';
   import { Button } from '../components/ui/Button';
   
   export const VehiclesView: React.FC<{ isDark: boolean }> = ({ isDark }) => {
     return (
       <PageLayout
         title="Vehicles"
         subtitle="Manage your fleet"
         actions={<Button>Add Vehicle</Button>}
       >
         {/* Content */}
       </PageLayout>
     );
   };
   ```

2. **เพิ่ม route ใน `index.tsx`**
   ```tsx
   import { VehiclesView } from './views/VehiclesView';
   
   {activeTab === 'vehicles' ? (
     <VehiclesView isDark={isDark} />
   ) : (
     // ...
   )}
   ```

## 🎯 Best Practices

### 1. ใช้ Design Tokens
- ✅ ใช้ค่าจาก `theme/designTokens.ts`
- ❌ อย่า hardcode สีหรือ spacing

### 2. ใช้ Reusable Components
- ✅ ใช้ `Button`, `Card`, `Input` จาก `components/ui/`
- ❌ อย่าสร้าง component ใหม่ที่ทำหน้าที่เหมือนกัน

### 3. ใช้ PageLayout
- ✅ ใช้ `PageLayout` สำหรับทุกหน้า
- ✅ ใช้ `PageHeader` สำหรับ header ที่สอดคล้องกัน

### 4. Dark Mode Support
- ✅ ใช้ `dark:` prefix สำหรับ dark mode styles
- ✅ ทดสอบทั้ง light และ dark mode

### 5. Responsive Design
- ✅ ใช้ Tailwind responsive classes (`md:`, `lg:`)
- ✅ ทดสอบบนหน้าจอขนาดต่างๆ

## 📋 Checklist สำหรับหน้าใหม่

- [ ] ใช้ `PageLayout` wrapper
- [ ] ใช้ `Button`, `Card`, `Input` จาก `components/ui/`
- [ ] รองรับ dark mode
- [ ] Responsive design
- [ ] ใช้ spacing และ colors จาก design tokens
- [ ] มี loading และ error states

## 🔍 ตัวอย่างการใช้งาน

ดูตัวอย่างการใช้งานได้ที่:
- `views/DashboardView.tsx` - ตัวอย่างการใช้งาน PageLayout และ Cards
- `components/StatusCard.tsx` - ตัวอย่าง custom card component

