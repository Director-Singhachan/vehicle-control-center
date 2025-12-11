// Delivery Trip Detail View - Show detailed information about a delivery trip
import React, { useState, useMemo } from 'react';
import {
  Package,
  Edit,
  ArrowLeft,
  Calendar,
  Truck,
  User,
  MapPin,
  Gauge,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
  Download,
  FileText,
  Save,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { ImageModal } from '../components/ui/ImageModal';
import { useDeliveryTrip } from '../hooks';
import { deliveryTripService } from '../services/deliveryTripService';
import { pdfService } from '../services/pdfService';
import { CrewAssignment } from '../components/crew/CrewAssignment';
import type {
  DeliveryTripStoreWithDetails,
  DeliveryTripItemWithProduct,
  DeliveryTripItemChangeWithDetails,
} from '../services/deliveryTripService';

interface DeliveryTripDetailViewProps {
  tripId: string;
  onEdit?: (tripId: string) => void;
  onBack?: () => void;
}

export const DeliveryTripDetailView: React.FC<DeliveryTripDetailViewProps> = ({
  tripId,
  onEdit,
  onBack,
}) => {
  const { trip, loading, error, refetch } = useDeliveryTrip(tripId);
  const [printing, setPrinting] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [savingItems, setSavingItems] = useState(false);
  const [vehicleImageError, setVehicleImageError] = useState(false);
  const [driverImageError, setDriverImageError] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  // Editable copy of stores/items
  const [editableStores, setEditableStores] = useState<DeliveryTripStoreWithDetails[] | null>(null);

  // Get aggregated products
  const [aggregatedProducts, setAggregatedProducts] = useState<any[]>([]);

  // Item change history (audit log)
  const [itemChanges, setItemChanges] = useState<DeliveryTripItemChangeWithDetails[]>([]);
  const [itemChangesLoading, setItemChangesLoading] = useState(false);
  const [itemChangesError, setItemChangesError] = useState<string | null>(null);

  React.useEffect(() => {
    if (trip) {
      deliveryTripService.getAggregatedProducts(trip.id).then(setAggregatedProducts);
      if (!editingItems) {
        // Reset editable stores when trip changes and not currently editing
        setEditableStores(trip.stores || null);
      }
      // Reset image error states when trip changes
      setVehicleImageError(false);
      setDriverImageError(false);
    }
  }, [trip, editingItems]);

  React.useEffect(() => {
    const fetchHistory = async () => {
      if (!trip) return;
      try {
        setItemChangesLoading(true);
        setItemChangesError(null);
        const data = await deliveryTripService.getItemChangeHistory(trip.id);
        setItemChanges(data);
      } catch (err: any) {
        console.error('[DeliveryTripDetailView] Error loading item change history:', err);
        setItemChangesError(err?.message || 'ไม่สามารถโหลดประวัติการแก้ไขสินค้าได้');
      } finally {
        setItemChangesLoading(false);
      }
    };

    fetchHistory();
  }, [trip]);

  const isCompleted = trip?.status === 'completed';

  const handleStartEditItems = () => {
    if (!trip || !trip.stores) return;
    setEditableStores(trip.stores);
    setEditingItems(true);
    setChangeReason('');
  };

  const handleCancelEditItems = () => {
    if (trip?.stores) {
      setEditableStores(trip.stores);
    } else {
      setEditableStores(null);
    }
    setEditingItems(false);
    setChangeReason('');
  };

  const handleItemQuantityChange = (
    storeId: string,
    itemId: string,
    quantity: number,
  ) => {
    setEditableStores(prev => {
      if (!prev) return prev;
      return prev.map(store => {
        if (store.id !== storeId || !store.items) return store;
        const newItems = store.items.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        );
        return { ...store, items: newItems as DeliveryTripItemWithProduct[] };
      });
    });
  };

  const handleRemoveItem = (storeId: string, itemId: string) => {
    if (!window.confirm('ยืนยันลบรายการสินค้านี้ออกจากทริป?')) return;
    setEditableStores(prev => {
      if (!prev) return prev;
      return prev.map(store => {
        if (store.id !== storeId || !store.items) return store;
        const newItems = store.items.filter(item => item.id !== itemId);
        return { ...store, items: newItems as DeliveryTripItemWithProduct[] };
      });
    });
  };

  const handleSaveItems = async () => {
    if (!trip || !editableStores) return;

    if (isCompleted && !changeReason.trim()) {
      alert('กรุณาระบุเหตุผลการแก้ไขรายการสินค้า (ทริปนี้เสร็จสิ้นแล้ว)');
      return;
    }

    try {
      setSavingItems(true);

      await deliveryTripService.update(trip.id, {
        change_reason: changeReason.trim() || undefined,
        stores: editableStores.map(store => ({
          store_id: store.store_id,
          sequence_order: store.sequence_order,
          items: (store.items || []).map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            notes: item.notes,
          })),
        })),
      });

      await refetch();
      setEditingItems(false);
      setChangeReason('');
      alert('บันทึกการแก้ไขรายการสินค้าเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('[DeliveryTripDetailView] Error saving items:', err);
      alert('ไม่สามารถบันทึกการแก้ไขสินค้าได้: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingItems(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      planned: {
        label: 'วางแผน',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: Calendar,
      },
      in_progress: {
        label: 'กำลังดำเนินการ',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Clock,
      },
      completed: {
        label: 'เสร็จสิ้น',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
      },
      cancelled: {
        label: 'ยกเลิก',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: X,
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.planned;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
        <Icon size={14} />
        {badge.label}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = async () => {
    if (!trip) return;

    try {
      setPrinting(true);
      await pdfService.generateDeliveryTripPDFA5(trip, aggregatedProducts);
    } catch (err: any) {
      console.error('[DeliveryTripDetailView] Error printing:', err);
      alert('ไม่สามารถพิมพ์เอกสารได้: ' + (err.message || 'Unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return <PageLayout title="รายละเอียดทริปส่งสินค้า" loading={true} />;
  }

  if (error || !trip) {
    return (
      <PageLayout
        title="รายละเอียดทริปส่งสินค้า"
        error={true}
        onRetry={refetch}
      >
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-red-600 dark:text-red-400">
            {error?.message || 'ไม่พบข้อมูลทริป'}
          </p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`ทริป ${trip.trip_number || 'N/A'}`}
      subtitle="รายละเอียดทริปส่งสินค้า"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} isLoading={printing}>
            <Download size={18} className="mr-2" />
            พิมพ์ A5
          </Button>
          {onEdit && !editingItems && (
            <Button variant="outline" onClick={() => onEdit(trip.id)}>
              <Edit size={18} className="mr-2" />
              แก้ไขข้อมูลทริป
            </Button>
          )}
        </div>
      }
    >
      {/* Basic Info */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText size={20} />
            ข้อมูลพื้นฐาน
            {trip.has_item_changes && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                มีการแก้ไขสินค้า
              </span>
            )}
          </h3>
          {getStatusBadge(trip.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            {trip.vehicle?.image_url && !vehicleImageError ? (
              <img 
                src={trip.vehicle.image_url} 
                alt={trip.vehicle.plate || 'Vehicle'}
                className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                onError={() => setVehicleImageError(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800">
                <Truck className="text-slate-400" size={24} />
              </div>
            )}
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">รถ</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {trip.vehicle?.plate || 'N/A'}
                {trip.vehicle?.make && trip.vehicle?.model && (
                  <span className="text-slate-500"> ({trip.vehicle.make} {trip.vehicle.model})</span>
                )}
              </div>
            </div>
          </div>

          {trip.driver && (
            <div className="flex items-center gap-3">
              {trip.driver.avatar_url && !driverImageError ? (
                <img 
                  src={trip.driver.avatar_url} 
                  alt={trip.driver.full_name || 'Driver'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-enterprise-500 transition-all"
                  onClick={() => {
                    setSelectedImage({
                      url: trip.driver.avatar_url!,
                      alt: trip.driver.full_name || 'Driver'
                    });
                  }}
                  onError={() => setDriverImageError(true)}
                />
              ) : (
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800">
                  <User className="text-slate-400" size={24} />
                </div>
              )}
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">คนขับ</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.driver.full_name}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="text-slate-400" size={20} />
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">วันที่วางแผน</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {formatDate(trip.planned_date)}
              </div>
            </div>
          </div>

          {trip.odometer_start && (
            <div className="flex items-center gap-3">
              <Gauge className="text-slate-400" size={20} />
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">ไมล์เริ่มต้น</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.odometer_start.toLocaleString()} กม.
                </div>
              </div>
            </div>
          )}

          {trip.odometer_end && (
            <div className="flex items-center gap-3">
              <Gauge className="text-slate-400" size={20} />
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">ไมล์สิ้นสุด</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.odometer_end.toLocaleString()} กม.
                </div>
              </div>
            </div>
          )}

          {trip.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">หมายเหตุ</div>
              <div className="text-slate-900 dark:text-slate-100">{trip.notes}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Stores */}
      {editableStores && editableStores.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <MapPin size={20} />
            ร้านค้า ({editableStores.length} ร้าน)
          </h3>

          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {editingItems
                ? 'โหมดแก้ไขสินค้าในทริป สามารถปรับจำนวน หรือลบรายการได้'
                : 'ดูรายการสินค้าในแต่ละร้าน (ถ้าต้องการแก้ไข กดปุ่มด้านขวา)'}
            </div>
            {!editingItems && (
              <Button variant="outline" size="sm" onClick={handleStartEditItems}>
                <Edit size={16} className="mr-1" />
                แก้ไขสินค้าในทริป
              </Button>
            )}
          </div>

          {editingItems && isCompleted && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-100">
              ทริปนี้มีสถานะ <strong>เสร็จสิ้น</strong> การแก้ไขสินค้าจะถูกเก็บประวัติไว้ กรุณาระบุเหตุผลอย่างชัดเจน
              <textarea
                className="mt-2 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                rows={2}
                placeholder="เช่น ขึ้นสินค้าเกิน, ลูกค้าสั่งผิด, ตัดจำนวนตามของที่ส่งจริง เป็นต้น"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-4">
            {editableStores
              .sort((a, b) => a.sequence_order - b.sequence_order)
              .map((storeWithDetails) => {
                const store = storeWithDetails.store;
                if (!store) return null;

                return (
                  <div
                    key={storeWithDetails.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-600 dark:text-enterprise-400 font-semibold">
                        {storeWithDetails.sequence_order}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {store.customer_code} - {store.customer_name}
                        </div>
                        {store.address && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {store.address}
                          </div>
                        )}
                        {store.phone && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            โทร: {store.phone}
                          </div>
                        )}
                      </div>
                      {storeWithDetails.delivery_status && (
                        (() => {
                          // ถ้าทริปจบแล้ว แต่สถานะร้านค้ายัง pending ให้แสดงเป็น "ส่งแล้ว" เพื่อให้สอดคล้องกับการใช้งานจริง
                          const rawStatus = storeWithDetails.delivery_status;
                          const effectiveStatus =
                            rawStatus === 'pending' && trip.status === 'completed'
                              ? 'delivered'
                              : rawStatus;

                          const className =
                            effectiveStatus === 'delivered'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : effectiveStatus === 'failed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

                          const label =
                            effectiveStatus === 'delivered'
                              ? 'ส่งแล้ว'
                              : effectiveStatus === 'failed'
                                ? 'ส่งไม่สำเร็จ'
                                : 'รอส่ง';

                          return (
                            <span className={`px-2 py-1 rounded text-xs ${className}`}>
                              {label}
                            </span>
                          );
                        })()
                      )}
                    </div>

                    {/* Products for this store */}
                    {storeWithDetails.items && storeWithDetails.items.length > 0 && (
                      <div className="mt-3 pl-11">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          สินค้า ({storeWithDetails.items.length} รายการ):
                        </div>
                        <div className="space-y-1">
                          {storeWithDetails.items.map((item) => {
                            const product = item.product;
                            if (!product) return null;

                            const quantityValue = Number(item.quantity) || 0;

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400"
                              >
                                <div className="flex-1">
                                  • {product.product_code} - {product.product_name}
                                </div>
                                {editingItems ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right text-sm text-slate-900 dark:text-slate-100"
                                      value={quantityValue}
                                      onChange={(e) =>
                                        handleItemQuantityChange(
                                          storeWithDetails.id,
                                          item.id,
                                          Number(e.target.value),
                                        )
                                      }
                                    />
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      {product.unit}
                                    </span>
                                    <button
                                      type="button"
                                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                                      onClick={() =>
                                        handleRemoveItem(storeWithDetails.id, item.id)
                                      }
                                    >
                                      ลบ
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-right min-w-[120px]">
                                    {quantityValue.toLocaleString()} {product.unit}
                                  </div>
                                )}
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

          {editingItems && (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelEditItems} disabled={savingItems}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveItems} isLoading={savingItems}>
                <Save size={16} className="mr-1" />
                บันทึกการแก้ไขสินค้า
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Aggregated Products */}
      {aggregatedProducts.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Package size={20} />
            สรุปสินค้าทั้งหมดในเที่ยว
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    รหัสสินค้า
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    ชื่อสินค้า
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    หมวดหมู่
                  </th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    จำนวนรวม
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    ร้านค้า
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregatedProducts.map((product) => (
                  <tr
                    key={product.product_id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                      {product.product_code}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                      {product.product_name}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                      {product.category}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {product.total_quantity.toLocaleString()} {product.unit}
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                      {product.stores.map(s => `${s.customer_name} (${s.quantity})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Crew Assignment Section */}
      <CrewAssignment
        tripId={trip.id}
        tripStatus={trip.status}
        onUpdate={() => {
          refetch();
        }}
      />

      {/* Item Change History (Audit Log) */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <FileText size={20} />
          ประวัติการแก้ไขสินค้า
        </h3>

        {itemChangesLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดประวัติการแก้ไข...</p>
        )}

        {itemChangesError && (
          <p className="text-sm text-red-600 dark:text-red-400">{itemChangesError}</p>
        )}

        {!itemChangesLoading && !itemChangesError && itemChanges.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีประวัติการแก้ไขสินค้าในทริปนี้
          </p>
        )}

        {!itemChangesLoading && !itemChangesError && itemChanges.length > 0 && (
          <div className="space-y-3">
            {itemChanges.map((change) => {
              const actionLabel =
                change.action === 'add'
                  ? 'เพิ่มรายการ'
                  : change.action === 'remove'
                    ? 'ลบรายการ'
                    : 'แก้ไขจำนวน';

              const storeLabel = change.store
                ? `${change.store.customer_code} - ${change.store.customer_name}`
                : 'ไม่ระบุร้านค้า';

              const productLabel = change.product
                ? `${change.product.product_code} - ${change.product.product_name}`
                : 'ไม่ระบุสินค้า';

              return (
                <div
                  key={change.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {actionLabel}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(change.created_at)}
                    </div>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <div>ร้านค้า: {storeLabel}</div>
                    <div>สินค้า: {productLabel}</div>
                    <div className="mt-1">
                      ปริมาณ:{' '}
                      {change.old_quantity != null && change.new_quantity != null
                        ? `${Number(change.old_quantity).toLocaleString()} → ${Number(
                          change.new_quantity,
                        ).toLocaleString()}`
                        : change.old_quantity != null
                          ? `${Number(change.old_quantity).toLocaleString()} → 0`
                          : change.new_quantity != null
                            ? `0 → ${Number(change.new_quantity).toLocaleString()}`
                            : '-'}
                    </div>
                    {change.reason && (
                      <div className="mt-1 text-slate-600 dark:text-slate-300">
                        เหตุผล: {change.reason}
                      </div>
                    )}
                    {change.user && (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        โดย: {change.user.full_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Back Button */}
      {onBack && (
        <div className="mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft size={18} className="mr-2" />
            กลับ
          </Button>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage?.url || ''}
        alt={selectedImage?.alt || ''}
        onClose={() => setSelectedImage(null)}
      />
    </PageLayout>
  );
};

