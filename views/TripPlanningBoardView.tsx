import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Truck,
  Package,
  Plus,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  User,
  ClipboardList,
  X,
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageLayout } from '../components/layout/PageLayout';
import { ToastContainer } from '../components/ui/Toast';
import { Card } from '../components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';

import type {
  PlanningLane,
  PlanningSlot,
  PlanningStore,
  PlanningTripServiceType,
} from '../hooks/useTripPlanningBoard';
import { useTripPlanningBoard } from '../hooks/useTripPlanningBoard';
import { aggregateTripProductLines } from '../utils/tripPlanningMerge';
import { districtAreaColorClass } from '../utils/tripPlanningRouteColors';
import { BRANCH_ALL_VALUE, getBranchLabel } from '../utils/branchLabels';

export const TripPlanningBoardView: React.FC = () => {
  const {
    featureLoading,
    canUseBoard,
    orderScope,
    loading,
    saving,
    backlog,
    vehicles,
    drivers,
    lanes,
    fetchData,
    activeId,
    activeStore,
    searchQuery,
    setSearchQuery,
    branchFilter,
    setBranchFilter,
    boardBranchOptions,
    boardBranchSelectDisabled,
    filteredBacklog,
    selectedStoreIds,
    toggleSelectStore,
    clearSelection,
    moveSelectedToSlot,
    sensors,
    dropAnimationConfig,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    updateLaneVehicle,
    addSlotToLane,
    addLane,
    updateSlotDriver,
    updateSlotServiceType,
    toggleSlotStoresCollapsed,
    handleConfirmPlanning,
    toasts,
    dismissToast,
  } = useTripPlanningBoard();

  if (featureLoading || orderScope.loading) {
    return (
      <PageLayout title="บอร์ดจัดคิว" subtitle="กำลังตรวจสอบสิทธิ์และข้อมูล...">
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  if (!canUseBoard) {
    return (
      <PageLayout title="บอร์ดจัดคิว">
        <Card>
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">คุณไม่มีสิทธิ์เข้าถึงบอร์ดจัดคิว</p>
            <p className="text-sm mt-2">ต้องได้รับสิทธิ์ “บอร์ดจัดคิว” ในการตั้งค่าบทบาท</p>
          </div>
        </Card>
      </PageLayout>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="h-full flex flex-col gap-0 bg-slate-100 dark:bg-charcoal-950 overflow-x-hidden overflow-y-auto min-h-[70vh]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 px-4 md:px-6 py-4 bg-white dark:bg-charcoal-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-xl shrink-0">
              <Truck className="text-enterprise-600 dark:text-enterprise-400" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                บอร์ดจัดคิว
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-wider">
                  Draft
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[min(100%,28rem)]">
                  ลากร้านจากซ้ายไปรถ — กดยืนยันถึงบันทึกทริป
                </p>
              </div>
              {orderScope.unrestricted && (
                <p className="text-[10px] text-enterprise-700/90 dark:text-enterprise-400/90 font-semibold mt-1.5 leading-snug max-w-[min(100%,34rem)]">
                  {branchFilter === BRANCH_ALL_VALUE
                    ? 'คุณมองเห็นคิวได้ครบทุกสาขา — เลือกจากเมนู 「กรองสาขา」 เพื่อย่อเฉพาะสำนักงาน / สอยดาว / Asia'
                    : `กำลังแสดงเฉพาะ ${getBranchLabel(branchFilter)} — เลือก 「ทุกสาขา」 เพื่อกลับไปโหลดคิวทุกสาขา`}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-stretch lg:items-center gap-4 w-full lg:w-auto lg:justify-end min-w-0 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/95 dark:bg-charcoal-800/95 p-3 sm:p-3.5 lg:border-0 lg:bg-transparent lg:p-0 shadow-sm lg:shadow-none">
            <label className="flex items-center gap-2 sm:gap-3 text-[11px] font-black text-slate-700 dark:text-slate-100 min-w-0 w-full lg:max-w-md">
              <Building2 size={18} className="text-enterprise-600 dark:text-enterprise-400 shrink-0" aria-hidden />
              <span className="whitespace-nowrap shrink-0 text-slate-600 dark:text-slate-300">กรองสาขา</span>
              <select
                value={branchFilter}
                disabled={boardBranchSelectDisabled}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-11 min-h-[44px] min-w-0 flex-1 rounded-xl border-2 border-enterprise-500/85 dark:border-enterprise-400 bg-white dark:bg-charcoal-800/95 dark:[color-scheme:dark] px-3 text-xs font-bold text-slate-900 dark:text-slate-100 disabled:opacity-50 touch-manipulation outline-none focus:ring-2 focus:ring-enterprise-500 dark:focus:ring-enterprise-400"
                title={
                  orderScope.unrestricted
                    ? 'มองทุกสาขาเป็นค่าเริ่มต้น เลือกรหัสสาขาเพื่อโหลดเฉพาะคิวนั้น'
                    : 'แสดงเฉพาะสาขาที่คุณได้รับอนุญาต'
                }
                aria-label="กรองตามสาขา"
              >
                {boardBranchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-row flex-wrap gap-3 sm:flex-nowrap items-stretch sm:items-center justify-between sm:justify-end w-full sm:w-auto shrink-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => void fetchData()}
                disabled={loading}
                className="h-11 min-h-[44px] flex-1 sm:flex-none sm:min-w-[8.25rem] rounded-xl px-4 font-semibold border-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-charcoal-800 dark:text-slate-100 dark:hover:bg-charcoal-700 dark:hover:border-slate-500"
              >
                <RefreshCw size={18} className="shrink-0 opacity-95" aria-hidden />
                <span className="whitespace-nowrap">รีเฟรช</span>
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => void handleConfirmPlanning()}
                isLoading={saving}
                disabled={loading}
                className="h-11 min-h-[44px] flex-1 sm:flex-none sm:min-w-[10.5rem] rounded-xl px-5 font-semibold shadow-md shadow-enterprise-900/25 dark:shadow-black/50"
              >
                <CheckCircle2 size={18} className="shrink-0" aria-hidden />
                <span className="whitespace-nowrap text-left">ยืนยันจัดทริป</span>
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[min(420px,60vh)] px-6">
            <LoadingSpinner />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 text-center">
              กำลังโหลดคิวและคำนวณพาเลท…
            </p>
          </div>
        ) : (
          <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 md:p-4 gap-3 md:gap-4 min-h-0">
            <BacklogColumn
              backlog={backlog}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredBacklog={filteredBacklog}
              selectedStoreIds={selectedStoreIds}
              onToggleSelect={toggleSelectStore}
              onClearSelection={clearSelection}
            />

            <div className="flex-1 flex gap-3 overflow-x-auto pb-4 pt-1 px-1 min-h-0 scrollbar-thin">
              {lanes.map((lane) => (
                <VehicleLane
                  key={lane.id}
                  lane={lane}
                  availableVehicles={vehicles}
                  drivers={drivers}
                  onVehicleChange={(vid) => updateLaneVehicle(lane.id, vid)}
                  onSlotDriverChange={(slotId, driverId) => updateSlotDriver(lane.id, slotId, driverId)}
                  onSlotServiceTypeChange={(slotId, st) => updateSlotServiceType(lane.id, slotId, st)}
                  onToggleSlotStoresCollapsed={toggleSlotStoresCollapsed}
                  onAddSlot={() => addSlotToLane(lane.id)}
                  selectedCount={selectedStoreIds.size}
                  onMoveSelectedHere={(slotId) => moveSelectedToSlot(slotId)}
                />
              ))}

              <button
                type="button"
                className="w-72 shrink-0 h-[200px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-3xl flex flex-col items-center justify-center text-slate-500 hover:text-enterprise-600 dark:text-slate-400 dark:hover:text-enterprise-400 dark:hover:border-enterprise-600 hover:border-enterprise-400 transition-colors gap-3 group bg-slate-50/50 dark:bg-charcoal-800/40"
                onClick={addLane}
              >
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl group-hover:bg-enterprise-50 dark:group-hover:bg-enterprise-900/30">
                  <Plus size={28} />
                </div>
                <span className="font-black text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">เพิ่มคอลัมน์รถ</span>
              </button>
            </div>
          </div>

          <DragOverlay adjustScale dropAnimation={dropAnimationConfig}>
            {activeId && activeStore ? (
              <div className="opacity-95 scale-105 shadow-2xl">
                <StorePostIt
                  store={activeStore}
                  isOverlay
                  colorClass={districtAreaColorClass(activeStore.areaKey, activeStore.districtKey)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        )}

        <p className="px-4 pb-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 shrink-0">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" aria-hidden />
          รีเฟรชจะรีเซ็ตการจัดบนรถ — ยืนยันก่อนจึงสร้างทริปและผูกออเดอร์ในระบบ
        </p>
      </div>
    </>
  );
};

function BacklogColumn({
  backlog,
  searchQuery,
  setSearchQuery,
  filteredBacklog,
  selectedStoreIds,
  onToggleSelect,
  onClearSelection,
}: {
  backlog: PlanningStore[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredBacklog: PlanningStore[];
  selectedStoreIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: 'backlog-container' });

  return (
    <div className="w-full lg:w-80 flex flex-col bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm shrink-0 max-h-[min(70vh,960px)]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
          <Package size={16} className="text-enterprise-600 dark:text-enterprise-400" aria-hidden />
          คิวรอจัด ({backlog.length})
        </h2>
        <div className="mt-2">
          <Input
            placeholder="ค้นหาร้าน / เขต..."
            className="h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={14} className="text-slate-400" />}
          />
        </div>
        {selectedStoreIds.size > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-enterprise-700 dark:text-enterprise-300">
              เลือก {selectedStoreIds.size} ร้าน
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              ล้าง
            </button>
          </div>
        )}
      </div>

      <div
        ref={setNodeRef}
        id="backlog-container"
        className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-slate-50/40 dark:bg-charcoal-950/30 scrollbar-thin min-h-[200px]"
      >
        <SortableContext items={filteredBacklog.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {filteredBacklog.map((store) => (
            <StorePostIt
              key={store.id}
              store={store}
              colorClass={districtAreaColorClass(store.areaKey, store.districtKey)}
              selected={selectedStoreIds.has(store.id)}
              onToggleSelect={() => onToggleSelect(store.id)}
            />
          ))}
        </SortableContext>
        {filteredBacklog.length === 0 && (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">ไม่มีรายการในคิว</div>
        )}
      </div>
    </div>
  );
}

function formatOrderNumbersLabel(store: PlanningStore): string {
  const nums = [...new Set((store.orders ?? []).map((o: { order_number?: string }) => o.order_number).filter(Boolean))];
  return nums.length ? nums.join(', ') : '—';
}

function TripSlotProductsDialog({
  open,
  onOpenChange,
  tripIndexDisplay,
  stores,
  totalPallets,
  maxPallets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripIndexDisplay: number;
  stores: PlanningStore[];
  totalPallets: number;
  maxPallets: number;
}) {
  const tripLines = useMemo(() => aggregateTripProductLines(stores), [stores]);
  const totalUnits = useMemo(() => tripLines.reduce((s, l) => s + l.quantity, 0), [tripLines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,720px)] w-full max-w-2xl flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader className="shrink-0 pr-12">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <ClipboardList size={22} className="text-enterprise-600 dark:text-enterprise-400 shrink-0" aria-hidden />
            เที่ยวที่ {tripIndexDisplay} — สินค้าในเที่ยว
          </DialogTitle>
          <DialogDescription>
            {stores.length} ร้าน · พาเลทรวม {totalPallets.toFixed(1)} / {maxPallets} PL
            {tripLines.length > 0 && (
              <span className="block mt-1 text-slate-700 dark:text-slate-300">
                สรุป {tripLines.length} รายการสินค้า · จำนวนรวม {totalUnits % 1 === 0 ? String(totalUnits) : totalUnits.toFixed(2)} หน่วย
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-6">
          {tripLines.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">ไม่มีรายการสินค้า (คงค้างส่งแล้ว)</p>
          )}

          {tripLines.length > 0 && (
            <section aria-labelledby={`trip-sum-${tripIndexDisplay}`}>
              <h3
                id={`trip-sum-${tripIndexDisplay}`}
                className="text-xs font-black uppercase tracking-wider text-enterprise-700 dark:text-enterprise-300 mb-2"
              >
                สรุปทั้งเที่ยว (รวมทุกร้าน)
              </h3>
              <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/80 bg-slate-50/50 dark:bg-charcoal-950/40">
                {tripLines.map((line) => (
                  <li key={line.product_id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-slate-900 dark:text-slate-100 font-medium leading-snug min-w-0 flex-1">{line.product_name}</span>
                    <span className="tabular-nums font-bold text-slate-800 dark:text-white shrink-0">
                      {line.quantity % 1 === 0 ? line.quantity : line.quantity.toFixed(2)}
                      {line.unit ? ` ${line.unit}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby={`trip-by-store-${tripIndexDisplay}`}>
            <h3
              id={`trip-by-store-${tripIndexDisplay}`}
              className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2"
            >
              แยกตามร้าน
            </h3>
            <div className="space-y-3">
              {stores.map((store) => {
                const items = store.line_items ?? [];
                const storeUnits = items.reduce((s, l) => s + l.quantity, 0);
                return (
                  <div
                    key={store.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-charcoal-900/80 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {store.customer_code} — {store.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        บิล: {formatOrderNumbersLabel(store)} · {items.length} รายการสินค้า · รวม {storeUnits % 1 === 0 ? storeUnits : storeUnits.toFixed(2)} หน่วย
                      </div>
                    </div>
                    {items.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">ไม่มีรายการคงค้าง</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((line) => (
                          <li key={`${store.id}-${line.product_id}-${line.unit ?? ''}-${line.is_bonus}`} className="flex gap-3 px-3 py-1.5 text-xs">
                            <span className="text-slate-800 dark:text-slate-100 flex-1 min-w-0">{line.product_name}</span>
                            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                              {line.quantity % 1 === 0 ? line.quantity : line.quantity.toFixed(2)}
                              {line.unit ? ` ${line.unit}` : ''}
                              {line.is_bonus ? (
                                <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400">bonus</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-6 py-3 bg-slate-50/90 dark:bg-charcoal-950/60">
          <button
            type="button"
            className="w-full rounded-lg py-2.5 text-sm font-semibold bg-enterprise-600 text-white hover:bg-enterprise-700"
            onClick={() => onOpenChange(false)}
          >
            ปิด
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StorePostIt({
  store,
  colorClass,
  isOverlay,
  selected,
  onToggleSelect,
}: {
  store: PlanningStore;
  colorClass: string;
  isOverlay?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: store.id,
  });

  const lineItems = store.line_items ?? [];
  const lineQtySum = lineItems.reduce((s, l) => s + l.quantity, 0);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border shadow-sm transition-all group relative overflow-hidden ${colorClass} ${
        isOverlay ? 'shadow-2xl rotate-1 scale-110 z-50' : ''
      } ${selected ? 'ring-2 ring-enterprise-500 ring-offset-2 ring-offset-white dark:ring-charcoal-950' : ''}`}
    >
      <div className="flex items-start gap-2 p-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-current/30 bg-white/90 text-enterprise-600 focus:ring-enterprise-500 dark:bg-charcoal-900/80 dark:focus:ring-enterprise-400 shrink-0"
            aria-label={`เลือก ${store.customer_name}`}
          />
        )}
        <div className="flex-1 min-w-0 text-inherit" {...attributes} {...listeners}>
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider opacity-75 truncate">
              {store.districtKey || 'ไม่ระบุอำเภอ'}
            </span>
            <span className="bg-black/[0.06] dark:bg-white/[0.12] px-1.5 py-0.5 rounded text-[9px] font-black shrink-0">
              {store.orders.length} บิล
            </span>
          </div>
          <div className="font-bold text-sm leading-snug mb-1 line-clamp-2">
            {store.customer_code} — {store.customer_name}
          </div>
          <div className="text-[10px] opacity-80 line-clamp-2 mb-2">
            {store.address || 'ไม่มีที่อยู่'}
          </div>
          {(lineItems.length) > 0 && (
            <div className="text-[10px] font-semibold opacity-75 mb-1.5">
              {lineItems.length} รายการสินค้า · รวม{' '}
              {lineQtySum % 1 === 0 ? lineQtySum : lineQtySum.toFixed(2)} หน่วย
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-current/15">
            <div className="text-[10px] font-black flex items-center gap-1 bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.5 rounded tabular-nums">
              <Package size={10} className="text-enterprise-600 dark:text-enterprise-300 shrink-0 opacity-90" aria-hidden />
              {store.total_pallets.toFixed(1)} PL
            </div>
            <ChevronRight size={14} className="shrink-0 opacity-45 text-current" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleLane({
  lane,
  availableVehicles,
  drivers,
  onVehicleChange,
  onSlotDriverChange,
  onSlotServiceTypeChange,
  onToggleSlotStoresCollapsed,
  onAddSlot,
  selectedCount,
  onMoveSelectedHere,
}: {
  lane: PlanningLane;
  availableVehicles: any[];
  drivers: Array<{ id: string; full_name: string; branch?: string | null }>;
  onVehicleChange: (vid: string | null) => void;
  onSlotDriverChange: (slotId: string, driverId: string | null) => void;
  onSlotServiceTypeChange: (slotId: string, st: PlanningTripServiceType) => void;
  onToggleSlotStoresCollapsed: (slotId: string) => void;
  onAddSlot: () => void;
  selectedCount: number;
  onMoveSelectedHere: (slotId: string) => void;
}) {
  const vehicle = availableVehicles.find((v) => v.id === lane.vehicle_id);

  return (
    <div className="w-72 shrink-0 flex flex-col bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm max-h-[min(70vh,960px)]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`p-1.5 rounded-lg ${
              lane.vehicle_id
                ? 'bg-enterprise-100 text-enterprise-600 dark:bg-enterprise-900/40'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
            }`}
          >
            <Truck size={16} />
          </div>
          <select
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
            value={lane.vehicle_id || ''}
            onChange={(e) => onVehicleChange(e.target.value || null)}
          >
            <option value="">เลือกรถ...</option>
            {availableVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} {v.model ? `· ${v.model}` : ''}
              </option>
            ))}
          </select>
        </div>
        {vehicle ? (
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>สูงสุด</span>
            <span className="text-enterprise-600 dark:text-enterprise-400">
              {vehicle.loading_constraints?.max_pallets ?? 8} PL
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold text-center">ยังไม่เลือกรถ</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 bg-slate-50/50 dark:bg-charcoal-950/30 scrollbar-thin">
        {lane.slots.map((slot, idx) => (
          <TripSlot
            key={slot.id}
            slot={slot}
            index={idx}
            vehicle={vehicle}
            drivers={drivers}
            showMoveSelected={selectedCount > 0}
            onMoveSelectedHere={() => onMoveSelectedHere(slot.id)}
            onDriverChange={(driverId) => onSlotDriverChange(slot.id, driverId)}
            onServiceTypeChange={(st) => onSlotServiceTypeChange(slot.id, st)}
            onToggleStoresCollapsed={() => onToggleSlotStoresCollapsed(slot.id)}
          />
        ))}
        <button
          type="button"
          className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-400 hover:text-enterprise-600 flex items-center justify-center gap-1.5"
          onClick={onAddSlot}
        >
          <Plus size={14} />
          เพิ่มเที่ยว
        </button>
      </div>
    </div>
  );
}

function TripSlot({
  slot,
  index,
  vehicle,
  drivers,
  showMoveSelected,
  onMoveSelectedHere,
  onDriverChange,
  onServiceTypeChange,
  onToggleStoresCollapsed,
}: {
  slot: PlanningSlot;
  index: number;
  vehicle: any;
  drivers: Array<{ id: string; full_name: string; branch?: string | null }>;
  showMoveSelected: boolean;
  onMoveSelectedHere: () => void;
  onDriverChange: (driverId: string | null) => void;
  onServiceTypeChange: (st: PlanningTripServiceType) => void;
  onToggleStoresCollapsed: () => void;
}) {
  const [productsOpen, setProductsOpen] = useState(false);
  const { setNodeRef } = useDroppable({ id: slot.id });

  const totalPallets = useMemo(
    () => slot.stores.reduce((sum, s) => sum + s.total_pallets, 0),
    [slot.stores],
  );

  const maxPallets = Number(vehicle?.loading_constraints?.max_pallets ?? 8) || 8;
  const isOver = totalPallets > maxPallets;
  const isHigh = totalPallets >= maxPallets * 0.8 && !isOver;
  const isLow = totalPallets > 0 && totalPallets < Math.max(1, maxPallets * 0.35);
  const storesCollapsed = !!(slot.stores_collapsed && slot.stores.length > 0);
  const svc = slot.service_type ?? 'carry_in';

  return (
    <div
      ref={setNodeRef}
      id={slot.id}
      className={`rounded-2xl border-2 shadow-sm overflow-hidden transition-colors ${
        isOver
          ? 'border-red-400 bg-red-50/70 dark:bg-red-950/30'
          : isHigh
            ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/25'
            : 'border-white dark:border-slate-700 bg-white dark:bg-charcoal-900'
      }`}
    >
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2 flex-wrap bg-slate-50/80 dark:bg-slate-800/40">
        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">
          เที่ยว {index + 1}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isOver && <AlertTriangle size={12} className="text-red-500" aria-hidden />}
          {isLow && !isOver && <Info size={12} className="text-amber-600 dark:text-amber-500" aria-hidden />}
          <span
            className={`text-[11px] font-black tabular-nums ${isOver ? 'text-red-600' : isHigh ? 'text-emerald-700' : 'text-slate-600'}`}
          >
            {totalPallets.toFixed(1)} / {maxPallets} PL
          </span>
          {slot.stores.length > 0 && (
            <button
              type="button"
              onClick={onToggleStoresCollapsed}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-enterprise-100 text-enterprise-800 hover:bg-enterprise-200 dark:bg-enterprise-900/50 dark:text-enterprise-200 dark:hover:bg-enterprise-900/80"
            >
              {storesCollapsed ? `แสดง ${slot.stores.length} ร้าน` : 'ซ่อนร้าน'}
            </button>
          )}
        </div>
      </div>

      <div className="px-2 pt-2 space-y-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2">
        <label className="flex items-center gap-2 text-[10px]">
          <User size={14} className="text-slate-400 shrink-0" aria-hidden />
          <select
            value={slot.driver_id ?? ''}
            onChange={(e) => onDriverChange(e.target.value || null)}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-charcoal-800 px-2 py-1.5 text-[11px] font-semibold text-slate-900 dark:text-slate-100"
          >
            <option value="">คนขับ — ใช้ผู้ใช้ปัจจุบัน (ถ้าไม่ระบุ)</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name || d.id}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label className="sr-only" htmlFor={`svc-${slot.id}`}>
            ประเภทงาน
          </label>
          <select
            id={`svc-${slot.id}`}
            value={svc}
            onChange={(e) => onServiceTypeChange(e.target.value as PlanningTripServiceType)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-charcoal-800 px-2 py-1.5 text-[11px] font-semibold text-slate-900 dark:text-slate-100"
          >
            <option value="carry_in">ลงมือ</option>
            <option value="lift_off">ตักลง</option>
            <option value="standard">ทั่วไป (ค่ามาตรฐาน)</option>
          </select>
          <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400 px-0.5">ประเภทงานมีผลต่อเรทคอมมิชชัน</p>
        </div>
      </div>

      {slot.stores.length > 0 && (
        <div className="px-2">
          <button
            type="button"
            onClick={() => setProductsOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-charcoal-800/90 text-[11px] font-bold text-enterprise-700 dark:text-enterprise-300 hover:bg-enterprise-50 dark:hover:bg-enterprise-950/40"
          >
            <ClipboardList size={15} className="shrink-0 opacity-90" aria-hidden />
            ดูสินค้า / สรุปเที่ยว
          </button>
        </div>
      )}

      {showMoveSelected && (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={onMoveSelectedHere}
            className="w-full text-[10px] font-bold py-2 rounded-lg bg-enterprise-600 text-white hover:bg-enterprise-700 shadow-sm dark:shadow-black/30 transition-colors"
          >
            ย้ายรายการที่เลือกจากคิวมาเที่ยวนี้
          </button>
        </div>
      )}

      <div className={`p-2 space-y-2 ${storesCollapsed ? 'min-h-[48px]' : 'min-h-[100px]'}`}>
        {!storesCollapsed ? (
          <>
            <SortableContext items={slot.stores.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {slot.stores.map((store) => (
                <StorePostIt
                  key={store.id}
                  store={store}
                  colorClass={districtAreaColorClass(store.areaKey, store.districtKey)}
                />
              ))}
            </SortableContext>
            {slot.stores.length === 0 && (
              <div className="py-8 text-center text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                วางการ์ดที่นี่
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleStoresCollapsed}
            className="w-full text-left text-[11px] font-semibold text-slate-600 dark:text-slate-300 py-2 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            ซ่อนอยู่: {slot.stores.length} ร้าน · {totalPallets.toFixed(1)} PL — กดเพื่อแสดง
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOver ? 'bg-red-500' : isHigh ? 'bg-emerald-500' : 'bg-enterprise-500'
            }`}
            style={{ width: `${Math.min(100, maxPallets > 0 ? (totalPallets / maxPallets) * 100 : 0)}%` }}
          />
        </div>
      </div>

      <TripSlotProductsDialog
        open={productsOpen}
        onOpenChange={setProductsOpen}
        tripIndexDisplay={index + 1}
        stores={slot.stores}
        totalPallets={totalPallets}
        maxPallets={maxPallets}
      />
    </div>
  );
}

export default TripPlanningBoardView;
