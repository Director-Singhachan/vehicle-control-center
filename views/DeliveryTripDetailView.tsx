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
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTrip } from '../hooks';
import { deliveryTripService } from '../services/deliveryTripService';
import { pdfService } from '../services/pdfService';

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

  // Get aggregated products
  const [aggregatedProducts, setAggregatedProducts] = useState<any[]>([]);

  React.useEffect(() => {
    if (trip) {
      deliveryTripService.getAggregatedProducts(trip.id).then(setAggregatedProducts);
    }
  }, [trip]);

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
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(trip.id)}>
              <Edit size={18} className="mr-2" />
              แก้ไข
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
          </h3>
          {getStatusBadge(trip.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Truck className="text-slate-400" size={20} />
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
              <User className="text-slate-400" size={20} />
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
      {trip.stores && trip.stores.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <MapPin size={20} />
            ร้านค้า ({trip.stores.length} ร้าน)
          </h3>

          <div className="space-y-4">
            {trip.stores
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          storeWithDetails.delivery_status === 'delivered'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : storeWithDetails.delivery_status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {storeWithDetails.delivery_status === 'delivered' ? 'ส่งแล้ว' :
                           storeWithDetails.delivery_status === 'failed' ? 'ส่งไม่สำเร็จ' : 'รอส่ง'}
                        </span>
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

                            return (
                              <div
                                key={item.id}
                                className="text-sm text-slate-600 dark:text-slate-400"
                              >
                                • {product.product_code} - {product.product_name} ({item.quantity} {product.unit})
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
        </Card>
      )}

      {/* Aggregated Products */}
      {aggregatedProducts.length > 0 && (
        <Card>
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

      {/* Back Button */}
      {onBack && (
        <div className="mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft size={18} className="mr-2" />
            กลับ
          </Button>
        </div>
      )}
    </PageLayout>
  );
};

