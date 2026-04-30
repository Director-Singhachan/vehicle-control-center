import React, { useEffect, useMemo, useState } from 'react';
import { X, Eye, Package, ChevronDown, ChevronUp, ListTree } from 'lucide-react';

import type { PlanningLineItem, PlanningStore } from '../hooks/useTripPlanningBoard';
import { districtAreaColorClass } from '../utils/tripPlanningRouteColors';

export interface TripPlanningBacklogPostItWallProps {
  open: boolean;
  onClose: () => void;
  /** คิวที่แสดง — ใช้ชุดเดียวกับคอลัมน์คิว (เช่น filteredBacklog) */
  cards: PlanningStore[];
  onViewOrder: (order: any) => void;
}

function WallLinesList({ lines }: { lines: PlanningLineItem[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="mt-3 rounded-xl border border-current/15 bg-white/40 dark:bg-black/25 divide-y divide-current/10 max-h-[min(40vh,320px)] overflow-y-auto scrollbar-thin text-[11px]">
      {lines.map((line) => (
        <li
          key={`${line.product_id}-${line.unit ?? ''}-${line.is_bonus}`}
          className="flex justify-between gap-3 px-3 py-2 leading-snug"
        >
          <span className="min-w-0 flex-1 text-slate-900 dark:text-slate-100">
            {line.product_name}
            {line.is_bonus ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">bonus</span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums font-bold text-slate-800 dark:text-white">
            {line.quantity % 1 === 0 ? line.quantity : line.quantity.toFixed(2)}
            {line.unit ? ` ${line.unit}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WallPostItCard({
  store,
  onViewOrder,
  rotateIdx,
}: {
  store: PlanningStore;
  onViewOrder: (order: any) => void;
  rotateIdx: number;
}) {
  const [showLines, setShowLines] = useState(false);
  const colorClass = districtAreaColorClass(store.areaKey, store.districtKey);
  const lineItems = store.line_items ?? [];
  const lineQtySum = lineItems.reduce((s, l) => s + l.quantity, 0);
  const tilt = rotateIdx % 3 === 1 ? '-rotate-1' : rotateIdx % 3 === 2 ? 'rotate-1' : '';

  return (
    <article
      className={`rounded-2xl border-2 shadow-lg border-black/10 dark:border-black/30 p-4 md:p-5 ${colorClass} ${tilt} transition-transform hover:scale-[1.01] hover:shadow-xl`}
      style={{ boxShadow: '4px 6px 0 rgba(0,0,0,0.12)' }}
    >
      <header className="flex justify-between items-start gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider opacity-80 leading-tight">
            <span className="block truncate">{store.districtKey || 'ไม่ระบุอำเภอ'}</span>
            {store.subDistrictKey ? (
              <span className="block truncate text-[10px] font-bold normal-case mt-1 opacity-85">{store.subDistrictKey}</span>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-md bg-black/[0.08] dark:bg-white/[0.12] text-[10px] font-black">
          {store.orders.length} บิล
        </span>
      </header>
      <h2 className="text-base md:text-lg font-black leading-snug mb-2 text-slate-950 dark:text-white">
        {store.customer_code} — {store.customer_name}
      </h2>
      {lineItems.length > 0 ? (
        <p className="text-xs font-semibold opacity-85 mb-2">
          {lineItems.length} รายการสินค้า · รวม {lineQtySum % 1 === 0 ? lineQtySum : lineQtySum.toFixed(2)} หน่วย
        </p>
      ) : null}

      {lineItems.length > 0 ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowLines((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-current/25 bg-white/50 dark:bg-black/20 text-xs font-bold hover:bg-white/70 dark:hover:bg-black/30"
          >
            <ListTree size={14} className="shrink-0 opacity-90" aria-hidden />
            {showLines ? (
              <>
                ซ่อนรายการสินค้า
                <ChevronUp size={14} aria-hidden />
              </>
            ) : (
              <>
                แสดงรายการสินค้า ({lineItems.length})
                <ChevronDown size={14} aria-hidden />
              </>
            )}
          </button>
          {showLines ? <WallLinesList lines={lineItems} /> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-2">
        {(store.orders ?? []).map((o: any, oi: number) => (
          <button
            key={o.id ?? `o-${oi}-${o.order_number}`}
            type="button"
            title="ดูรายละเอียดบิล"
            aria-label="ดูรายละเอียดบิล"
            onClick={() => onViewOrder(o)}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-current/25 bg-white/70 dark:bg-charcoal-900/50 text-slate-800 dark:text-slate-100 hover:border-enterprise-500/50"
          >
            <Eye size={16} className="opacity-90" aria-hidden />
          </button>
        ))}
      </div>

      <footer className="flex items-center justify-between pt-3 border-t border-current/20">
        <span className="text-xs font-black tabular-nums inline-flex items-center gap-1.5 bg-black/[0.06] dark:bg-white/[0.1] px-2 py-1 rounded-lg">
          <Package size={14} className="opacity-90 shrink-0" aria-hidden />
          {store.total_pallets.toFixed(1)} PL
        </span>
      </footer>
    </article>
  );
}

export function TripPlanningBacklogPostItWall({
  open,
  onClose,
  cards,
  onViewOrder,
}: TripPlanningBacklogPostItWallProps) {
  const sorted = useMemo(() => {
    return [...cards].sort((a, b) => {
      const d = (a.districtKey || '').localeCompare(b.districtKey || '', 'th');
      if (d !== 0) return d;
      return (a.customer_name || '').localeCompare(b.customer_name || '', 'th');
    });
  }, [cards]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex flex-col bg-[#bfa88a] dark:bg-[#4a3f35]"
      role="dialog"
      aria-modal="true"
      aria-label="โหมดโพสอิทคิวรอจัด"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.22'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <header className="relative shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 bg-black/20 dark:bg-black/35 backdrop-blur-md border-b border-black/15 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-black text-white drop-shadow-sm tracking-tight">โหมดโพสอิท — คิวรอจัด</h2>
          <p className="text-xs md:text-sm font-semibold text-white/85 mt-0.5">
            {sorted.length} บิล · กดปิดหรือกด Esc เมื่อดูภาพรวมพอแล้ว
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl bg-white/95 dark:bg-charcoal-900/95 px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-600 shadow-lg hover:bg-white dark:hover:bg-charcoal-800"
        >
          <X size={18} aria-hidden />
          ปิด (กลับบอร์ดจัดคิว)
        </button>
      </header>

      <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6">
        {sorted.length === 0 ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center rounded-2xl border-2 border-dashed border-white/35 bg-white/10 px-6 py-16 text-center">
            <p className="text-base font-bold text-white/90">ไม่มีบิลในคิวตามตัวกรองปัจจุบัน</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 max-w-[1920px] mx-auto pb-8">
            {sorted.map((store, idx) => (
              <WallPostItCard key={store.id} store={store} onViewOrder={onViewOrder} rotateIdx={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
