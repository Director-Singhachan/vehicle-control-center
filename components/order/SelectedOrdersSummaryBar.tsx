import React from 'react';
import { Box, Package } from 'lucide-react';
import { Button } from '../ui/Button';

export interface SelectedOrdersSummaryBarProps {
  selectedCount: number;
  productsTotal: number;
  selectedTotal: number;
  onShowSummary: () => void;
  onClearSelection: () => void;
  onCreateTrip: () => void;
}

export function SelectedOrdersSummaryBar({
  selectedCount,
  productsTotal,
  selectedTotal,
  onShowSummary,
  onClearSelection,
  onCreateTrip,
}: SelectedOrdersSummaryBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg mb-4 rounded-lg">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full p-2">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-blue-100">เลือกแล้ว</div>
                <div className="text-2xl font-bold">{selectedCount}</div>
              </div>
            </div>
            <div className="h-10 w-px bg-white/30" />
            <div>
              <div className="text-xs text-blue-100">สินค้ารวม</div>
              <div className="text-lg font-semibold">{productsTotal} ชิ้น</div>
            </div>
            <div className="h-10 w-px bg-white/30" />
            <div>
              <div className="text-xs text-blue-100">มูลค่ารวม</div>
              <div className="text-lg font-semibold">฿{selectedTotal.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onShowSummary}
              className="bg-white/20 hover:bg-white/30 text-white border-white/40"
            >
              <Box className="w-4 h-4 mr-1" />
              สรุปสินค้า
            </Button>
            <Button
              size="sm"
              onClick={onClearSelection}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/40"
            >
              ยกเลิกทั้งหมด
            </Button>
            <Button
              size="sm"
              onClick={onCreateTrip}
              className="bg-white/20 hover:bg-white/30 text-white border-white/40 font-semibold"
            >
              สร้างทริป
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
