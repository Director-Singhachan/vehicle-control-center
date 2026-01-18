import React, { useState, useMemo } from 'react';
import { Truck, MapPin, Package, FileText, Calendar, User, Phone, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks';
import { useDeliveryTrips } from '../hooks/useDeliveryTrips';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function SalesTripsView() {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  
  // Fetch trips with full details for invoicing
  const { trips, loading, error, refetch } = useDeliveryTrips({
    planned_date_from: dateFilter,
    planned_date_to: dateFilter,
    lite: false, // Fetch full store details
  });

  // Show notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'error') console.error(message);
  };

  // Show all trips that are ready for invoicing
  // Sales can create invoices for any trip (not just assigned to them)
  const myTrips = useMemo(() => {
    if (!trips) return [];
    
    // Show trips that have stores/orders (ready for invoicing)
    return trips.filter((trip: any) => {
      return trip.stores && trip.stores.length > 0;
    });
  }, [trips]);

  const handlePrintInvoice = async (tripId: string, storeId: string) => {
    // TODO: Implement invoice printing
    alert(`พิมพ์ใบแจ้งหนี้สำหรับทริป ${tripId}, ร้าน ${storeId}`);
  };

  if (loading) {
    return (
      <PageLayout title="ทริปของฉัน">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="ทริปของฉัน">
        <div className="text-center text-red-600 dark:text-red-400 py-8">
          เกิดข้อผิดพลาด: {error.message}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="ออกใบแจ้งหนี้ - ทริปส่งสินค้า">
      {/* Date Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
        <Button onClick={refetch} variant="outline">
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ทริปทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{myTrips.length}</p>
              </div>
              <Truck className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">กำลังดำเนินการ</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {myTrips.filter((t: any) => t.status === 'in_progress').length}
                </p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">เสร็จสิ้น</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {myTrips.filter((t: any) => t.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">จุดส่งทั้งหมด</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {myTrips.reduce((sum: number, t: any) => sum + (t.stores?.length || 0), 0)}
                </p>
              </div>
              <MapPin className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

      {/* Trips List */}
      {myTrips.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">ไม่มีทริปในวันที่เลือก</p>
            <p className="text-sm mt-2">เลือกวันอื่นเพื่อดูทริปของคุณ</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {myTrips.map((trip: any) => (
            <Card key={trip.id}>
              <div className="p-6">
                {/* Trip Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {trip.trip_number || `ทริป #${trip.sequence_order}`}
                      </h3>
                      <Badge
                        variant={
                          trip.status === 'completed' ? 'success' :
                          trip.status === 'in_progress' ? 'warning' :
                          trip.status === 'cancelled' ? 'error' :
                          'default'
                        }
                      >
                        {trip.status === 'completed' ? 'เสร็จสิ้น' :
                         trip.status === 'in_progress' ? 'กำลังดำเนินการ' :
                         trip.status === 'cancelled' ? 'ยกเลิก' :
                         'รอดำเนินการ'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        <span>{trip.vehicle?.plate || 'ไม่ระบุ'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>คนขับ: {trip.driver?.full_name || 'ไม่ระบุ'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(trip.planned_date).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{trip.stores?.length || 0} จุดส่ง</span>
                      </div>
                    </div>
                    {trip.crews && trip.crews.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <User className="w-4 h-4" />
                        <span>พนักงานบริการ:</span>
                        <div className="flex gap-2 flex-wrap">
                          {trip.crews.map((crew: any) => (
                            <Badge key={crew.id} variant="info">
                              {crew.staff?.name || 'ไม่ระบุชื่อ'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Store Deliveries */}
                {trip.stores && trip.stores.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      รายการจัดส่ง (เรียงตามลำดับ)
                    </h4>
                    {trip.stores
                      .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
                      .map((store: any, index: number) => (
                        <div
                          key={store.id}
                          className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl"
                        >
                          {/* Sequence Number */}
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                            {store.sequence_order || index + 1}
                          </div>

                          {/* Store Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {store.store?.customer_name}
                              </p>
                              <Badge variant="info" className="text-xs">
                                {store.store?.customer_code}
                              </Badge>
                              {store.status === 'delivered' && (
                                <Badge variant="success" className="text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  ส่งแล้ว
                                </Badge>
                              )}
                            </div>
                            
                            {store.store?.address && (
                              <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>{store.store.address}</p>
                              </div>
                            )}

                            {store.store?.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                <p>{store.store.phone}</p>
                              </div>
                            )}

                            {/* Items Summary */}
                            {store.items && store.items.length > 0 && (
                              <div className="mt-3 p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  รายการสินค้า ({store.items.length} รายการ)
                                </p>
                                <div className="space-y-1">
                                  {store.items.slice(0, 3).map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                      <span>{item.product?.product_name}</span>
                                      <span className="font-medium">{item.quantity} {item.product?.unit}</span>
                                    </div>
                                  ))}
                                  {store.items.length > 3 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                      และอีก {store.items.length - 3} รายการ...
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0">
                            {store.invoice_status === 'issued' ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                ออกใบแจ้งหนี้แล้ว
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handlePrintInvoice(trip.id, store.store_id)}
                                disabled={trip.status === 'cancelled'}
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                ออกใบแจ้งหนี้
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Trip Notes */}
                {trip.notes && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      <span className="font-medium">หมายเหตุ:</span> {trip.notes}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

