// Delivery Trip Form View - Create/Edit delivery trip
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Trash2,
  Search,
  MapPin,
  Package,
  Truck,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTrip, useVehicles, useStores, useProducts } from '../hooks';
import { deliveryTripService, type CreateDeliveryTripData } from '../services/deliveryTripService';
import { tripLogService } from '../services/tripLogService';
import { profileService } from '../services/profileService';
import type { DeliveryTripWithRelations } from '../services/deliveryTripService';

interface DeliveryTripFormViewProps {
  tripId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface StoreWithItems {
  store_id: string;
  sequence_order: number;
  items: Array<{
    product_id: string;
    quantity: number;
    notes?: string;
  }>;
}

export const DeliveryTripFormView: React.FC<DeliveryTripFormViewProps> = ({
  tripId,
  onSave,
  onCancel,
}) => {
  const isEdit = !!tripId;
  const { trip, loading: loadingTrip } = useDeliveryTrip(tripId || null);
  const { vehicles, loading: loadingVehicles } = useVehicles();
  const { stores, loading: loadingStores } = useStores({ is_active: true });
  const { products, loading: loadingProducts } = useProducts({ is_active: true });
  
  // Drivers list
  const [drivers, setDrivers] = React.useState<Array<{ id: string; full_name: string }>>([]);
  const [loadingDrivers, setLoadingDrivers] = React.useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    planned_date: new Date().toISOString().split('T')[0],
    odometer_start: '',
    notes: '',
  });

  const [selectedStores, setSelectedStores] = useState<StoreWithItems[]>([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [expandedStoreIndex, setExpandedStoreIndex] = useState<number | null>(null);
  const [productQuantityInput, setProductQuantityInput] = useState<Map<string, string>>(new Map()); // key: `${storeIndex}-${productId}`
  
  // Vehicle search
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [latestOdometer, setLatestOdometer] = useState<number | null>(null);
  const [activeVehicleIds, setActiveVehicleIds] = useState<Set<string>>(new Set());
  
  // Refs for dropdown positioning
  const vehicleInputRef = useRef<HTMLDivElement>(null);
  const storeInputRef = useRef<HTMLDivElement>(null);
  const [vehicleDropdownPosition, setVehicleDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [storeDropdownPosition, setStoreDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Load trip data when editing
  useEffect(() => {
    if (trip && vehicles.length > 0) {
      setFormData({
        vehicle_id: trip.vehicle_id || '',
        driver_id: trip.driver_id || '',
        planned_date: trip.planned_date || new Date().toISOString().split('T')[0],
        odometer_start: trip.odometer_start?.toString() || '',
        notes: trip.notes || '',
      });
      
      // Set vehicle search text
      const selectedVehicle = vehicles.find(v => v.id === trip.vehicle_id);
      if (selectedVehicle) {
        const displayText = `${selectedVehicle.plate}${selectedVehicle.make && selectedVehicle.model ? ` (${selectedVehicle.make} ${selectedVehicle.model})` : ''}`;
        setVehicleSearch(displayText);
      }

      if (trip.stores) {
        const storesWithItems: StoreWithItems[] = trip.stores.map((store, index) => ({
          store_id: store.store_id,
          sequence_order: store.sequence_order,
          items: (store.items || []).map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            notes: item.notes || '',
          })),
        }));
        setSelectedStores(storesWithItems);
      }
    }
  }, [trip]);

  // Normalize text for better search (remove spaces, convert to lowercase)
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/\s+/g, '').trim();
  };

  // Filter vehicles by search - improved search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const searchNormalized = normalizeText(vehicleSearch);
    return vehicles.filter(vehicle => {
      const plateNormalized = normalizeText(vehicle.plate || '');
      const makeNormalized = vehicle.make ? normalizeText(vehicle.make) : '';
      const modelNormalized = vehicle.model ? normalizeText(vehicle.model) : '';
      return plateNormalized.includes(searchNormalized) || 
             makeNormalized.includes(searchNormalized) || 
             modelNormalized.includes(searchNormalized);
    });
  }, [vehicles, vehicleSearch]);

  // Filter stores by search - improved search
  const filteredStores = useMemo(() => {
    if (!storeSearch) return stores;
    const searchNormalized = normalizeText(storeSearch);
    return stores.filter(store => {
      const codeNormalized = normalizeText(store.customer_code || '');
      const nameNormalized = normalizeText(store.customer_name || '');
      return codeNormalized.includes(searchNormalized) || nameNormalized.includes(searchNormalized);
    });
  }, [stores, storeSearch]);

  // Filter products by search
  const [productSearch, setProductSearch] = useState<Map<number, string>>(new Map());
  const getFilteredProducts = (storeIndex: number) => {
    const search = productSearch.get(storeIndex) || '';
    if (!search) return products;
    const searchLower = search.toLowerCase();
    return products.filter(product =>
      product.product_code.toLowerCase().includes(searchLower) ||
      product.product_name.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower)
    );
  };

  // Auto-populate destinations when vehicle is selected
  useEffect(() => {
    if (formData.vehicle_id && selectedStores.length > 0) {
      // Destinations will be shown based on selected stores
      // This is handled in the UI display
    }
  }, [formData.vehicle_id, selectedStores]);

  // Fetch active trips to determine which vehicles are in use
  useEffect(() => {
    const fetchActiveTrips = async () => {
      try {
        const activeTrips = await tripLogService.getActiveTripsByVehicle();
        const activeIds = new Set(activeTrips.map(trip => trip.vehicle_id));
        setActiveVehicleIds(activeIds);
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching active trips:', err);
        setActiveVehicleIds(new Set());
      }
    };

    fetchActiveTrips();
  }, []);

  // Fetch drivers list (only drivers with role = 'driver')
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        setLoadingDrivers(true);
        const profiles = await profileService.getAll();
        // Filter only drivers (role = 'driver')
        const driverProfiles = profiles.filter(p => p.role === 'driver');
        setDrivers(driverProfiles.map(p => ({ id: p.id, full_name: p.full_name || '' })));
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching drivers:', err);
        setDrivers([]);
      } finally {
        setLoadingDrivers(false);
      }
    };

    fetchDrivers();
  }, []);

  // Fetch latest odometer when vehicle is selected
  useEffect(() => {
    const fetchLatestOdometer = async () => {
      if (!formData.vehicle_id) {
        setLatestOdometer(null);
        return;
      }

      try {
        const lastOdometer = await tripLogService.getLastOdometer(formData.vehicle_id);
        setLatestOdometer(lastOdometer);
        
        // Auto-fill if odometer_start is empty
        if (!formData.odometer_start && lastOdometer) {
          setFormData(prev => ({
            ...prev,
            odometer_start: lastOdometer.toString(),
          }));
        }
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching latest odometer:', err);
        setLatestOdometer(null);
      }
    };

    fetchLatestOdometer();
  }, [formData.vehicle_id]);

  // Handle vehicle selection
  const handleSelectVehicle = (vehicleId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      console.error('[DeliveryTripFormView] Vehicle not found:', vehicleId);
      return;
    }
    
    const displayText = `${vehicle.plate}${vehicle.make && vehicle.model ? ` (${vehicle.make} ${vehicle.model})` : ''}`;
    
    // Close dropdown first
    setShowVehicleDropdown(false);
    setVehicleDropdownPosition(null);
    
    // Then update form data and search text
    // Use setTimeout to ensure dropdown closes before updating
    setTimeout(() => {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
      setVehicleSearch(displayText);
    }, 0);
  };

  // Add store to trip
  const handleAddStore = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    const newStore: StoreWithItems = {
      store_id: storeId,
      sequence_order: selectedStores.length + 1,
      items: [],
    };

    setSelectedStores([...selectedStores, newStore]);
    setStoreSearch('');
    setShowStoreDropdown(false);
    setExpandedStoreIndex(selectedStores.length); // Expand the newly added store
  };

  // Update dropdown positions
  useEffect(() => {
    const updateVehiclePosition = () => {
      if (vehicleInputRef.current && showVehicleDropdown) {
        const rect = vehicleInputRef.current.getBoundingClientRect();
        setVehicleDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      } else {
        setVehicleDropdownPosition(null);
      }
    };

    const updateStorePosition = () => {
      if (storeInputRef.current && showStoreDropdown) {
        const rect = storeInputRef.current.getBoundingClientRect();
        setStoreDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      } else {
        setStoreDropdownPosition(null);
      }
    };

    updateVehiclePosition();
    updateStorePosition();

    window.addEventListener('scroll', updateVehiclePosition, true);
    window.addEventListener('resize', updateVehiclePosition);
    window.addEventListener('scroll', updateStorePosition, true);
    window.addEventListener('resize', updateStorePosition);

    return () => {
      window.removeEventListener('scroll', updateVehiclePosition, true);
      window.removeEventListener('resize', updateVehiclePosition);
      window.removeEventListener('scroll', updateStorePosition, true);
      window.removeEventListener('resize', updateStorePosition);
    };
  }, [showVehicleDropdown, showStoreDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a portal dropdown (they have data-dropdown attribute)
      const isOnVehicleDropdown = target.closest('[data-vehicle-dropdown-portal]');
      const isOnStoreDropdown = target.closest('[data-store-dropdown-portal]');
      
      // Check if click is outside vehicle dropdown
      if (!isOnVehicleDropdown && !target.closest('[data-vehicle-dropdown]') && !target.closest('[data-vehicle-input]')) {
        setShowVehicleDropdown(false);
        setVehicleDropdownPosition(null);
      }
      
      // Check if click is outside store dropdown
      if (!isOnStoreDropdown && !target.closest('[data-store-dropdown]') && !target.closest('[data-store-input]')) {
        setShowStoreDropdown(false);
        setStoreDropdownPosition(null);
      }
    };

    // Use click instead of mousedown to allow scrolling
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Remove store from trip
  const handleRemoveStore = (index: number) => {
    const newStores = selectedStores.filter((_, i) => i !== index);
    // Reorder sequence
    const reorderedStores = newStores.map((store, i) => ({
      ...store,
      sequence_order: i + 1,
    }));
    setSelectedStores(reorderedStores);
    if (expandedStoreIndex === index) {
      setExpandedStoreIndex(null);
    } else if (expandedStoreIndex !== null && expandedStoreIndex > index) {
      setExpandedStoreIndex(expandedStoreIndex - 1);
    }
  };

  // Add product to store with quantity input
  const handleAddProduct = (storeIndex: number, productId: string, quantity: number = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newStores = [...selectedStores];
    const store = newStores[storeIndex];
    
    // Check if product already exists
    const existingIndex = store.items.findIndex(item => item.product_id === productId);
    if (existingIndex >= 0) {
      // Update quantity
      store.items[existingIndex].quantity = quantity;
    } else {
      // Add new product
      store.items.push({
        product_id: productId,
        quantity: quantity,
        notes: '',
      });
    }

    setSelectedStores(newStores);
    
    // Auto-collapse store after adding product (optional - can be removed if user wants to keep it open)
    // setExpandedStoreIndex(null);
  };

  // Remove product from store
  const handleRemoveProduct = (storeIndex: number, itemIndex: number) => {
    const newStores = [...selectedStores];
    newStores[storeIndex].items = newStores[storeIndex].items.filter((_, i) => i !== itemIndex);
    setSelectedStores(newStores);
  };

  // Update product quantity
  const handleUpdateQuantity = (storeIndex: number, itemIndex: number, quantity: number) => {
    const newStores = [...selectedStores];
    newStores[storeIndex].items[itemIndex].quantity = quantity;
    setSelectedStores(newStores);
  };

  // Get aggregated products (all products across all stores)
  const aggregatedProducts = useMemo(() => {
    const productMap = new Map<string, {
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      unit: string;
      total_quantity: number;
      stores: Array<{ store_id: string; customer_name: string; quantity: number }>;
    }>();

    selectedStores.forEach((storeWithItems, storeIndex) => {
      const store = stores.find(s => s.id === storeWithItems.store_id);
      if (!store) return;

      storeWithItems.items.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (!product) return;

        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.total_quantity += item.quantity;
          existing.stores.push({
            store_id: store.id,
            customer_name: store.customer_name,
            quantity: item.quantity,
          });
        } else {
          productMap.set(item.product_id, {
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            category: product.category,
            unit: product.unit,
            total_quantity: item.quantity,
            stores: [{
              store_id: store.id,
              customer_name: store.customer_name,
              quantity: item.quantity,
            }],
          });
        }
      });
    });

    return Array.from(productMap.values());
  }, [selectedStores, stores, products]);

  // Get destinations string (for auto-populate)
  const destinations = useMemo(() => {
    return selectedStores
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map(storeWithItems => {
        const store = stores.find(s => s.id === storeWithItems.store_id);
        return store ? `${store.customer_code} - ${store.customer_name}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }, [selectedStores, stores]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.vehicle_id) {
      setError('กรุณาเลือกรถ');
      return;
    }

    if (!formData.driver_id) {
      setError('กรุณาเลือกคนขับ');
      return;
    }

    if (!formData.planned_date) {
      setError('กรุณาเลือกวันที่วางแผน');
      return;
    }

    if (selectedStores.length === 0) {
      setError('กรุณาเลือกร้านค้าอย่างน้อย 1 ร้าน');
      return;
    }

    // Validate that each store has at least one product
    for (const store of selectedStores) {
      if (store.items.length === 0) {
        const storeName = stores.find(s => s.id === store.store_id)?.customer_name || 'ร้านค้า';
        setError(`กรุณาเลือกสินค้าสำหรับ ${storeName}`);
        return;
      }
    }

    try {
      setSaving(true);

      const tripData: CreateDeliveryTripData = {
        vehicle_id: formData.vehicle_id,
        driver_id: formData.driver_id || undefined,
        planned_date: formData.planned_date,
        odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
        notes: formData.notes || undefined,
        stores: selectedStores.map(store => ({
          store_id: store.store_id,
          sequence_order: store.sequence_order,
          items: store.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
        })),
      };

      if (isEdit && tripId) {
        await deliveryTripService.update(tripId, tripData);
      } else {
        await deliveryTripService.create(tripData);
      }

      setSuccess(true);
      setTimeout(() => {
        onSave?.();
      }, 1500);
    } catch (err: any) {
      console.error('[DeliveryTripFormView] Error saving trip:', err);
      setError(err.message || 'ไม่สามารถบันทึกทริปได้');
    } finally {
      setSaving(false);
    }
  };

  if (loadingTrip) {
    return (
      <PageLayout title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'} loading={true} />
    );
  }

  return (
    <PageLayout
      title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'}
      subtitle={isEdit ? 'แก้ไขข้อมูลทริปส่งสินค้า' : 'สร้างทริปส่งสินค้าใหม่'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Truck size={20} />
            ข้อมูลพื้นฐาน
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative z-10">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รถ <span className="text-red-500">*</span>
              </label>
              <div className="relative" data-vehicle-dropdown ref={vehicleInputRef}>
                <Input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => {
                    setVehicleSearch(e.target.value);
                    setShowVehicleDropdown(true);
                  }}
                  onFocus={() => {
                    if (!formData.vehicle_id) {
                      setVehicleSearch('');
                    }
                    setShowVehicleDropdown(true);
                  }}
                  placeholder="พิมพ์ค้นหาหรือเลือกรถ"
                  icon={<Search size={18} />}
                  data-vehicle-input
                  required={!formData.vehicle_id}
                />
                {showVehicleDropdown && filteredVehicles.length > 0 && vehicleDropdownPosition && createPortal(
                  <div 
                    data-vehicle-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${vehicleDropdownPosition.top}px`,
                      left: `${vehicleDropdownPosition.left}px`,
                      width: `${vehicleDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => {
                      // Allow scrolling by not preventing default
                      e.stopPropagation();
                    }}
                  >
                    {filteredVehicles.map((vehicle) => {
                      const isActive = activeVehicleIds.has(vehicle.id);
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input from losing focus
                            handleSelectVehicle(vehicle.id, e);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {vehicle.plate} {vehicle.make && vehicle.model ? `(${vehicle.make} ${vehicle.model})` : ''}
                          </div>
                          {isActive && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              🚗 ใช้งานอยู่
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
                {formData.vehicle_id && activeVehicleIds.has(formData.vehicle_id) && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>รถคันนี้กำลังใช้งานอยู่</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่วางแผน <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.planned_date}
                onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                คนขับ <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">เลือกคนขับ</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ไมล์เริ่มต้น
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.odometer_start}
                  onChange={(e) => setFormData({ ...formData, odometer_start: e.target.value })}
                  placeholder="กรอกเลขไมล์ขาออก"
                  min="0"
                  step="1"
                />
                {latestOdometer !== null && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    เลขไมล์ล่าสุด: <span className="font-medium">{latestOdometer.toLocaleString()}</span> กม.
                    {formData.odometer_start && parseInt(formData.odometer_start) < latestOdometer && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        ⚠️ น้อยกว่าเลขไมล์ล่าสุด
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                หมายเหตุ
              </label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="หมายเหตุเพิ่มเติม"
              />
            </div>
          </div>

          {/* Auto-populated destinations */}
          {formData.vehicle_id && selectedStores.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <MapPin size={16} />
                <span className="font-medium">จุดหมายปลายทาง:</span>
              </div>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {destinations || 'ยังไม่ได้เลือกร้านค้า'}
              </p>
            </div>
          )}
        </Card>

        {/* Stores and Products */}
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
                {showStoreDropdown && filteredStores.length > 0 && storeDropdownPosition && createPortal(
                  <div 
                    data-store-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${storeDropdownPosition.top}px`,
                      left: `${storeDropdownPosition.left}px`,
                      width: `${storeDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => {
                      // Allow scrolling by not preventing default
                      e.stopPropagation();
                    }}
                  >
                    {filteredStores
                      .filter(store => !selectedStores.find(s => s.store_id === store.id))
                      .map((store) => (
                        <button
                          key={store.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddStore(store.id);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {store.customer_code} - {store.customer_name}
                          </div>
                        </button>
                      ))}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Selected Stores */}
          <div className="space-y-4">
            {selectedStores.map((storeWithItems, storeIndex) => {
              const store = stores.find(s => s.id === storeWithItems.store_id);
              if (!store) return null;

              const isExpanded = expandedStoreIndex === storeIndex;
              const filteredProducts = getFilteredProducts(storeIndex);

              return (
                <div
                  key={store.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                >
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
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ✓ {storeWithItems.items.length} รายการสินค้า (เสร็จแล้ว)
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              ⚠ ยังไม่มีสินค้า
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedStoreIndex(isExpanded ? null : storeIndex)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStore(storeIndex)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Product Search */}
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

                      {/* Product Selector with Quantity Input */}
                      {filteredProducts.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded">
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            เลือกสินค้าและระบุจำนวน:
                          </div>
                          {filteredProducts.map((product) => {
                            const inputKey = `${storeIndex}-${product.id}`;
                            const existingItem = storeWithItems.items.find(item => item.product_id === product.id);
                            const currentQuantity = productQuantityInput.get(inputKey) ?? (existingItem ? existingItem.quantity.toString() : '');
                            
                            const isAdded = !!existingItem;
                            
                            return (
                              <div
                                key={product.id}
                                className={`flex items-center gap-2 p-2 rounded border ${
                                  isAdded
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium text-sm ${
                                    isAdded
                                      ? 'text-green-900 dark:text-green-100'
                                      : 'text-slate-900 dark:text-slate-100'
                                  }`}>
                                    {product.product_code}
                                    {isAdded && (
                                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                        (เพิ่มแล้ว: {existingItem.quantity} {product.unit})
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-xs truncate ${
                                    isAdded
                                      ? 'text-green-700 dark:text-green-300'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {product.product_name} ({product.unit})
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={currentQuantity}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow empty string
                                      const newMap = new Map(productQuantityInput);
                                      newMap.set(inputKey, value);
                                      setProductQuantityInput(newMap);
                                    }}
                                    placeholder="จำนวน"
                                    className="w-20"
                                    min="0"
                                    step="0.01"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const quantity = parseFloat(currentQuantity);
                                      // Validate quantity before adding
                                      if (!quantity || quantity <= 0) {
                                        setError('กรุณาระบุจำนวนสินค้าที่มากกว่า 0');
                                        return;
                                      }
                                      handleAddProduct(storeIndex, product.id, quantity);
                                      // Clear input after adding
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

                      {/* Selected Products */}
                      {storeWithItems.items.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>สินค้าที่เลือก ({storeWithItems.items.length} รายการ):</span>
                            <button
                              type="button"
                              onClick={() => {
                                // Auto-collapse when store has products
                                setExpandedStoreIndex(null);
                              }}
                              className="text-xs text-enterprise-600 dark:text-enterprise-400 hover:underline flex items-center gap-1"
                            >
                              <ChevronUp size={14} />
                              ยุบร้านนี้
                            </button>
                          </div>
                          {storeWithItems.items.map((item, itemIndex) => {
                            const product = products.find(p => p.id === item.product_id);
                            if (!product) return null;

                            return (
                              <div
                                key={item.product_id}
                                className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded"
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {product.product_code} - {product.product_name}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {product.category} ({product.unit})
                                  </div>
                                </div>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateQuantity(
                                      storeIndex,
                                      itemIndex,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-24"
                                  min="0"
                                  step="0.01"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(storeIndex, itemIndex)}
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                  <X size={16} />
                                </button>
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

        {/* Aggregated Products Summary */}
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

        {/* Error & Success Messages */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <X size={20} />
              <span>{error}</span>
            </div>
          </Card>
        )}

        {success && (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Save size={20} />
              <span>บันทึกทริปสำเร็จ</span>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            <ArrowLeft size={18} className="mr-2" />
            ยกเลิก
          </Button>
          <Button type="submit" isLoading={saving} disabled={saving}>
            <Save size={18} className="mr-2" />
            {isEdit ? 'บันทึกการแก้ไข' : 'สร้างทริป'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
};

