import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  description: string;
}

interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
}

const ERPNavigation: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const navSections: NavSection[] = [
    {
      title: 'การเงิน (Financial)',
      icon: '💰',
      items: [
        {
          label: 'สมุดรายวัน',
          path: '/financial/journal-entries',
          icon: '📓',
          description: 'บันทึกรายการบัญชี'
        },
        {
          label: 'ใบแจ้งหนี้',
          path: '/financial/invoices',
          icon: '📄',
          description: 'จัดการใบแจ้งหนี้ลูกค้า'
        },
        {
          label: 'รายงานการเงิน',
          path: '/financial/reports',
          icon: '📊',
          description: 'ยอดทดลอง, ลูกหนี้, ค่าใช้จ่าย'
        }
      ]
    },
    {
      title: 'การจัดซื้อ (Purchase)',
      icon: '🛒',
      items: [
        {
          label: 'ผู้ขาย',
          path: '/purchase/suppliers',
          icon: '🏢',
          description: 'จัดการข้อมูลผู้ขาย'
        },
        {
          label: 'ใบสั่งซื้อ',
          path: '/purchase/orders',
          icon: '📋',
          description: 'สร้างและจัดการใบสั่งซื้อ'
        },
        {
          label: 'ใบรับสินค้า',
          path: '/purchase/receipts',
          icon: '📦',
          description: 'บันทึกการรับสินค้า'
        },
        {
          label: 'เจ้าหนี้',
          path: '/purchase/payables',
          icon: '💳',
          description: 'จัดการใบแจ้งหนี้จากผู้ขาย'
        }
      ]
    },
    {
      title: 'ทรัพยากรบุคคล (HR)',
      icon: '👥',
      items: [
        {
          label: 'พนักงาน',
          path: '/hr/employees',
          icon: '👤',
          description: 'จัดการข้อมูลพนักงาน'
        },
        {
          label: 'เงินเดือน',
          path: '/hr/payroll',
          icon: '💵',
          description: 'จัดการเงินเดือนและค่าจ้าง'
        },
        {
          label: 'การลา',
          path: '/hr/leaves',
          icon: '📅',
          description: 'จัดการการลางาน'
        },
        {
          label: 'การเข้างาน',
          path: '/hr/attendance',
          icon: '✓',
          description: 'บันทึกการเข้างาน'
        },
        {
          label: 'ประเมินผล',
          path: '/hr/performance',
          icon: '⭐',
          description: 'ประเมินผลการทำงาน'
        }
      ]
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">ERP Modules</h2>

      <div className="space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="border rounded-lg">
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === section.title ? null : section.title
                )
              }
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                <span className="font-semibold text-gray-900">{section.title}</span>
              </div>
              <span
                className={`transform transition ${
                  expandedSection === section.title ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {expandedSection === section.title && (
              <div className="border-t bg-gray-50 p-4 space-y-2">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="block p-3 rounded-lg hover:bg-white hover:shadow-sm transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-1">{item.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.label}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <div className="text-xs text-gray-600">ใบสั่งซื้อค้างอนุมัติ</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">0</div>
            <div className="text-xs text-gray-600">ลูกหนี้ค้างชำระ</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">0</div>
            <div className="text-xs text-gray-600">เจ้าหนี้ค้างชำระ</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ERPNavigation;
