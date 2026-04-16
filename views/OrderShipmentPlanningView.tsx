import React, { useMemo } from 'react';
import { ArrowLeft, Package, Truck, User, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { useOrderShipmentPlanning } from '../hooks/useOrderShipmentPlanning';

interface OrderShipmentPlanningViewProps {
  orderId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function OrderShipmentPlanningView({ orderId, onBack, onSuccess }: OrderShipmentPlanningViewProps) {
  const { toasts, dismissToast } = useToast();

  const {
    orderDetail,
    legItems,
    loading,
    submitting,
    drivers,
    filteredVehicles,
    vehiclesLoading,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedDriverId,
    setSelectedDriverId,
    tripDate,
    setTripDate,
    notes,
    setNotes,
    setLegQty,
    totalLegQty,
    isValid,
    handleSubmit,
  } = useOrderShipmentPlanning(orderId, onSuccess);

  const selectedVehicle = useMemo(
    () => filteredVehicles.find((v: any) => v.id === selectedVehicleId),
    [filteredVehicles, selectedVehicleId]
  );

  const formattedOrderDate = orderDetail?.order_date
    ? new Date(orderDetail.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout
        title="สร้างทริปถัดไปจากสินค้าคงเหลือ"
        actions={
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ย้อนกลับ
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Order info + item selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Order summary card */}
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-enterprise-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {orderDetail?.order_number || '(ไม่มีเลข)'}
                      </span>
                      <Badge variant="warning">ส่งไม่ครบ</Badge>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {orderDetail?.customer_name || orderDetail?.store_name || '-'}
                    </p>
                    {orderDetail?.delivery_address && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {orderDetail.delivery_address}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      วันที่ออเดอร์: {formattedOrderDate}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Item quantity selector */}
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-enterprise-500" />
                  เลือกสินค้าที่จะนำไปส่งในทริปนี้
                </h3>

                {legItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                    <p>สินค้าทั้งหมดถูกจัดทริปครบแล้ว</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-charcoal-700">
                          <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                            สินค้า
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            คงเหลือ
                          </th>
                          <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            ทริปนี้
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-charcoal-800">
                        {legItems.map((item) => (
                          <tr key={item.order_item_id}>
                            <td className="py-2.5 pr-4">
                              <div className="font-medium text-gray-900 dark:text-white leading-snug">
                                {item.product_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{item.product_code}</div>
                            </td>
                            <td className="text-right py-2.5 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {item.remaining_unallocated.toLocaleString('th-TH')} {item.unit}
                            </td>
                            <td className="py-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                max={item.remaining_unallocated}
                                value={item.quantity_for_this_leg === '' ? '' : item.quantity_for_this_leg}
                                onChange={(e) => setLegQty(item.order_item_id, e.target.value)}
                                className="w-24 text-right px-2 py-1 border border-gray-300 dark:border-charcoal-700 rounded text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-charcoal-700">
                          <td className="py-2 font-medium text-gray-900 dark:text-white" colSpan={2}>
                            รวมที่จะนำไปส่งในทริปนี้
                          </td>
                          <td className="py-2 text-right font-bold text-enterprise-600 dark:text-enterprise-400">
                            {totalLegQty.toLocaleString('th-TH')} หน่วย
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Right column: Trip config */}
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-enterprise-500" />
                  รายละเอียดทริป
                </h3>

                <div className="space-y-4">
                  {/* Vehicle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      รถ <span className="text-red-500">*</span>
                    </label>
                    {vehiclesLoading ? (
                      <LoadingSpinner size={20} />
                    ) : (
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-charcoal-700 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                      >
                        <option value="">-- เลือกรถ --</option>
                        {filteredVehicles.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.plate} {v.make ? `(${v.make})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedVehicle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {(selectedVehicle as any).make} {(selectedVehicle as any).model} · {(selectedVehicle as any).branch ?? ''}
                      </p>
                    )}
                  </div>

                  {/* Driver */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      คนขับ
                    </label>
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-charcoal-700 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                    >
                      <option value="">-- เลือกคนขับ --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Calendar className="w-3.5 h-3.5 inline mr-1" />
                      วันที่วางแผนส่ง <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-charcoal-700 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      หมายเหตุ
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="หมายเหตุทริป (ถ้ามี)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-charcoal-700 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500 resize-none"
                    />
                  </div>
                </div>
              </Card>

              {/* Summary + Submit */}
              <Card className="p-4 bg-enterprise-50 dark:bg-enterprise-900/20 border-enterprise-200 dark:border-enterprise-700">
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">สินค้าในทริปนี้</span>
                    <span className="font-medium text-gray-900 dark:text-white">{totalLegQty} หน่วย</span>
                  </div>
                  {!isValid && (
                    <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-xs pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        {!selectedVehicleId
                          ? 'กรุณาเลือกรถ'
                          : totalLegQty === 0
                            ? 'กรุณาระบุจำนวนสินค้าที่จะส่ง'
                            : 'กรุณาระบุข้อมูลให้ครบถ้วน'}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || submitting || legItems.length === 0}
                  className="w-full"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size={18} className="mr-2" />
                      กำลังสร้างทริป...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4 mr-2" />
                      สร้างทริปส่งสินค้า
                    </>
                  )}
                </Button>
              </Card>
            </div>
          </div>
        )}
      </PageLayout>
    </>
  );
}
