import React, { useState } from 'react';
import {
  Edit,
  ArrowLeft,
  Download,
  BarChart3,
  CheckCircle,
  Plus,
  Search,
  MapPin,
  Package,
  Users,
  FileText,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageLayout } from '../components/layout/PageLayout';
import { ImageModal } from '../components/ui/ImageModal';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import { TripDetailTabs } from '../components/ui/TripDetailTabs';
import type { TripTabId, TripTab } from '../components/ui/TripDetailTabs';
import { TripOverviewSection } from '../components/trip/TripOverviewSection';
import { TripStoresDetailSection } from '../components/trip/TripStoresDetailSection';
import { TripProductsDetailSection } from '../components/trip/TripProductsDetailSection';
import { TripAnalyticsSection } from '../components/trip/TripAnalyticsSection';
import { TripHistorySection } from '../components/trip/TripHistorySection';
import { TripLoadingPlanSection } from '../components/trip/TripLoadingPlanSection';
import { TripCrewDetailSection } from '../components/trip/TripCrewDetailSection';
import { useDeliveryTripDetail } from '../hooks/useDeliveryTripDetail';
import { deliveryTripService } from '../services/deliveryTripService';
import { pdfService } from '../services/pdfService';
import { useToast, useDebugData } from '../hooks';
import { ToastContainer } from '../components/ui/Toast';

interface DeliveryTripDetailViewProps {
  tripId: string;
  onEdit?: (tripId: string) => void;
  onBack?: () => void;
  onRecordMetrics?: () => void;
}

export const DeliveryTripDetailView: React.FC<DeliveryTripDetailViewProps> = ({
  tripId,
  onEdit,
  onBack,
  onRecordMetrics,
}) => {
  const [activeTab, setActiveTab] = useState<TripTabId>('overview');
  const [printing, setPrinting] = useState(false);
  const [printingForklift, setPrintingForklift] = useState(false);

  const { toasts, success: showSuccess, error: showError, dismissToast } = useToast();

  const detail = useDeliveryTripDetail(tripId);
  const {
    trip,
    loading,
    error,
    refetch,
    aggregatedProducts,
    staffDistribution,
    productDistribution,
    distributionLoading,
    postAnalyses,
    postAnalysisLoading,
    postAnalysisError,
    pickupBreakdown,
    itemChanges,
    itemChangesLoading,
    itemChangesError,
    editHistory,
    editHistoryLoading,
    editHistoryError,
    vehicleImageError,
    driverImageError,
    setVehicleImageError,
    setDriverImageError,
    selectedImage,
    setSelectedImage,
    addOrderModalOpen,
    setAddOrderModalOpen,
    pendingOrdersLoading,
    pendingOrdersToShow,
    pendingOrders,
    addOrderSearch,
    setAddOrderSearch,
    selectedOrdersToAdd,
    setSelectedOrdersToAdd,
    addOrderReason,
    setAddOrderReason,
    addOrderSubmitting,
    addOrderError,
    handleAddOrderToTrip,
  } = detail;

  useDebugData('trip_detail_raw', trip, [trip]);

  // ─── PDF handlers ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!trip) return;
    try {
      setPrinting(true);
      const fullTrip = await deliveryTripService.getById(trip.id);
      await pdfService.generateDeliveryTripPDFA5(fullTrip || trip, aggregatedProducts);
    } catch (err: any) {
      showError('ไม่สามารถพิมพ์เอกสารได้: ' + (err.message || 'Unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintForklift = async () => {
    if (!trip) return;
    try {
      setPrintingForklift(true);
      const fullTrip = await deliveryTripService.getById(trip.id);
      await pdfService.generateDeliveryTripForkliftSummaryPDFA5(fullTrip || trip, aggregatedProducts);
    } catch (err: any) {
      showError('ไม่สามารถพิมพ์เอกสารโฟล์คลิฟท์ได้: ' + (err.message || 'Unknown error'));
    } finally {
      setPrintingForklift(false);
    }
  };

  // ─── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return <PageLayout title="รายละเอียดทริปส่งสินค้า" loading={true} />;
  }

  if (error || !trip) {
    return (
      <PageLayout title="รายละเอียดทริปส่งสินค้า" error={true} onRetry={refetch}>
        <Card className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400">{error?.message || 'ไม่พบข้อมูลทริป'}</p>
        </Card>
      </PageLayout>
    );
  }

  // ─── Tab definitions ───────────────────────────────────────────────────────
  const storeCount = trip.stores?.length ?? 0;
  const historyCount = editHistory.length + itemChanges.length;

  const tabs: TripTab[] = [
    {
      id: 'overview',
      label: 'ภาพรวม',
      icon: <FileText size={15} />,
    },
    {
      id: 'stores',
      label: 'ร้านค้า',
      icon: <MapPin size={15} />,
      badge: storeCount,
    },
    {
      id: 'products',
      label: 'สรุปสินค้า',
      icon: <Package size={15} />,
      badge: aggregatedProducts.length,
    },
    {
      id: 'crew',
      label: 'พนักงาน',
      icon: <Users size={15} />,
      badge: staffDistribution.length,
    },
    {
      id: 'analytics',
      label: 'สถิติ & AI',
      icon: <BarChart3 size={15} />,
      badge: postAnalyses.length,
      badgeVariant: postAnalyses.length > 0 ? 'info' : 'default',
    },
    {
      id: 'history',
      label: 'ประวัติ',
      icon: <FileText size={15} />,
      badge: historyCount,
      badgeVariant: historyCount > 0 ? 'warning' : 'default',
    },
    {
      id: 'loading',
      label: 'การจัดเรียง',
      icon: <Layers size={15} />,
    },
  ];

  // ─── Action buttons ────────────────────────────────────────────────────────
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft size={16} className="mr-1.5" />
          กลับ
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handlePrint} isLoading={printing}>
        <Download size={16} className="mr-1.5" />
        พิมพ์ A5
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrintForklift}
        isLoading={printingForklift}
      >
        <Download size={16} className="mr-1.5" />
        พิมพ์ A5 (โฟล์คลิฟท์)
      </Button>
      {onRecordMetrics && (
        <Button variant="outline" size="sm" onClick={onRecordMetrics} className="relative">
          <BarChart3 size={16} className="mr-1.5" />
          บันทึกเมตริกซ์
          {(trip as any).actual_pallets_used != null && (
            <CheckCircle size={12} className="ml-1 text-green-600 dark:text-green-400" />
          )}
        </Button>
      )}
      {(trip.status === 'planned' || trip.status === 'in_progress') && (
        <Button variant="outline" size="sm" onClick={() => setAddOrderModalOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          เพิ่มร้านในทริป
        </Button>
      )}
      {onEdit && (
        <Button variant="primary" size="sm" onClick={() => onEdit(trip.id)}>
          <Edit size={16} className="mr-1.5" />
          แก้ไขทริป
        </Button>
      )}
    </div>
  );

  return (
    <PageLayout
      title={`ทริป ${trip.trip_number || 'N/A'}`}
      subtitle="รายละเอียดทริปส่งสินค้า"
      actions={actions}
    >
      {/* ── Tab Navigation ──────────────────────────────────────────── */}
      <TripDetailTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <TripOverviewSection
          trip={trip}
          aggregatedProducts={aggregatedProducts}
          staffDistribution={staffDistribution}
          editHistory={editHistory}
          itemChanges={itemChanges}
          postAnalyses={postAnalyses}
          pickupBreakdown={pickupBreakdown}
          vehicleImageError={vehicleImageError}
          driverImageError={driverImageError}
          onVehicleImageError={() => setVehicleImageError(true)}
          onDriverImageError={() => setDriverImageError(true)}
          onSelectImage={setSelectedImage}
          onTabChange={setActiveTab}
        />
      )}

      {activeTab === 'stores' && (
        <TripStoresDetailSection
          trip={trip}
          pickupBreakdown={pickupBreakdown}
          onAddStore={
            trip.status === 'planned' || trip.status === 'in_progress'
              ? () => setAddOrderModalOpen(true)
              : undefined
          }
        />
      )}

      {activeTab === 'products' && (
        <TripProductsDetailSection
          aggregatedProducts={aggregatedProducts}
          pickupBreakdown={pickupBreakdown}
        />
      )}

      {activeTab === 'crew' && (
        <TripCrewDetailSection tripId={tripId} onUpdate={refetch} />
      )}

      {activeTab === 'analytics' && (
        <TripAnalyticsSection
          tripId={tripId}
          tripStatus={trip.status}
          staffDistribution={staffDistribution}
          productDistribution={productDistribution}
          distributionLoading={distributionLoading}
          postAnalyses={postAnalyses}
          postAnalysisLoading={postAnalysisLoading}
          postAnalysisError={postAnalysisError}
        />
      )}

      {activeTab === 'history' && (
        <TripHistorySection
          editHistory={editHistory}
          editHistoryLoading={editHistoryLoading}
          editHistoryError={editHistoryError}
          itemChanges={itemChanges}
          itemChangesLoading={itemChangesLoading}
          itemChangesError={itemChangesError}
        />
      )}

      {activeTab === 'loading' && (
        <TripLoadingPlanSection tripId={tripId} onSaved={refetch} />
      )}

      {/* ── Modal: เพิ่มร้านในทริป ───────────────────────────────────── */}
      <Modal
        isOpen={addOrderModalOpen}
        onClose={() => {
          if (!addOrderSubmitting) setAddOrderModalOpen(false);
        }}
        title="เพิ่มร้านในทริป"
        size="large"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            เลือกออเดอร์ที่รอจัดทริปเพื่อเพิ่มร้านเข้ากับทริปนี้
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขออเดอร์, ร้านค้า..."
              value={addOrderSearch}
              onChange={(e) => setAddOrderSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
            />
          </div>

          {addOrderError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {addOrderError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              เหตุผลในการเพิ่มร้าน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addOrderReason}
              onChange={(e) => setAddOrderReason(e.target.value)}
              placeholder="เช่น เพิ่มร้านที่ตกหล่น"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
            />
          </div>

          {pendingOrdersLoading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              กำลังโหลดออเดอร์...
            </div>
          ) : pendingOrdersToShow.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {pendingOrders.length === 0
                ? 'ไม่มีออเดอร์ที่รอจัดทริป'
                : 'ออเดอร์ที่รอจัดทริปทั้งหมดอยู่ในทริปนี้แล้ว หรือไม่ตรงกับคำค้นหา'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 p-1">
              {pendingOrdersToShow.map((order: any) => {
                const isSelected = selectedOrdersToAdd.some((o: any) => o.id === order.id);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() =>
                      setSelectedOrdersToAdd((prev) =>
                        prev.some((o: any) => o.id === order.id)
                          ? prev.filter((o: any) => o.id !== order.id)
                          : [...prev, order],
                      )
                    }
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-enterprise-50 dark:bg-enterprise-900/20 border-enterprise-300 dark:border-enterprise-700'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-enterprise-600 border-enterprise-600'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isSelected && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                            {order.order_number || 'รอจัดทริป'}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {order.customer_name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {order.customer_code}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        ฿{(order.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setAddOrderModalOpen(false)}
              disabled={addOrderSubmitting}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddOrderToTrip}
              disabled={
                selectedOrdersToAdd.length === 0 ||
                !addOrderReason.trim() ||
                addOrderSubmitting
              }
              isLoading={addOrderSubmitting}
            >
              เพิ่มร้านเข้ากับทริป
              {selectedOrdersToAdd.length > 0 && ` (${selectedOrdersToAdd.length})`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Image Modal ──────────────────────────────────────────────── */}
      <ImageModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage?.url || ''}
        alt={selectedImage?.alt || ''}
        onClose={() => setSelectedImage(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
};
