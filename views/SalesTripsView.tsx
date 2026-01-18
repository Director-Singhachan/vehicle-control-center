import React, { useState, useMemo } from 'react';
import { Truck, MapPin, Package, FileText, Calendar, User, Phone, CheckCircle, Clock, AlertCircle, CheckSquare, Square, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth, useToast } from '../hooks';
import { useDeliveryTrips } from '../hooks/useDeliveryTrips';
import { deliveryTripService } from '../services/deliveryTripService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

export function SalesTripsView() {
  const { user } = useAuth();
  const { toasts, success, error, warning, dismissToast } = useToast();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<{ tripId: string; store: any } | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set()); // Track checked items in modal
  
  // Fetch trips with full details for invoicing
  const { trips, loading, error: tripsError, refetch } = useDeliveryTrips({
    planned_date_from: dateFilter,
    planned_date_to: dateFilter,
    lite: false, // Fetch full store details
  });

  // Show all trips that are ready for invoicing
  // Sales can create invoices for any trip (not just assigned to them)
  const myTrips = useMemo(() => {
    if (!trips) return [];
    
    // Show trips that have stores/orders (ready for invoicing)
    return trips.filter((trip: any) => {
      return trip.stores && trip.stores.length > 0;
    });
  }, [trips]);

  // คำนวณสถิติการออกบิล
  const invoiceStats = useMemo(() => {
    let totalStores = 0;
    let issuedStores = 0;
    
    myTrips.forEach((trip: any) => {
      if (trip.stores) {
        trip.stores.forEach((store: any) => {
          totalStores++;
          if (store.invoice_status === 'issued') {
            issuedStores++;
          }
        });
      }
    });
    
    return {
      total: totalStores,
      issued: issuedStores,
      pending: totalStores - issuedStores,
      completionRate: totalStores > 0 ? (issuedStores / totalStores) * 100 : 0,
    };
  }, [myTrips]);

  // เปลี่ยนสถานะการออกบิล
  const handleToggleInvoiceStatus = async (
    tripId: string, 
    storeId: string, 
    currentStatus: string,
    onStatusUpdated?: (newStatus: 'pending' | 'issued') => void
  ) => {
    const key = `${tripId}-${storeId}`;
    setUpdatingStatus(prev => new Set(prev).add(key));
    
    try {
      const newStatus = currentStatus === 'issued' ? 'pending' : 'issued';
      await deliveryTripService.updateStoreInvoiceStatus(tripId, storeId, newStatus);
      
      // Call callback to update local state immediately
      if (onStatusUpdated) {
        onStatusUpdated(newStatus);
      }
      
      // Refresh trips to ensure data consistency
      // Add a small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 300));
      await refetch();
      
      // Show success message after state update
      setTimeout(() => {
        if (newStatus === 'issued') {
          success('บันทึกสถานะการออกบิลเรียบร้อย');
        } else {
          success('ยกเลิกสถานะการออกบิลเรียบร้อย');
        }
      }, 100);
    } catch (err: any) {
      console.error('Error updating invoice status:', err);
      error(err.message || 'เกิดข้อผิดพลาดในการอัพเดทสถานะการออกบิล');
      throw err; // Re-throw to allow caller to handle
    } finally {
      setUpdatingStatus(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
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

  if (tripsError) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <PageLayout title="ออกใบแจ้งหนี้ - ทริปส่งสินค้า">
          <div className="text-center text-red-600 dark:text-red-400 py-8">
            เกิดข้อผิดพลาด: {tripsError.message}
          </div>
        </PageLayout>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ออกบิลแล้ว</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {invoiceStats.issued} / {invoiceStats.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {invoiceStats.completionRate.toFixed(0)}% เสร็จสมบูรณ์
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
                <p className="text-sm text-gray-600 dark:text-gray-400">รอออกบิล</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {invoiceStats.pending}
                </p>
              </div>
              <Clock className="w-10 h-10 text-orange-500 opacity-50" />
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

                            {/* Items Summary - ซ่อนไว้ก่อน แสดงเมื่อกดดู */}
                            {store.items && store.items.length > 0 && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Package className="w-3 h-3" />
                                    รายการสินค้า ({store.items.length} รายการ)
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const key = `${trip.id}-${store.store_id}`;
                                        setExpandedStores(prev => {
                                          const next = new Set(prev);
                                          if (next.has(key)) {
                                            next.delete(key);
                                          } else {
                                            next.add(key);
                                          }
                                          return next;
                                        });
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                      {expandedStores.has(`${trip.id}-${store.store_id}`) ? (
                                        <>
                                          <ChevronUp className="w-3 h-3" />
                                          ซ่อนรายการ
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-3 h-3" />
                                          ดูรายการสินค้า
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setSelectedStoreDetail({ tripId: trip.id, store })}
                                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                    >
                                      <Eye className="w-3 h-3" />
                                      ดูทั้งหมด
                                    </button>
                                  </div>
                                </div>
                                
                                {/* แสดงรายการสินค้าเมื่อกดดู */}
                                {expandedStores.has(`${trip.id}-${store.store_id}`) && (
                                  <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 max-h-96 overflow-y-auto">
                                    {store.items.map((item: any, itemIndex: number) => (
                                      <div key={item.id} className="flex items-center justify-between text-sm py-2 px-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono w-6 flex-shrink-0">
                                            {itemIndex + 1}.
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-gray-900 dark:text-white font-medium">
                                                {item.product?.product_name || 'ไม่ระบุชื่อ'}
                                              </span>
                                              {item.product?.product_code && (
                                                <Badge variant="info" className="text-xs font-mono">
                                                  {item.product.product_code}
                                                </Badge>
                                              )}
                                            </div>
                                            {item.product?.category && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                หมวดหมู่: {item.product.category}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right ml-4 flex-shrink-0">
                                          <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                                            {new Intl.NumberFormat('th-TH').format(item.quantity)} {item.product?.unit || 'ชิ้น'}
                                          </span>
                                          {item.product?.base_price && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(item.product.base_price)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Invoice Status Toggle */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2">
                            <button
                              onClick={() => handleToggleInvoiceStatus(trip.id, store.store_id, store.invoice_status || 'pending')}
                              disabled={trip.status === 'cancelled' || updatingStatus.has(`${trip.id}-${store.store_id}`)}
                              className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${store.invoice_status === 'issued'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-2 border-green-300 dark:border-green-700'
                                  : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 border-2 border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-600'
                                }
                                ${trip.status === 'cancelled' || updatingStatus.has(`${trip.id}-${store.store_id}`)
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'cursor-pointer'
                                }
                              `}
                              title={store.invoice_status === 'issued' ? 'คลิกเพื่อยกเลิกสถานะ' : 'คลิกเพื่อยืนยันว่าออกบิลแล้ว'}
                            >
                              {updatingStatus.has(`${trip.id}-${store.store_id}`) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                  <span>กำลังบันทึก...</span>
                                </>
                              ) : store.invoice_status === 'issued' ? (
                                <>
                                  <CheckSquare className="w-4 h-4" />
                                  <span>ออกบิลแล้ว</span>
                                </>
                              ) : (
                                <>
                                  <Square className="w-4 h-4" />
                                  <span>ยังไม่ออกบิล</span>
                                </>
                              )}
                            </button>
                            
                            {/* สรุปสถานะ */}
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                              {store.items && store.items.length > 0 ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="font-medium">สินค้า {store.items.length} รายการ</span>
                                  {!expandedStores.has(`${trip.id}-${store.store_id}`) && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      คลิก "ดูรายการสินค้า" เพื่อดูรายละเอียด
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400">ไม่มีสินค้า</span>
                              )}
                            </div>
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

      {/* Store Detail Modal */}
      {selectedStoreDetail && (
        <Modal
          isOpen={!!selectedStoreDetail}
          onClose={() => {
            setSelectedStoreDetail(null);
            setCheckedItems(new Set()); // Reset checked items when closing modal
          }}
          title={`รายละเอียดสินค้า - ${selectedStoreDetail.store.store?.customer_name || 'ไม่ระบุชื่อร้าน'}`}
          size="large"
        >
          <div className="space-y-4">
            {/* Store Info */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">ข้อมูลร้านค้า</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">รหัสลูกค้า:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedStoreDetail.store.store?.customer_code || 'ไม่ระบุ'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">ชื่อร้าน:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedStoreDetail.store.store?.customer_name || 'ไม่ระบุ'}
                  </span>
                </div>
                {selectedStoreDetail.store.store?.address && (
                  <div className="md:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">ที่อยู่:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {selectedStoreDetail.store.store.address}
                    </span>
                  </div>
                )}
                {selectedStoreDetail.store.store?.phone && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">เบอร์โทร:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {selectedStoreDetail.store.store.phone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items List with Checklist Helper */}
            {selectedStoreDetail.store.items && selectedStoreDetail.store.items.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    รายการสินค้า ({selectedStoreDetail.store.items.length} รายการ)
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">💡</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      ใช้รายการนี้เป็นคู่มือในการคีย์บิลในระบบอื่น
                    </span>
                  </div>
                </div>
                
                {/* Summary Card with Progress */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-blue-800 dark:text-blue-200 font-medium">
                      📋 สรุปรายการสินค้า
                    </span>
                    <span className="text-blue-700 dark:text-blue-300">
                      รวม {selectedStoreDetail.store.items.length} รายการ
                    </span>
                  </div>
                  {(() => {
                    const totalItems = selectedStoreDetail.store.items.length;
                    const checkedCount = selectedStoreDetail.store.items.filter((item: any) => {
                      const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                      return checkedItems.has(itemKey);
                    }).length;
                    const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
                    
                    return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-blue-700 dark:text-blue-300">
                            คีย์แล้ว: {checkedCount} / {totalItems} รายการ
                          </span>
                          <span className={`font-semibold ${
                            progress === 100 
                              ? 'text-green-600 dark:text-green-400' 
                              : progress > 0 
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              progress === 100
                                ? 'bg-green-500'
                                : progress > 0
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">✓</th>
                        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-16">ลำดับ</th>
                        <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">รหัสสินค้า</th>
                        <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ชื่อสินค้า</th>
                        <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หมวดหมู่</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวน</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                        {selectedStoreDetail.store.items[0]?.product?.base_price ? (
                          <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคาต่อหน่วย</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStoreDetail.store.items.map((item: any, index: number) => {
                        const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                        const isChecked = checkedItems.has(itemKey);
                        
                        return (
                          <tr 
                            key={item.id} 
                            className={`border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                              isChecked ? 'bg-green-50 dark:bg-green-900/10' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => {
                                  setCheckedItems(prev => {
                                    const next = new Set(prev);
                                    if (next.has(itemKey)) {
                                      next.delete(itemKey);
                                    } else {
                                      next.add(itemKey);
                                    }
                                    return next;
                                  });
                                }}
                                className={`
                                  w-6 h-6 border-2 rounded flex items-center justify-center transition-all cursor-pointer
                                  ${isChecked
                                    ? 'bg-green-500 border-green-600 dark:bg-green-600 dark:border-green-700'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                                  }
                                `}
                                title={isChecked ? 'คลิกเพื่อยกเลิกการเช็ค' : 'คลิกเพื่อเช็คว่าคีย์สินค้านี้แล้ว'}
                              >
                                {isChecked && (
                                  <CheckCircle className="w-4 h-4 text-white" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-sm text-center text-gray-600 dark:text-gray-400 font-mono font-semibold">
                              {index + 1}
                            </td>
                            <td className="py-3 px-3 text-sm">
                              <Badge variant="info" className="text-xs font-mono">
                                {item.product?.product_code || 'ไม่ระบุ'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">
                              {item.product?.product_name || 'ไม่ระบุชื่อ'}
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400">
                              {item.product?.category || '-'}
                            </td>
                            <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {new Intl.NumberFormat('th-TH').format(item.quantity || 0)}
                            </td>
                            <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                              {item.product?.unit || 'ชิ้น'}
                            </td>
                            {item.product?.base_price ? (
                              <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(item.product.base_price)}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Helper Text */}
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    <strong>💡 คำแนะนำ:</strong> ใช้รายการนี้เป็นคู่มือในการคีย์บิลในระบบอื่น ตรวจสอบให้ครบทุกรายการก่อนกด "ยืนยันการออกบิล"
                  </p>
                </div>

                {/* Confirm Button */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                  {(() => {
                    const totalItems = selectedStoreDetail.store.items.length;
                    const checkedCount = selectedStoreDetail.store.items.filter((item: any) => {
                      const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                      return checkedItems.has(itemKey);
                    }).length;
                    const allChecked = checkedCount === totalItems && totalItems > 0;
                    const currentInvoiceStatus = selectedStoreDetail.store.invoice_status || 'pending';
                    const isAlreadyIssued = currentInvoiceStatus === 'issued';
                    const modalKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}`;
                    const isUpdating = updatingStatus.has(modalKey);

                    return (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {!allChecked && totalItems > 0 && (
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                              ⚠️ ยังไม่ได้เช็ครายการครบ ({checkedCount} / {totalItems} รายการ)
                            </p>
                          )}
                          {allChecked && !isAlreadyIssued && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                              ✅ เช็ครายการครบแล้ว พร้อมยืนยันการออกบิล
                            </p>
                          )}
                          {isAlreadyIssued && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              ℹ️ สถานะการออกบิล: ออกบิลแล้ว
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          {isAlreadyIssued ? (
                            <Button
                              variant="outline"
                              onClick={async () => {
                                await handleToggleInvoiceStatus(
                                  selectedStoreDetail.tripId,
                                  selectedStoreDetail.store.store_id,
                                  currentInvoiceStatus,
                                  (newStatus) => {
                                    // Update the selectedStoreDetail state immediately
                                    setSelectedStoreDetail(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        store: {
                                          ...prev.store,
                                          invoice_status: newStatus,
                                        },
                                      };
                                    });
                                  }
                                );
                                // Close modal after updating
                                setTimeout(() => {
                                  setSelectedStoreDetail(null);
                                  setCheckedItems(new Set());
                                }, 1000);
                              }}
                              disabled={isUpdating}
                            >
                              {isUpdating ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                  กำลังอัพเดท...
                                </>
                              ) : (
                                <>
                                  <Square className="w-4 h-4 mr-2" />
                                  ยกเลิกสถานะออกบิล
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={async () => {
                                if (!allChecked) {
                                  warning('กรุณาเช็ครายการสินค้าให้ครบก่อนยืนยันการออกบิล');
                                  return;
                                }

                                // Call handleToggleInvoiceStatus with callback to update state immediately
                                await handleToggleInvoiceStatus(
                                  selectedStoreDetail.tripId,
                                  selectedStoreDetail.store.store_id,
                                  currentInvoiceStatus,
                                  (newStatus) => {
                                    // Update the selectedStoreDetail state immediately
                                    setSelectedStoreDetail(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        store: {
                                          ...prev.store,
                                          invoice_status: newStatus,
                                        },
                                      };
                                    });
                                  }
                                );
                                
                                // Close modal after a short delay to show success
                                setTimeout(() => {
                                  setSelectedStoreDetail(null);
                                  setCheckedItems(new Set());
                                }, 1500);
                              }}
                              disabled={!allChecked || isUpdating}
                              className={`
                                ${allChecked 
                                  ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700' 
                                  : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                                }
                              `}
                            >
                              {isUpdating ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                  กำลังอัพเดท...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  ยืนยันการออกบิล
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีรายการสินค้า</p>
              </div>
            )}
          </div>
        </Modal>
      )}
      </PageLayout>
    </>
  );
}

