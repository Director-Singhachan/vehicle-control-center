/**
 * สถานะออเดอร์บน UI — คำนวณจาก orders.status + delivery_trips.status + delivery_trip_id
 * (ใช้ร่วมกับ TrackOrdersView / การ์ดรอจัดทริป / คิวส่งไม่ครบ)
 */

export type EffectiveOrderUiStatus =
  | 'pending'
  | 'partial'
  | 'assigned'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled'
  | string;

export interface OrderEffectiveStatusInput {
  status?: string | null;
  delivery_trip_id?: string | null;
  trip_status?: string | null;
}

export function getEffectiveOrderUiStatus(order: OrderEffectiveStatusInput): EffectiveOrderUiStatus {
  const baseStatus = (order.status || '').toLowerCase();
  const tripStatus = order.trip_status || null;
  const hasTrip = !!order.delivery_trip_id;

  if (baseStatus === 'cancelled') return 'cancelled';

  if (!hasTrip) {
    if (baseStatus === 'delivered' || baseStatus === 'partial') return baseStatus;
    return 'pending';
  }

  switch (tripStatus) {
    case 'planned':
      return 'assigned';
    case 'in_progress':
      return 'in_delivery';
    case 'completed':
      if (baseStatus === 'delivered' || baseStatus === 'partial') return baseStatus;
      return 'delivered';
    case 'cancelled':
      return 'pending';
    default:
      if (['pending', 'confirmed', 'assigned', 'in_delivery', 'delivered', 'partial'].includes(baseStatus)) {
        return baseStatus;
      }
      return 'pending';
  }
}
