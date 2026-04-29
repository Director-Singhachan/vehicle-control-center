/**
 * Form state, validation, and handlers for Delivery Trip create/edit form.
 * Extracted from DeliveryTripFormView (Phase 3.2) — no logic change, move only.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDeliveryTrip } from './useDeliveryTrips';
import { useVehicles } from './useVehicles';
import { useStores } from './useStores';
import { useProducts } from './useProducts';
import { deliveryTripService, type CreateDeliveryTripData, type UpdateDeliveryTripData } from '../services/deliveryTripService';
import { tripLogService } from '../services/tripLogService';
import { storeService, type Store } from '../services/storeService';
import { productService, type Product } from '../services/productService';
import { profileService } from '../services/profileService';
import { serviceStaffService } from '../services/serviceStaffService';
import { calculateTripCapacity } from '../utils/tripCapacityValidation';
import { calculatePalletAllocation, type PalletPackingResult } from '../utils/palletPacking';
import { type StoreWithItems, storesAndItemsEqual } from '../types/deliveryTripForm';

export type { StoreWithItems };

export interface UseDeliveryTripFormOptions {
  tripId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function useDeliveryTripForm({ tripId, onSave, onCancel }: UseDeliveryTripFormOptions) {
  const isEdit = !!tripId;
  const { trip, loading: loadingTrip } = useDeliveryTrip(tripId || null);
  const { vehicles, loading: loadingVehicles } = useVehicles();

  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    planned_date: new Date().toISOString().split('T')[0],
    odometer_start: '',
    notes: '',
    has_sales_data_issue: false,
    trip_revenue: '' as string,
    trip_start_date: '' as string,
    trip_end_date: '' as string,
  });

  const [storeSearchDebounced, setStoreSearchDebounced] = useState('');
  // กรองร้านค้าเฉพาะสาขาเดียวกับทริป (แก้ไข) หรือสาขาของรถที่เลือก (สร้างใหม่)
  const branchForStores = trip?.branch ?? (formData.vehicle_id ? vehicles.find((v) => v.id === formData.vehicle_id)?.branch ?? undefined : undefined);
  const { stores, loading: loadingStores } = useStores({
    is_active: true,
    search: storeSearchDebounced || undefined,
    branch: branchForStores ?? undefined,
  });

  const [storeCache, setStoreCache] = useState<Map<string, Store>>(new Map());
  useEffect(() => {
    if (stores.length > 0) {
      setStoreCache(prev => {
        const newCache = new Map(prev);
        stores.forEach(store => newCache.set(store.id, store));
        return newCache;
      });
    }
  }, [stores]);

  const getStoreInfo = useCallback((storeId: string): Store | null => {
    const store = stores.find(s => s.id === storeId);
    if (store) return store;
    return storeCache.get(storeId) || null;
  }, [stores, storeCache]);

  const [productSearch, setProductSearch] = useState<Map<number, string>>(new Map());
  const [productSearchDebounced, setProductSearchDebounced] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    productSearch.forEach((search, storeIndex) => {
      const timer = setTimeout(() => {
        setProductSearchDebounced(prev => {
          const newMap = new Map(prev);
          if (search?.trim()) newMap.set(storeIndex, search.trim());
          else newMap.delete(storeIndex);
          return newMap;
        });
      }, 300);
      timers.push(timer);
    });
    setProductSearchDebounced(prev => {
      const currentKeys = new Set(productSearch.keys());
      const newMap = new Map(prev);
      prev.forEach((_, key) => { if (!currentKeys.has(key)) newMap.delete(key); });
      return newMap;
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [productSearch]);

  const activeProductSearch = Array.from(productSearchDebounced.values())
    .find((s): s is string => typeof s === 'string' && s.trim().length > 0) || '';

  const { products, loading: loadingProducts } = useProducts({
    is_active: true,
    search: activeProductSearch || undefined,
  });

  const [productCache, setProductCache] = useState<Map<string, Product>>(new Map());
  useEffect(() => {
    if (products.length > 0) {
      setProductCache(prev => {
        const newCache = new Map(prev);
        products.forEach(p => newCache.set(p.id, p));
        return newCache;
      });
    }
  }, [products]);

  const getProductInfo = useCallback((productId: string): Product | null => {
    const product = products.find(p => p.id === productId);
    if (product) return product;
    return productCache.get(productId) || null;
  }, [products, productCache]);

  const cacheProduct = useCallback((product: Product) => {
    setProductCache(prev => {
      const newCache = new Map(prev);
      newCache.set(product.id, product);
      return newCache;
    });
  }, []);

  const getFilteredProducts = useMemo(() => {
    return (storeIndex: number) => {
      const searchTerm = productSearchDebounced.get(storeIndex);
      if (!searchTerm) return Array.from(productCache.values());
      if (searchTerm === activeProductSearch) return products;
      const searchLower = searchTerm.toLowerCase();
      return Array.from(productCache.values()).filter((p: Product) =>
        (p.product_code || '').toLowerCase().includes(searchLower) ||
        (p.product_name || '').toLowerCase().includes(searchLower) ||
        (p.category || '').toLowerCase().includes(searchLower)
      );
    };
  }, [products, productSearchDebounced, activeProductSearch, productCache]);

  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const [selectedStores, setSelectedStores] = useState<StoreWithItems[]>([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStoreSearchDebounced(storeSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [storeSearch]);

  const [expandedStoreIndex, setExpandedStoreIndex] = useState<number | null>(null);
  const [productQuantityInput, setProductQuantityInput] = useState<Map<string, string>>(new Map());

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [latestOdometer, setLatestOdometer] = useState<number | null>(null);
  const [activeVehicleIds, setActiveVehicleIds] = useState<Set<string>>(new Set());
  const [vehiclesWithActiveTickets, setVehiclesWithActiveTickets] = useState<Set<string>>(new Set());
  const [vehiclesWithActiveDeliveryTrips, setVehiclesWithActiveDeliveryTrips] = useState<Set<string>>(new Set());

  const vehicleInputRef = useRef<HTMLDivElement>(null);
  const storeInputRef = useRef<HTMLDivElement>(null);
  const initialStoresRef = useRef<StoreWithItems[] | null>(null);
  /** กัน vehicles refetch (array ใหม่) ทำให้ hydrate รันซ้ำแล้วทับคนขับที่ผู้ใช้เลือกอยู่ */
  const tripHydrateKeyRef = useRef<string | null>(null);
  const [vehicleDropdownPosition, setVehicleDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    tripHydrateKeyRef.current = null;
  }, [tripId]);

  const [availableStaff, setAvailableStaff] = useState<Array<{ id: string; name: string; employee_code?: string | null; branch?: string | null; staffRole?: string | null }>>([]);
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([]);
  const [helperSearch, setHelperSearch] = useState('');
  const [showHelperDropdown, setShowHelperDropdown] = useState(false);
  const helperInputRef = useRef<HTMLDivElement>(null);
  const [helperDropdownPosition, setHelperDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const [selectedDriverStaffId, setSelectedDriverStaffId] = useState<string>('');
  const [driverStaffSearch, setDriverStaffSearch] = useState('');
  const [showDriverStaffDropdown, setShowDriverStaffDropdown] = useState(false);
  const driverStaffInputRef = useRef<HTMLDivElement>(null);
  const [driverStaffDropdownPosition, setDriverStaffDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // เลือกเป็นคนขับแล้ว เอาออกจากพนักงานบริการอัตโนมัติ (กันสองบทบาทพร้อมกัน)
  useEffect(() => {
    if (!selectedDriverStaffId) return;
    setSelectedHelpers(prev =>
      prev.includes(selectedDriverStaffId) ? prev.filter(h => h !== selectedDriverStaffId) : prev
    );
  }, [selectedDriverStaffId]);

  const [editReason, setEditReason] = useState('');
  const [capacitySummary, setCapacitySummary] = useState<{
    totalPallets: number;
    totalWeightKg: number;
    totalHeightCm: number;
    vehicleMaxPallets: number | null;
    vehicleMaxWeightKg: number | null;
    vehicleMaxHeightCm: number | null;
    loading: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [palletPackingResult, setPalletPackingResult] = useState<PalletPackingResult | null>(null);

  useEffect(() => {
    if (!formData.vehicle_id || selectedStores.length === 0) {
      setCapacitySummary(null);
      return;
    }
    const allItems = selectedStores.flatMap(store =>
      store.items.map(item => ({
        product_id: item.product_id,
        quantity: Math.max(0, item.quantity - (item.quantity_picked_up_at_store ?? 0)),
      }))
    );
    if (allItems.length === 0) {
      setCapacitySummary(null);
      return;
    }
    setCapacitySummary(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as any));
    const timeoutId = setTimeout(() => {
      calculateTripCapacity(allItems, formData.vehicle_id)
        .then(result => {
          setCapacitySummary({
            totalPallets: result.summary.totalPallets,
            totalWeightKg: result.summary.totalWeightKg,
            totalHeightCm: result.summary.totalHeightCm || 0,
            vehicleMaxPallets: result.summary.vehicleMaxPallets,
            vehicleMaxWeightKg: result.summary.vehicleMaxWeightKg,
            vehicleMaxHeightCm: result.summary.vehicleMaxHeightCm || null,
            loading: false,
            errors: result.errors,
            warnings: result.warnings,
          });
        })
        .catch(err => {
          setCapacitySummary(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as any));
        });
      calculatePalletAllocation(allItems)
        .then(packing => setPalletPackingResult(packing.errors.length > 0 ? null : packing))
        .catch(() => setPalletPackingResult(null));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.vehicle_id, selectedStores]);

  useEffect(() => {
    if (!trip || vehicles.length === 0) return;
    const hydrateKey = `${trip.id}:${trip.updated_at ?? ''}`;
    if (tripHydrateKeyRef.current === hydrateKey) {
      return;
    }
    tripHydrateKeyRef.current = hydrateKey;

    setFormData({
      vehicle_id: trip.vehicle_id || '',
      driver_id: trip.driver_id || '',
      planned_date: trip.planned_date || new Date().toISOString().split('T')[0],
      odometer_start: trip.odometer_start?.toString() || '',
      notes: trip.notes || '',
      has_sales_data_issue: Boolean((trip as { has_sales_data_issue?: boolean }).has_sales_data_issue),
      trip_revenue: (trip as any).trip_revenue != null ? String((trip as any).trip_revenue) : '',
      trip_start_date: (trip as any).trip_start_date ? String((trip as any).trip_start_date).split('T')[0] : '',
      trip_end_date: (trip as any).trip_end_date ? String((trip as any).trip_end_date).split('T')[0] : '',
    });
    if (trip.crews) {
      const helpers = trip.crews.filter(c => c.role === 'helper' && c.status === 'active').map(c => c.staff_id);
      setSelectedHelpers(helpers);
      const driverCrew = trip.crews.find(c => c.role === 'driver' && c.status === 'active');
      if (driverCrew) {
        setSelectedDriverStaffId(driverCrew.staff_id);
        const crewStaff = (driverCrew as { staff?: { name?: string; employee_code?: string | null } }).staff;
        if (crewStaff?.name) {
          setDriverStaffSearch(`${crewStaff.name}${crewStaff.employee_code ? ` (${crewStaff.employee_code})` : ''}`);
        } else {
          const driverStaff = availableStaff.find(s => s.id === driverCrew.staff_id);
          if (driverStaff) setDriverStaffSearch(`${driverStaff.name}${driverStaff.employee_code ? ` (${driverStaff.employee_code})` : ''}`);
        }
      } else {
        setSelectedDriverStaffId('');
        setDriverStaffSearch('');
      }
    } else {
      setSelectedDriverStaffId('');
      setDriverStaffSearch('');
    }
    const selectedVehicle = vehicles.find(v => v.id === trip.vehicle_id);
    if (selectedVehicle) setVehicleSearch(`${selectedVehicle.plate}${selectedVehicle.make && selectedVehicle.model ? ` (${selectedVehicle.make} ${selectedVehicle.model})` : ''}`);

    if (trip.stores && isEdit && selectedStores.length === 0) {
      const storesWithItems: StoreWithItems[] = trip.stores.map(store => ({
        store_id: store.store_id,
        sequence_order: store.sequence_order,
        items: (store.items || []).map(item => ({
          item_id: item.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          quantity_picked_up_at_store: Number((item as any).quantity_picked_up_at_store ?? 0),
          notes: item.notes || '',
          selected_pallet_config_id: (item as any).selected_pallet_config_id || undefined,
          unit:
            (item as { unit?: string | null }).unit != null &&
            String((item as { unit?: string | null }).unit).trim() !== ''
              ? String((item as { unit?: string | null }).unit).trim()
              : null,
        })),
      }));
      setSelectedStores(storesWithItems);
      initialStoresRef.current = JSON.parse(JSON.stringify(storesWithItems));
      const fetchStoreAndProductInfo = async () => {
        const storeIds = storesWithItems.map(s => s.store_id);
        const productIds = new Set<string>();
        storesWithItems.forEach(store => { store.items.forEach(item => productIds.add(item.product_id)); });
        const [fetchedStores, fetchedProducts] = await Promise.all([
          Promise.all(storeIds.map(id => storeService.getById(id).catch(() => null))),
          Promise.all(Array.from(productIds).map(id => productService.getById(id).catch(() => null))),
        ]);
        const validStores = fetchedStores.filter((s): s is Store => s !== null);
        if (validStores.length > 0) setStoreCache(prev => { const m = new Map(prev); validStores.forEach(s => m.set(s.id, s)); return m; });
        const validProducts = fetchedProducts.filter((p): p is Product => p !== null);
        if (validProducts.length > 0) setProductCache(prev => { const m = new Map(prev); validProducts.forEach(p => m.set(p.id, p)); return m; });
      };
      fetchStoreAndProductInfo();
    }
  }, [trip, vehicles, isEdit]);

  const normalizeText = (text: string) => (!text ? '' : text.toLowerCase().trim());
  const createSearchableText = (...texts: (string | null | undefined)[]) =>
    texts.filter(Boolean).map(t => normalizeText(t!)).join(' ');

  /** สตริงเดียวกับตอน hydrate / เลือกรถ — ใช้เทียบว่า user ยังไม่พิมพ์ค้นหา (แค่ข้อความเต็มของรถเดิม) */
  const currentVehicleLabel = useMemo(() => {
    if (!formData.vehicle_id) return '';
    const v = vehicles.find((x) => x.id === formData.vehicle_id);
    if (!v) return '';
    return `${v.plate || ''}${v.make && v.model ? ` (${v.make} ${v.model})` : ''}`.trim();
  }, [vehicles, formData.vehicle_id]);

  /**
   * ตอนแก้ไขทริป ช่อง "รถ" เติมข้อความเต็มของรถปัจจุบัน — ถ้าใช้ตัวนี้กรองตรง ๆ
   * รถอื่นจะไม่ match สตริงนั้น จึงเหลือ 0–1 คันในรายการ (ดูเหมือนเปลี่ยนรถไม่ได้)
   * ถ้าข้อความในช่องยังเท่ากับป้ายรถที่เลือกอยู่ ให้ถือว่า "ยังไม่ค้นหา" แล้วแสดงรายการรถทั้งหมด
   */
  const effectiveVehicleSearch = useMemo(() => {
    if (!vehicleSearch.trim()) return '';
    if (
      formData.vehicle_id &&
      currentVehicleLabel &&
      normalizeText(vehicleSearch) === normalizeText(currentVehicleLabel)
    ) {
      return '';
    }
    return vehicleSearch;
  }, [vehicleSearch, formData.vehicle_id, currentVehicleLabel]);

  const filteredVehicles = useMemo(() => {
    if (!effectiveVehicleSearch) return vehicles;
    const searchLower = normalizeText(effectiveVehicleSearch);
    return vehicles.filter(v =>
      normalizeText(v.plate || '').includes(searchLower) ||
      normalizeText(v.make || '').includes(searchLower) ||
      normalizeText(v.model || '').includes(searchLower) ||
      createSearchableText(v.plate, v.make, v.model).includes(searchLower)
    );
  }, [vehicles, effectiveVehicleSearch]);

  const filteredStores = useMemo(() => {
    if (!storeSearchDebounced?.trim()) return [];
    const searchLower = normalizeText(storeSearchDebounced);
    const searchTrimmed = searchLower.trim();
    const scoredStores = stores.map(store => {
      const rawCode = (store.customer_code || '').trim();
      const rawName = (store.customer_name || '').trim();
      const codeLower = normalizeText(rawCode);
      const nameLower = normalizeText(rawName);
      let score = 0;
      let matches = false;
      if (codeLower === searchTrimmed) { score = 1000; matches = true; }
      else if (codeLower.startsWith(searchTrimmed)) { score = 500; matches = true; }
      else if (codeLower.includes(searchTrimmed)) { score = 300; matches = true; }
      else if (nameLower === searchTrimmed) { score = 200; matches = true; }
      else if (nameLower.startsWith(searchTrimmed)) { score = 150; matches = true; }
      else if (nameLower.includes(searchTrimmed)) { score = 100; matches = true; }
      else {
        const searchNoSpecial = searchTrimmed.replace(/[-\s_]/g, '');
        const codeNoSpecial = codeLower.replace(/[-\s_]/g, '');
        if (searchNoSpecial && codeNoSpecial.includes(searchNoSpecial)) { score = 50; matches = true; }
        else if (searchNoSpecial && codeLower.includes(searchNoSpecial)) { score = 40; matches = true; }
        else if (rawCode.toLowerCase().includes(searchTrimmed)) { score = 30; matches = true; }
        else {
          const codeSegments = codeLower.split(/[-\s_]/).filter(s => s.length > 0);
          const searchSegments = searchTrimmed.split(/[-\s_]/).filter(s => s.length > 0);
          if (searchSegments.some(ss => codeSegments.some(cs => cs.startsWith(ss) || cs.includes(ss) || ss.includes(cs)))) { score = 20; matches = true; }
          else {
            const nameWords = nameLower.split(/\s+/).filter(w => w.length > 0);
            const searchWords = searchTrimmed.split(/\s+/).filter(w => w.length > 0);
            if (searchWords.some(sw => nameWords.some(nw => nw.startsWith(sw) || nw.includes(sw) || sw.includes(nw)))) { score = 10; matches = true; }
            else if (createSearchableText(store.customer_code, store.customer_name, store.address, store.contact_person).includes(searchTrimmed)) { score = 5; matches = true; }
          }
        }
      }
      return { store, score, matches };
    });
    return scoredStores.filter(i => i.matches).sort((a, b) => b.score - a.score).map(i => i.store).slice(0, 100);
  }, [stores, storeSearchDebounced]);

  useEffect(() => { tripLogService.getActiveTripsByVehicle().then(trips => setActiveVehicleIds(new Set(trips.map(t => t.vehicle_id)))).catch(() => setActiveVehicleIds(new Set())); }, []);
  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) =>
      supabase.from('tickets').select('vehicle_id').in('status', ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress'])
        .then(({ data, error }) => {
          if (error) setVehiclesWithActiveTickets(new Set());
          else setVehiclesWithActiveTickets(new Set((data || []).map((t: any) => t.vehicle_id).filter(Boolean)));
        })
    ).catch(() => setVehiclesWithActiveTickets(new Set()));
  }, []);
  useEffect(() => {
    deliveryTripService.getAll({ status: ['planned', 'in_progress'] })
      .then(trips => setVehiclesWithActiveDeliveryTrips(new Set(trips.map(t => t.vehicle_id))))
      .catch(() => setVehiclesWithActiveDeliveryTrips(new Set()));
  }, []);
  useEffect(() => {
    setLoadingDrivers(true);
    profileService.getAll()
      .then(profiles => setDrivers(profiles.filter(p => p.role === 'driver').map(p => ({ id: p.id, full_name: p.full_name || '' }))))
      .catch(() => setDrivers([]))
      .finally(() => setLoadingDrivers(false));
  }, []);
  useEffect(() => {
    serviceStaffService.getAllActiveWithBranch().then(staff => setAvailableStaff(staff.map(s => ({ id: s.id, name: s.name, employee_code: s.employee_code, branch: s.branch, staffRole: s.staffRole })))).catch(() => {});
  }, []);
  // แสดง「เลขไมล์ล่าสุด」ใต้ช่อง ตามรถที่เลือก (โหลด/เปลี่ยนรถ)
  useEffect(() => {
    if (!formData.vehicle_id) {
      setLatestOdometer(null);
      return;
    }
    tripLogService
      .getLastOdometer(formData.vehicle_id)
      .then((last) => setLatestOdometer(last))
      .catch(() => setLatestOdometer(null));
  }, [formData.vehicle_id]);

  /** เมื่อผู้ใช้เลือกรถจากรายการ: เติม「ไมล์เริ่มต้น」เป็นเลขไมล์ล่าสุดของคันที่เลือก (รวมตอนแก้ทริปสลับรถ) */
  const handleSelectVehicle = useCallback((vehicleId: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;
    setShowVehicleDropdown(false);
    setVehicleDropdownPosition(null);
    setTimeout(() => {
      setFormData((prev) => ({ ...prev, vehicle_id: vehicleId }));
      setVehicleSearch(
        `${vehicle.plate}${vehicle.make && vehicle.model ? ` (${vehicle.make} ${vehicle.model})` : ''}`,
      );
      void tripLogService
        .getLastOdometer(vehicleId)
        .then((last) => {
          setFormData((prev) => ({
            ...prev,
            odometer_start: last != null ? String(last) : '',
          }));
        })
        .catch(() => {
          setFormData((prev) => ({ ...prev, odometer_start: '' }));
        });
    }, 0);
  }, [vehicles]);

  const handleAddStore = useCallback((storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) setStoreCache(prev => { const m = new Map(prev); m.set(storeId, store); return m; });
    setSelectedStores(prev => {
      if (prev.find(s => s.store_id === storeId)) return prev;
      const newStore: StoreWithItems = { store_id: storeId, sequence_order: prev.length + 1, items: [] };
      const next = [...prev, newStore];
      setTimeout(() => { setStoreSearch(''); setShowStoreDropdown(false); setExpandedStoreIndex(next.length - 1); }, 0);
      return next;
    });
  }, [stores]);

  useEffect(() => {
    const update = (ref: React.RefObject<HTMLDivElement | null>, show: boolean, setPos: (p: { top: number; left: number; width: number } | null) => void) => {
      if (ref.current && show) {
        const rect = ref.current.getBoundingClientRect();
        setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
      } else setPos(null);
    };
    const uv = () => update(vehicleInputRef, showVehicleDropdown, setVehicleDropdownPosition);
    const uh = () => update(helperInputRef, showHelperDropdown, setHelperDropdownPosition);
    const ud = () => update(driverStaffInputRef, showDriverStaffDropdown, setDriverStaffDropdownPosition);
    uv(); uh(); ud();
    window.addEventListener('scroll', uv, true); window.addEventListener('resize', uv);
    window.addEventListener('scroll', uh, true); window.addEventListener('resize', uh);
    window.addEventListener('scroll', ud, true); window.addEventListener('resize', ud);
    return () => {
      window.removeEventListener('scroll', uv, true); window.removeEventListener('resize', uv);
      window.removeEventListener('scroll', uh, true); window.removeEventListener('resize', uh);
      window.removeEventListener('scroll', ud, true); window.removeEventListener('resize', ud);
    };
  }, [showVehicleDropdown, showHelperDropdown, showDriverStaffDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-vehicle-dropdown-portal]') && !target.closest('[data-vehicle-dropdown]') && !target.closest('[data-vehicle-input]')) {
        setShowVehicleDropdown(false); setVehicleDropdownPosition(null);
      }
      if (!target.closest('[data-store-dropdown-portal]') && !target.closest('[data-store-dropdown]') && !target.closest('[data-store-input]')) setShowStoreDropdown(false);
      if (!target.closest('[data-helper-dropdown-portal]') && !target.closest('[data-helper-dropdown]') && !target.closest('[data-helper-input]')) {
        setShowHelperDropdown(false); setHelperDropdownPosition(null);
      }
      if (!target.closest('[data-driver-staff-dropdown-portal]') && !target.closest('[data-driver-staff-dropdown]') && !target.closest('[data-driver-staff-input]')) {
        setShowDriverStaffDropdown(false); setDriverStaffDropdownPosition(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRemoveStore = useCallback((index: number) => {
    const newStores = selectedStores.filter((_, i) => i !== index).map((store, i) => ({ ...store, sequence_order: i + 1 }));
    setSelectedStores(newStores);
    if (expandedStoreIndex === index) setExpandedStoreIndex(null);
    else if (expandedStoreIndex !== null && expandedStoreIndex > index) setExpandedStoreIndex(expandedStoreIndex - 1);
  }, [selectedStores, expandedStoreIndex]);

  const handleAddProduct = useCallback((storeIndex: number, productId: string, quantity: number = 1) => {
    let product = getProductInfo(productId);
    if (!product) {
      productService.getById(productId).then(fetched => {
        if (fetched) { cacheProduct(fetched); handleAddProduct(storeIndex, productId, quantity); }
      }).catch(() => {});
      return;
    }
    cacheProduct(product);
    setSelectedStores(prev => {
      const newStores = prev.map(s => ({ ...s, items: [...s.items] }));
      const store = newStores[storeIndex];
      if (!store) return prev;
      const existingIndex = store.items.findIndex(item => item.product_id === productId);
      if (existingIndex >= 0) {
        store.items[existingIndex] = {
          ...store.items[existingIndex],
          quantity,
          unit:
            store.items[existingIndex].unit != null && String(store.items[existingIndex].unit).trim() !== ''
              ? String(store.items[existingIndex].unit).trim()
              : product.unit ?? null,
        };
      }
      else store.items.push({ product_id: productId, quantity, notes: '', unit: product.unit ?? null });
      return newStores;
    });
  }, [getProductInfo, cacheProduct]);

  const handleRemoveProduct = useCallback((storeIndex: number, itemIndex: number) => {
    const newStores = [...selectedStores];
    newStores[storeIndex].items = newStores[storeIndex].items.filter((_, i) => i !== itemIndex);
    setSelectedStores(newStores);
  }, [selectedStores]);

  const handleUpdateQuantity = useCallback((storeIndex: number, itemIndex: number, quantity: number) => {
    const newStores = [...selectedStores];
    newStores[storeIndex].items[itemIndex].quantity = quantity;
    setSelectedStores(newStores);
  }, [selectedStores]);

  const aggregatedProducts = useMemo(() => {
    const productMap = new Map<string, { product_id: string; product_code: string; product_name: string; category: string; unit: string; total_quantity: number; stores: Array<{ store_id: string; customer_name: string; quantity: number }> }>();
    selectedStores.forEach((storeWithItems) => {
      const store = getStoreInfo(storeWithItems.store_id);
      if (!store) return;
      storeWithItems.items.forEach(item => {
        const product = getProductInfo(item.product_id);
        if (!product) return;
        const lineUnit =
          item.unit != null && String(item.unit).trim() !== '' ? String(item.unit).trim() : product.unit || '';
        const aggKey = `${item.product_id}\u0001${lineUnit}`;
        const existing = productMap.get(aggKey);
        if (existing) {
          existing.total_quantity += item.quantity;
          existing.stores.push({ store_id: store.id, customer_name: store.customer_name, quantity: item.quantity });
        } else {
          productMap.set(aggKey, {
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            category: product.category,
            unit: lineUnit || product.unit,
            total_quantity: item.quantity,
            stores: [{ store_id: store.id, customer_name: store.customer_name, quantity: item.quantity }],
          });
        }
      });
    });
    return Array.from(productMap.values());
  }, [selectedStores, getStoreInfo, getProductInfo]);

  const destinations = useMemo(() =>
    selectedStores.sort((a, b) => a.sequence_order - b.sequence_order)
      .map(s => getStoreInfo(s.store_id)).filter(Boolean).map(s => `${s!.customer_code} - ${s!.customer_name}`).join(', '),
    [selectedStores, getStoreInfo]
  );

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.tagName !== 'BUTTON' && (target as HTMLInputElement).type !== 'submit') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!formData.vehicle_id) { setError('กรุณาเลือกรถ'); return; }
    if (!formData.driver_id) { setError('กรุณาเลือกคนขับ'); return; }
    if (!formData.planned_date) { setError('กรุณาเลือกวันที่วางแผน'); return; }
    if (selectedStores.length === 0) { setError('กรุณาเลือกร้านค้าอย่างน้อย 1 ร้าน'); return; }
    for (const store of selectedStores) {
      if (store.items.length === 0) {
        setError(`กรุณาเลือกสินค้าสำหรับ ${getStoreInfo(store.store_id)?.customer_name || 'ร้านค้า'}`);
        return;
      }
    }
    if (isEdit && (!editReason || !editReason.trim())) { setError('กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป'); return; }

    if (formData.vehicle_id) {
      try {
        const allItems = selectedStores.flatMap(store => store.items.map(item => ({ product_id: item.product_id, quantity: item.quantity })));
        if (allItems.length > 0) {
          const capacityResult = await calculateTripCapacity(allItems, formData.vehicle_id);
          if (!capacityResult.valid) {
            let errorsToCheck = capacityResult.errors;
            if (palletPackingResult && capacityResult.summary.vehicleMaxPallets != null) {
              errorsToCheck = errorsToCheck.filter(err => !err.includes('จำนวนพาเลทเกินความจุ'));
              if (palletPackingResult.totalPallets > capacityResult.summary.vehicleMaxPallets)
                errorsToCheck.push(`จำนวนพาเลทเกินความจุ: ${palletPackingResult.totalPallets} พาเลท (สูงสุด ${capacityResult.summary.vehicleMaxPallets} พาเลท)`);
            }
            if (errorsToCheck.length > 0) {
              setError(`ไม่สามารถสร้างทริปได้:\n${errorsToCheck.join('\n')}`);
              return;
            }
          }
        }
      } catch (_) {}
    }

    try {
      setSaving(true);
      if (isEdit && tripId) {
        const updateData: UpdateDeliveryTripData = {
          vehicle_id: formData.vehicle_id,
          driver_id: formData.driver_id || undefined,
          driver_staff_id: selectedDriverStaffId || undefined,
          planned_date: formData.planned_date,
          odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
          notes: formData.notes || undefined,
          has_sales_data_issue: formData.has_sales_data_issue,
          trip_revenue: formData.trip_revenue !== '' && !Number.isNaN(Number(formData.trip_revenue)) ? Number(formData.trip_revenue) : undefined,
          trip_start_date: formData.trip_start_date || undefined,
          trip_end_date: formData.trip_end_date || undefined,
          edit_reason: editReason,
          helpers: selectedHelpers,
        };
        if (!storesAndItemsEqual(selectedStores, initialStoresRef.current)) {
          updateData.stores = selectedStores.map(store => ({
            store_id: store.store_id,
            sequence_order: store.sequence_order,
            items: store.items.map(item => {
              const line =
                item.unit != null && String(item.unit).trim() !== ''
                  ? String(item.unit).trim()
                  : null;
              const p = getProductInfo(item.product_id);
              const master = p?.unit ? String(p.unit) : null;
              return {
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.notes || undefined,
                selected_pallet_config_id: item.selected_pallet_config_id || undefined,
                unit: line ?? master,
              };
            }),
          }));
        }
        await deliveryTripService.update(tripId, updateData);
      } else {
        const createData: CreateDeliveryTripData = {
          vehicle_id: formData.vehicle_id,
          driver_id: formData.driver_id || undefined,
          driver_staff_id: selectedDriverStaffId || undefined,
          planned_date: formData.planned_date,
          odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
          notes: formData.notes || undefined,
          has_sales_data_issue: formData.has_sales_data_issue,
          helpers: selectedHelpers,
          stores: selectedStores.map(store => ({
            store_id: store.store_id,
            sequence_order: store.sequence_order,
            items: store.items.map(item => {
              const line =
                item.unit != null && String(item.unit).trim() !== ''
                  ? String(item.unit).trim()
                  : null;
              const p = getProductInfo(item.product_id);
              const master = p?.unit ? String(p.unit) : null;
              return {
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.notes || undefined,
                selected_pallet_config_id: item.selected_pallet_config_id || undefined,
                unit: line ?? master,
              };
            }),
          })),
        };
        await deliveryTripService.create(createData);
      }
      setSuccess(true);
      setTimeout(() => onSave?.(), 1500);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถบันทึกทริปได้');
    } finally {
      setSaving(false);
    }
  }, [
    formData,
    selectedStores,
    selectedHelpers,
    selectedDriverStaffId,
    editReason,
    palletPackingResult,
    isEdit,
    tripId,
    onSave,
    getStoreInfo,
    getProductInfo,
  ]);

  return {
    isEdit,
    trip,
    loadingTrip,
    vehicles,
    loadingVehicles,
    formData,
    setFormData,
    storeSearchDebounced,
    stores,
    loadingStores,
    storeCache,
    getStoreInfo,
    productSearch,
    setProductSearch,
    productSearchDebounced,
    products,
    loadingProducts,
    productCache,
    getProductInfo,
    cacheProduct,
    getFilteredProducts,
    drivers,
    loadingDrivers,
    selectedStores,
    setSelectedStores,
    storeSearch,
    setStoreSearch,
    showStoreDropdown,
    setShowStoreDropdown,
    expandedStoreIndex,
    setExpandedStoreIndex,
    productQuantityInput,
    setProductQuantityInput,
    vehicleSearch,
    setVehicleSearch,
    showVehicleDropdown,
    setShowVehicleDropdown,
    vehicleInputRef,
    storeInputRef,
    vehicleDropdownPosition,
    setVehicleDropdownPosition,
    activeVehicleIds,
    vehiclesWithActiveTickets,
    vehiclesWithActiveDeliveryTrips,
    filteredVehicles,
    filteredStores,
    saving,
    error,
    setError,
    success,
    latestOdometer,
    tripBranch: vehicles.find(v => v.id === formData.vehicle_id)?.branch ?? null,
    availableStaff,
    selectedHelpers,
    setSelectedHelpers,
    helperSearch,
    setHelperSearch,
    showHelperDropdown,
    setShowHelperDropdown,
    helperInputRef,
    helperDropdownPosition,
    setHelperDropdownPosition,
    selectedDriverStaffId,
    setSelectedDriverStaffId,
    driverStaffSearch,
    setDriverStaffSearch,
    showDriverStaffDropdown,
    setShowDriverStaffDropdown,
    driverStaffInputRef,
    driverStaffDropdownPosition,
    setDriverStaffDropdownPosition,
    editReason,
    setEditReason,
    capacitySummary,
    palletPackingResult,
    handleSelectVehicle,
    handleAddStore,
    handleRemoveStore,
    handleAddProduct,
    handleRemoveProduct,
    handleUpdateQuantity,
    aggregatedProducts,
    destinations,
    handleFormKeyDown,
    handleSubmit,
  };
}
