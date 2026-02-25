// TripOrdersSection — ร้านค้าและสินค้า (store search + selected stores + items per store)
import React from 'react';
import { Package, Search, ChevronDown, ChevronUp, Trash2, Plus, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { PalletConfigSelector } from './PalletConfigSelector';
import type { RefObject } from 'react';
import type { StoreWithItems } from '../../types/deliveryTripForm';

interface StoreInfo {
  id: string;
  customer_code?: string | null;
  customer_name?: string | null;
}

interface ProductInfo {
  id: string;
  product_code?: string | null;
  product_name?: string | null;
  category?: string | null;
  unit?: string | null;
  product_pallet_configs?: Array<{ id: string; pallet_id: string; layers: number; units_per_layer: number; total_units: number; total_weight_kg?: number; is_default: boolean }>;
}

interface CapacitySummary {
  totalHeightCm?: number;
  vehicleMaxHeightCm?: number | null;
}

export interface TripOrdersSectionProps {
  storeSearch: string;
  setStoreSearch: (value: string) => void;
  showStoreDropdown: boolean;
  setShowStoreDropdown: (value: boolean) => void;
  storeInputRef: RefObject<HTMLDivElement | null>;
  filteredStores: Array<{ id: string; customer_code?: string | null; customer_name?: string | null }>;
  selectedStores: StoreWithItems[];
  setSelectedStores: React.Dispatch<React.SetStateAction<StoreWithItems[]>>;
  getStoreInfo: (storeId: string) => StoreInfo | null;
  onAddStore: (storeId: string) => void;
  onRemoveStore: (index: number) => void;
  expandedStoreIndex: number | null;
  setExpandedStoreIndex: (index: number | null) => void;
  productSearch: Map<number, string>;
  setProductSearch: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  getFilteredProducts: (storeIndex: number) => ProductInfo[];
  productQuantityInput: Map<string, string>;
  setProductQuantityInput: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  getProductInfo: (productId: string) => ProductInfo | null;
  onAddProduct: (storeIndex: number, productId: string, quantity: number) => void;
  onRemoveProduct: (storeIndex: number, itemIndex: number) => void;
  onUpdateQuantity: (storeIndex: number, itemIndex: number, quantity: number) => void;
  setError: (message: string | null) => void;
  capacitySummary: CapacitySummary | null;
  isEdit: boolean;
}

export const TripOrdersSection: React.FC<TripOrdersSectionProps> = ({
  storeSearch,
  setStoreSearch,
  showStoreDropdown,
  setShowStoreDropdown,
  storeInputRef,
  filteredStores,
  selectedStores,
  setSelectedStores,
  getStoreInfo,
  onAddStore,
  onRemoveStore,
  expandedStoreIndex,
  setExpandedStoreIndex,
  productSearch,
  setProductSearch,
  getFilteredProducts,
  productQuantityInput,
  setProductQuantityInput,
  getProductInfo,
  onAddProduct,
  onRemoveProduct,
  onUpdateQuantity,
  setError,
  capacitySummary,
  isEdit,
}) => {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Package size={20} />
          ร้านค้าและสินค้า
        </h3>
        <div className="relative z-10" data-store-dropdown ref={storeInputRef}>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="ค้นหาร้านค้า..."
              value={storeSearch}
              onChange={(e) => {
                setStoreSearch(e.target.value);
                setShowStoreDropdown(true);
              }}
              onFocus={() => setShowStoreDropdown(true)}
              icon={<Search size={18} />}
              className="w-64"
              data-store-input
            />
            {(
              showStoreDropdown && (
              <div
                data-store-dropdown-portal
                className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {(() => {
                  const availableStores = filteredStores.filter(store => !selectedStores.find(s => s.store_id === store.id));
                  const totalMatches = filteredStores.length;
                  return availableStores.length > 0 ? (
                    <>
                      {totalMatches > 100 && (
                        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                          แสดง {availableStores.length} จาก {totalMatches} รายการที่พบ (แสดงสูงสุด 100 รายการ)
                        </div>
                      )}
                      {availableStores.map((store) => (
                        <button
                          key={store.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAddStore(store.id);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {store.customer_code} - {store.customer_name}
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                      {storeSearch ? (totalMatches > 0 ? 'ร้านค้านี้ถูกเลือกไปแล้ว' : 'ไม่พบร้านค้าที่ค้นหา') : 'พิมพ์เพื่อค้นหาร้านค้า'}
                    </div>
                  );
                })()}
              </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {selectedStores.map((storeWithItems, storeIndex) => {
          const store = getStoreInfo(storeWithItems.store_id);
          if (!store) {
            return (
              <div key={storeWithItems.store_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {storeWithItems.sequence_order}
                    </span>
                    <div className="text-slate-500 dark:text-slate-400">
                      กำลังโหลดข้อมูลร้านค้า... (ID: {storeWithItems.store_id.substring(0, 8)}...)
                    </div>
                  </div>
                </div>
                {capacitySummary && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mt-2">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ความสูงกองสูงสุด</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {capacitySummary.totalHeightCm?.toFixed(1) || '0.0'} ซม.
                      {capacitySummary.vehicleMaxHeightCm != null && (
                        <span className="text-lg font-normal text-slate-500 dark:text-slate-400"> / {capacitySummary.vehicleMaxHeightCm} ซม.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          const isExpanded = expandedStoreIndex === storeIndex;
          const filteredProducts = getFilteredProducts(storeIndex);

          return (
            <div key={store.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-600 dark:text-enterprise-400 font-semibold">
                    {storeWithItems.sequence_order}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {store.customer_code} - {store.customer_name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {storeWithItems.items.length > 0 ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">✓ {storeWithItems.items.length} รายการสินค้า (เสร็จแล้ว)</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">⚠ ยังไม่มีสินค้า</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setExpandedStoreIndex(isExpanded ? null : storeIndex)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  <button type="button" onClick={() => onRemoveStore(storeIndex)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="ค้นหาสินค้า..."
                      value={productSearch.get(storeIndex) || ''}
                      onChange={(e) => {
                        const newSearch = new Map(productSearch);
                        newSearch.set(storeIndex, e.target.value);
                        setProductSearch(newSearch);
                      }}
                      icon={<Search size={18} />}
                    />
                  </div>

                  {filteredProducts.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">เลือกสินค้าและระบุจำนวน:</div>
                      {filteredProducts.map((product) => {
                        const inputKey = `${storeIndex}-${product.id}`;
                        const existingItem = storeWithItems.items.find(item => item.product_id === product.id);
                        const currentQuantity = productQuantityInput.get(inputKey) ?? (existingItem ? existingItem.quantity.toString() : '');
                        const isAdded = !!existingItem;
                        return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-2 p-2 rounded border ${isAdded ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium text-sm ${isAdded ? 'text-green-900 dark:text-green-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                {product.product_code}
                                {isAdded && <span className="ml-2 text-xs text-green-600 dark:text-green-400">(เพิ่มแล้ว: {existingItem!.quantity} {product.unit})</span>}
                              </div>
                              <div className={`text-xs truncate ${isAdded ? 'text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                {product.product_name} ({product.unit})
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={currentQuantity}
                                onChange={(e) => {
                                  const newMap = new Map(productQuantityInput);
                                  newMap.set(inputKey, e.target.value);
                                  setProductQuantityInput(newMap);
                                }}
                                placeholder="จำนวน"
                                className="w-20"
                                min={0}
                                step={0.01}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const quantity = parseFloat(currentQuantity);
                                  if (!quantity || quantity <= 0) {
                                    setError('กรุณาระบุจำนวนสินค้าที่มากกว่า 0');
                                    return;
                                  }
                                  onAddProduct(storeIndex, product.id, quantity);
                                  const newMap = new Map(productQuantityInput);
                                  newMap.delete(inputKey);
                                  setProductQuantityInput(newMap);
                                }}
                              >
                                <Plus size={16} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {storeWithItems.items.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>สินค้าที่เลือก ({storeWithItems.items.length} รายการ):</span>
                        <button type="button" onClick={() => setExpandedStoreIndex(null)} className="text-xs text-enterprise-600 dark:text-enterprise-400 hover:underline flex items-center gap-1">
                          <ChevronUp size={14} /> ยุบร้านนี้
                        </button>
                      </div>
                      <div className={`hidden sm:grid gap-2 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 ${isEdit ? 'sm:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto]' : 'sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]'}`}>
                        <div>รหัสสินค้า</div>
                        <div>ชื่อสินค้า</div>
                        <div>หมวดหมู่</div>
                        <div className="text-right">จำนวน / หน่วย</div>
                        {isEdit && <div className="text-right text-amber-600 dark:text-amber-400">รับที่ร้าน</div>}
                        <div className="text-center">ลบ</div>
                      </div>
                      {storeWithItems.items.map((item, itemIndex) => {
                        const product = getProductInfo(item.product_id);
                        if (!product) return null;
                        return (
                          <div
                            key={item.product_id}
                            className={`flex flex-col gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded ${isEdit ? 'sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto]' : 'sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]'}`}
                          >
                            <div className="min-w-0">
                              <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">รหัสสินค้า</div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 break-words text-sm">{product.product_code}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">ชื่อสินค้า</div>
                              <div className="text-sm text-slate-900 dark:text-slate-100 break-words">{product.product_name}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">หมวดหมู่</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{product.category}</div>
                            </div>
                            <div className="flex items-center gap-1 sm:justify-end">
                              <div className="flex-1 sm:flex-none">
                                <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">จำนวน</div>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => onUpdateQuantity(storeIndex, itemIndex, parseFloat(e.target.value) || 0)}
                                  className="w-full text-right"
                                  min={0}
                                  step={0.01}
                                />
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap pl-1">{product.unit}</div>
                            </div>
                            {isEdit && (
                              <div className="flex flex-col gap-0.5 sm:justify-end">
                                <div className="sm:hidden text-[11px] text-amber-600 dark:text-amber-400 mb-0.5">รับที่ร้านแล้ว</div>
                                <Input
                                  type="number"
                                  value={item.quantity_picked_up_at_store ?? 0}
                                  onChange={(e) => {
                                    const raw = parseFloat(e.target.value) || 0;
                                    const val = Math.min(item.quantity, Math.max(0, Math.floor(raw)));
                                    const updatedStores = [...selectedStores];
                                    updatedStores[storeIndex].items[itemIndex].quantity_picked_up_at_store = val;
                                    setSelectedStores(updatedStores);
                                  }}
                                  className="w-full text-right border-amber-300 dark:border-amber-700"
                                  min={0}
                                  max={item.quantity}
                                  step={1}
                                  title="จำนวนเต็มที่ลูกค้ารับที่ร้านแล้ว (ไม่ต้องขนส่ง)"
                                />
                                {(item.quantity_picked_up_at_store ?? 0) > 0 && (
                                  <div className="text-[10px] text-green-600 dark:text-green-400 text-right">
                                    ส่ง: {Math.max(0, item.quantity - (item.quantity_picked_up_at_store ?? 0)).toLocaleString()} {product.unit}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-end">
                              <button type="button" onClick={() => onRemoveProduct(storeIndex, itemIndex)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                <X size={16} />
                              </button>
                            </div>
                            <div className="col-span-full">
                              <PalletConfigSelector
                                productId={item.product_id}
                                productName={product.product_name || ''}
                                quantity={item.quantity}
                                configs={product.product_pallet_configs || []}
                                selectedConfigId={item.selected_pallet_config_id}
                                onChange={(configId) => {
                                  const updatedStores = [...selectedStores];
                                  updatedStores[storeIndex].items[itemIndex].selected_pallet_config_id = configId;
                                  setSelectedStores(updatedStores);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
