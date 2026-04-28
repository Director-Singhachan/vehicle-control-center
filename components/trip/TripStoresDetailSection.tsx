import React from 'react';
import { MapPin, Plus, Store } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import type { PickupEntry } from '../../hooks/useDeliveryTripDetail';

interface TripStoresDetailSectionProps {
  trip: any;
  pickupBreakdown: PickupEntry[];
  onAddStore?: () => void;
}

function getDeliveryStatusLabel(rawStatus: string, tripStatus: string) {
  const effectiveStatus =
    rawStatus === 'pending' && tripStatus === 'completed' ? 'delivered' : rawStatus;

  if (effectiveStatus === 'delivered')
    return {
      label: 'ส่งแล้ว',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200',
    };
  if (effectiveStatus === 'failed')
    return {
      label: 'ส่งไม่สำเร็จ',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
    };
  return {
    label: 'รอส่ง',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200',
  };
}

export const TripStoresDetailSection: React.FC<TripStoresDetailSectionProps> = ({
  trip,
  pickupBreakdown,
  onAddStore,
}) => {
  const stores = (trip.stores || []).slice().sort(
    (a: any, b: any) => a.sequence_order - b.sequence_order,
  );

  const pickupMap = new Map(pickupBreakdown.map((p) => [p.order_id, p]));

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader
          title={`ร้านค้าในทริป (${stores.length} ร้าน)`}
          action={
            onAddStore &&
            (trip.status === 'planned' || trip.status === 'in_progress') ? (
              <Button variant="outline" size="sm" onClick={onAddStore}>
                <Plus size={15} className="mr-1.5" />
                เพิ่มร้าน
              </Button>
            ) : undefined
          }
        />

        {stores.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
            ยังไม่มีร้านค้าในทริปนี้
          </p>
        ) : (
          <div className="space-y-4">
            {stores.map((storeWithDetails: any) => {
              const store = storeWithDetails.store;
              if (!store) return null;

              const { label, className } = getDeliveryStatusLabel(
                storeWithDetails.delivery_status || 'pending',
                trip.status,
              );

              return (
                <div
                  key={storeWithDetails.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                >
                  {/* Store header */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-enterprise-100 dark:bg-enterprise-900/60 text-enterprise-600 dark:text-enterprise-400 font-semibold text-sm">
                      {storeWithDetails.sequence_order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {store.customer_code} — {store.customer_name}
                      </div>
                      {store.address && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={11} />
                          {store.address}
                        </div>
                      )}
                      {store.phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          โทร: {store.phone}
                        </div>
                      )}
                    </div>
                    {storeWithDetails.delivery_status && (
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
                        {label}
                      </span>
                    )}
                  </div>

                  {/* Items */}
                  {storeWithDetails.items && storeWithDetails.items.length > 0 && (
                    <div className="mt-2 pl-11">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        สินค้า ({storeWithDetails.items.length} รายการ)
                      </div>
                      <div className="space-y-1">
                        {storeWithDetails.items.map((item: any) => {
                          const product = item.product;
                          if (!product) return null;
                          const qty = Number(item.quantity) || 0;
                          const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
                          const displayUnit =
                            item.unit != null && String(item.unit).trim() !== ''
                              ? String(item.unit).trim()
                              : product.unit || '';

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div className="flex-1 min-w-0 text-slate-600 dark:text-slate-400">
                                <span className="text-slate-400 mr-1">•</span>
                                {product.product_code} — {product.product_name}
                                {item.is_bonus && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200">
                                    ของแถม
                                  </span>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {qty.toLocaleString()} {displayUnit}
                                </span>
                                {pickedUp > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                                    <Store size={9} />
                                    รับที่ร้าน {pickedUp.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pickup breakdown note */}
      {pickupBreakdown.length > 0 && (
        <Card>
          <CardHeader
            title="หมายเหตุ: ลูกค้ามารับสินค้าที่ร้านแล้ว"
            subtitle="ลูกค้ารายต่อไปนี้มารับสินค้าที่หน้าร้านไปแล้ว — ใช้เป็นคู่มือเวลาจัดส่งหรือออกบิล"
          />
          <div className="space-y-3">
            {pickupBreakdown.map((entry) => {
              const isPickupEntry = pickupMap.has(entry.order_id);
              if (!isPickupEntry) return null;

              return (
                <div
                  key={entry.order_id}
                  className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                    {entry.customer_code} — {entry.store_name}
                    {entry.order_number && (
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                        (ออเดอร์ #{entry.order_number})
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {entry.items.map((it, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-slate-400">•</span>
                        {it.product_code} — {it.product_name}: {it.quantity_picked_up.toLocaleString('th-TH')} {it.unit}
                        {it.is_bonus && (
                          <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px]">
                            ของแถม
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
