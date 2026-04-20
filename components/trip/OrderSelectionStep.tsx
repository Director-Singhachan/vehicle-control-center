import React from 'react';
import { Package, MapPin, Calendar, GripVertical, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { StoreDelivery } from '../../types/createTripWizard';

export interface OrderSelectionStepProps {
  storeDeliveries: StoreDelivery[];
  orderItemsMap: Map<string, any[]>;
  expandedStores: Set<string>;
  toggleExpandedStore: (deliveryId: string) => void;
  splitKey: (orderId: string, itemId: string) => string;
  getRemaining: (item: any) => number;
  splitIntoTwoTrips: boolean;
  splitIntoThreeTrips?: boolean;
  itemSplitMap: Record<string, { vehicle1Qty: number; vehicle2Qty: number; trip1Qty?: number; trip2Qty?: number; trip3Qty?: number }>;
  handleSplitQtyChange: (orderId: string, itemId: string, target: 1 | 2 | 3, value: number, totalQty: number) => void;
  quantityInThisTripMap: Record<string, number>;
  setQuantityInThisTripMapForKey: (key: string, value: number) => void;
  setAllQuantityInThisTripForDelivery: (orderId: string, orderItems: any[], value: 'all' | 'none') => void;
  setAllSplitForDelivery: (orderId: string, orderItems: any[], target: 'vehicle1' | 'vehicle2' | 'vehicle3' | 'half') => void;
  splitValidationErrors: string[];
  draggedIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleRemoveDelivery: (id: string) => void;
}

export function OrderSelectionStep({
  storeDeliveries,
  orderItemsMap,
  expandedStores,
  toggleExpandedStore,
  splitKey: splitKeyFn,
  getRemaining,
  splitIntoTwoTrips,
  splitIntoThreeTrips = false,
  itemSplitMap,
  handleSplitQtyChange,
  quantityInThisTripMap,
  setQuantityInThisTripMapForKey,
  setAllQuantityInThisTripForDelivery,
  setAllSplitForDelivery,
  splitValidationErrors,
  draggedIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleRemoveDelivery,
}: OrderSelectionStepProps) {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            ลำดับการจัดส่ง ({storeDeliveries.length} จุด)
          </h3>
          <p className="text-sm text-gray-500">
            ลากเพื่อจัดเรียงลำดับ
          </p>
        </div>
        {storeDeliveries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>ไม่มีร้านค้าในรายการ</p>
          </div>
        ) : (
          <div className="space-y-3">
            {storeDeliveries.map((delivery, index) => {
              const orderItems = orderItemsMap.get(delivery.order_id) || [];
              const isExpanded = expandedStores.has(delivery.id);

              return (
                <div
                  key={delivery.id}
                  className={`bg-white border-2 rounded-xl hover:shadow-md transition-all ${draggedIndex === index ? 'opacity-50 border-blue-500' : 'border-gray-200'}`}
                >
                  <div
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-4 p-4 cursor-move"
                  >
                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                      {delivery.sequence}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 truncate">{delivery.store_name}</p>
                        <Badge variant="info" className="text-xs flex-shrink-0">
                          {delivery.order_number || 'รอจัดทริป'}
                        </Badge>
                        {delivery.related_prior_order_id ? (
                          <Badge variant="warning" className="text-xs flex-shrink-0 ring-1 ring-amber-400/80 dark:ring-amber-600 dark:bg-amber-900/40">
                            เชื่อมบิลเดิม
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-1">{delivery.address || 'ไม่มีที่อยู่'}</p>
                      </div>
                      {delivery.delivery_date && (
                        <div className="flex items-center gap-2 text-sm mt-1">
                          <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
                          <span className="font-medium text-orange-600">
                            นัดส่ง: {new Date(delivery.delivery_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-blue-600">
                        {new Intl.NumberFormat('th-TH').format(delivery.total_amount)} ฿
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpandedStore(delivery.id);
                      }}
                      className="flex-shrink-0 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      title="ดูรายการสินค้า"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleRemoveDelivery(delivery.id)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {isExpanded && orderItems.length > 0 && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {!splitIntoTwoTrips && !splitIntoThreeTrips && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                          <strong>เลือกสินค้าที่นำไปส่งในทริปนี้:</strong> ตั้งคอลัมน์ &quot;นำไปส่งในทริปนี้&quot; = 0 สำหรับสินค้าที่จะจัดส่งทริปอื่น (วันอื่น/รถคันอื่น) ออเดอร์เดียวกันแยกส่งหลายทริปได้
                        </p>
                      )}
                      <table className="w-full text-sm mt-3">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="pb-2 font-medium">สินค้า</th>
                            <th className="pb-2 font-medium text-center">สั่ง</th>
                            {!splitIntoTwoTrips && !splitIntoThreeTrips && (
                              <>
                                <th className="pb-2 font-medium text-center">รับที่ร้าน</th>
                                <th className="pb-2 font-medium text-center">ส่งแล้ว</th>
                                <th className="pb-2 font-medium text-center">คงเหลือ</th>
                                <th className="pb-2 font-medium text-center">นำไปส่งในทริปนี้</th>
                              </>
                            )}
                            {splitIntoTwoTrips && !splitIntoThreeTrips && (
                              <>
                                <th className="pb-2 font-medium text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800">คัน 1</span>
                                </th>
                                <th className="pb-2 font-medium text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">คัน 2</span>
                                </th>
                                <th className="pb-2 font-medium text-center">ตรวจ</th>
                              </>
                            )}
                            {splitIntoThreeTrips && (
                              <>
                                <th className="pb-2 font-medium text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800">เที่ยว 1</span>
                                </th>
                                <th className="pb-2 font-medium text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800">เที่ยว 2</span>
                                </th>
                                <th className="pb-2 font-medium text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">เที่ยว 3</span>
                                </th>
                                <th className="pb-2 font-medium text-center">ตรวจ</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item: any) => {
                            const key = splitKeyFn(delivery.order_id, item.id);
                            const remaining = getRemaining(item);
                            const qtyInTrip = quantityInThisTripMap[key] ?? remaining;
                            const split = itemSplitMap[key] || { vehicle1Qty: remaining, vehicle2Qty: 0, trip1Qty: remaining, trip2Qty: 0, trip3Qty: 0 };
                            const sum = splitIntoThreeTrips
                              ? ((split.trip1Qty ?? 0) + (split.trip2Qty ?? 0) + (split.trip3Qty ?? 0))
                              : (split.vehicle1Qty + split.vehicle2Qty);
                            const sumOk = Math.abs(sum - remaining) < 0.001;
                            return (
                              <tr key={item.id} className="border-t border-gray-50">
                                <td className="py-2">
                                  <div className="font-medium text-gray-900 dark:text-white">{item.product?.product_name || item.product_name || item.product?.product_code || item.product_code || 'N/A'}</div>
                                  {item.product?.product_code && <div className="text-xs text-gray-500 dark:text-gray-400">{item.product.product_code}</div>}
                                  {item.is_bonus && <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">แถม</span>}
                                  {Number(item.quantity_fulfilled_prior_bill ?? 0) > 0 && (
                                    <div className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                                      เครดิตจากบิลก่อน {Number(item.quantity_fulfilled_prior_bill).toLocaleString('th-TH')}{' '}
                                      {(item.unit || item.product?.unit) || ''}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 text-center font-semibold text-gray-700">
                                  <span>{item.quantity}</span>
                                  {(item.unit || item.product?.unit) ? (
                                    <span className="block text-xs font-normal text-gray-500">{item.unit || item.product?.unit}</span>
                                  ) : null}
                                </td>
                                {!splitIntoTwoTrips && !splitIntoThreeTrips && (
                                  <>
                                    <td className="py-2 text-center text-gray-600">
                                      {Number(item.quantity_picked_up_at_store ?? 0)}
                                    </td>
                                    <td className="py-2 text-center text-gray-600">
                                      {Number(item.quantity_delivered ?? 0)}
                                    </td>
                                    <td className="py-2 text-center font-medium text-slate-700">
                                      {remaining}
                                    </td>
                                    <td className="py-2 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={remaining}
                                        step="any"
                                        value={qtyInTrip}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                          const v = parseFloat(e.target.value) || 0;
                                          setQuantityInThisTripMapForKey(key, Math.max(0, Math.min(remaining, v)));
                                        }}
                                        className="w-20 px-2 py-1 text-center border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 bg-amber-50 font-medium"
                                        title="ตั้ง 0 = ไม่นำไปทริปนี้ (จัดส่งทริปอื่นภายหลัง)"
                                      />
                                    </td>
                                  </>
                                )}
                                {(splitIntoTwoTrips || splitIntoThreeTrips) && (
                                  <>
                                    <td className="py-2 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={remaining}
                                        step="any"
                                        value={splitIntoThreeTrips ? (split.trip1Qty ?? 0) : split.vehicle1Qty}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleSplitQtyChange(delivery.order_id, item.id, 1, parseFloat(e.target.value) || 0, remaining)}
                                        className={`w-16 px-2 py-1 text-center rounded-lg text-sm focus:ring-2 ${splitIntoThreeTrips ? 'border border-blue-300 focus:ring-blue-500 bg-blue-50' : 'border border-blue-300 focus:ring-blue-500 bg-blue-50'}`}
                                      />
                                    </td>
                                    <td className="py-2 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={remaining}
                                        step="any"
                                        value={splitIntoThreeTrips ? (split.trip2Qty ?? 0) : split.vehicle2Qty}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleSplitQtyChange(delivery.order_id, item.id, 2, parseFloat(e.target.value) || 0, remaining)}
                                        className={`w-16 px-2 py-1 text-center rounded-lg text-sm focus:ring-2 ${splitIntoThreeTrips ? 'border border-amber-300 focus:ring-amber-500 bg-amber-50' : 'border border-emerald-300 focus:ring-emerald-500 bg-emerald-50'}`}
                                      />
                                    </td>
                                    {splitIntoThreeTrips && (
                                      <td className="py-2 text-center">
                                        <input
                                          type="number"
                                          min={0}
                                          max={remaining}
                                          step="any"
                                          value={split.trip3Qty ?? 0}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => handleSplitQtyChange(delivery.order_id, item.id, 3, parseFloat(e.target.value) || 0, remaining)}
                                          className="w-16 px-2 py-1 text-center border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-emerald-50"
                                        />
                                      </td>
                                    )}
                                    <td className="py-2 text-center">
                                      {sumOk ? (
                                        <span className="text-green-600 font-bold text-base">&#10003;</span>
                                      ) : (
                                        <span className="text-red-600 font-bold text-base" title={`รวม ${sum} ≠ คงเหลือ ${remaining}`}>&#10007;</span>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!splitIntoTwoTrips && !splitIntoThreeTrips && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAllQuantityInThisTripForDelivery(delivery.order_id, orderItems, 'all')}
                            className="text-xs px-3 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            ทั้งหมดนำไปทริปนี้
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllQuantityInThisTripForDelivery(delivery.order_id, orderItems, 'none')}
                            className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            ไม่นำไปทริปนี้ (ส่งทริปอื่น)
                          </button>
                        </div>
                      )}
                      {(splitIntoTwoTrips || splitIntoThreeTrips) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setAllSplitForDelivery(delivery.order_id, orderItems, 'vehicle1')}
                            className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            ทั้งหมดไป{splitIntoThreeTrips ? 'เที่ยว 1' : 'คัน 1'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllSplitForDelivery(delivery.order_id, orderItems, 'vehicle2')}
                            className="text-xs px-3 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            ทั้งหมดไป{splitIntoThreeTrips ? 'เที่ยว 2' : 'คัน 2'}
                          </button>
                          {splitIntoThreeTrips && (
                            <button
                              type="button"
                              onClick={() => setAllSplitForDelivery(delivery.order_id, orderItems, 'vehicle3')}
                              className="text-xs px-3 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                              ทั้งหมดไปเที่ยว 3
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAllSplitForDelivery(delivery.order_id, orderItems, 'half')}
                            className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            {splitIntoThreeTrips ? 'แบ่งเท่าๆ' : 'แบ่งครึ่ง'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isExpanded && orderItems.length > 0 && (
                    <div className="px-4 pb-3 text-xs text-gray-400">
                      {orderItems.length} รายการสินค้า — คลิก &#9660; เพื่อดูรายละเอียด
                      {splitIntoTwoTrips && (() => {
                        const v2Count = orderItems.filter((item: any) => {
                          const key = splitKeyFn(delivery.order_id, item.id);
                          return (itemSplitMap[key]?.vehicle2Qty ?? 0) > 0;
                        }).length;
                        return v2Count > 0 ? (
                          <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                            {v2Count} รายการแบ่งไปคัน 2
                          </span>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(splitIntoTwoTrips || splitIntoThreeTrips) && splitValidationErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <AlertTriangle size={16} />
              <span className="font-medium text-sm">จำนวนแบ่งไม่ตรง:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
              {splitValidationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
