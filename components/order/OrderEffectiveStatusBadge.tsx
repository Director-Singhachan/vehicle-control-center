import React from 'react';
import { Badge } from '../ui/Badge';
import { getEffectiveOrderUiStatus } from '../../utils/orderEffectiveStatus';

export interface OrderEffectiveStatusBadgeProps {
  order: {
    status?: string | null;
    delivery_trip_id?: string | null;
    trip_status?: string | null;
  };
  className?: string;
}

/**
 * สถานะการจัดส่งตามทริป (เดียวกับคอลัมน์สถานะในติดตามออเดอร์)
 */
export const OrderEffectiveStatusBadge: React.FC<OrderEffectiveStatusBadgeProps> = ({ order, className = '' }) => {
  const status = getEffectiveOrderUiStatus(order);
  const deliveryTripId = order.delivery_trip_id;

  if (status === 'assigned' && !deliveryTripId) {
    return (
      <Badge variant="warning" className={`dark:bg-amber-900/40 dark:text-amber-200 ${className}`}>
        รอจัดทริป
      </Badge>
    );
  }

  switch (status) {
    case 'pending':
      return (
        <Badge variant="warning" className={`dark:bg-amber-900/40 dark:text-amber-200 ${className}`}>
          รอจัดทริป
        </Badge>
      );
    case 'partial':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 ${className}`}
        >
          ⏳ ส่งบางส่วน
        </span>
      );
    case 'assigned':
      return (
        <Badge variant="info" className={`dark:bg-blue-900/40 dark:text-blue-200 ${className}`}>
          กำหนดทริปแล้ว
        </Badge>
      );
    case 'in_delivery':
      return (
        <Badge variant="default" className={`dark:bg-slate-700 dark:text-slate-100 ${className}`}>
          กำลังจัดส่ง
        </Badge>
      );
    case 'delivered':
      return !deliveryTripId ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 ${className}`}
        >
          ✓ จัดส่งสำเร็จ มารับเอง
        </span>
      ) : (
        <Badge variant="success" className={`dark:bg-green-900/40 dark:text-green-200 ${className}`}>
          จัดส่งแล้ว
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="error" className={`dark:bg-red-900/40 dark:text-red-200 ${className}`}>
          ยกเลิก
        </Badge>
      );
    default:
      return <Badge className={`dark:bg-charcoal-700 dark:text-slate-200 ${className}`}>{status}</Badge>;
  }
};
