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
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PalletConfigSelector } from '../components/trip/PalletConfigSelector';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTrip, useVehicles, useStores, useProducts } from '../hooks';
import { deliveryTripService, type CreateDeliveryTripData, type UpdateDeliveryTripData } from '../services/deliveryTripService';
import { tripLogService } from '../services/tripLogService';
import { ticketService } from '../services/ticketService';
import { storeService, type Store } from '../services/storeService';
import { productService, type Product } from '../services/productService';
import { profileService } from '../services/profileService';
import { serviceStaffService } from '../services/serviceStaffService';
import type { DeliveryTripWithRelations } from '../services/deliveryTripService';
import { calculateTripCapacity } from '../utils/tripCapacityValidation';
import { calculatePalletAllocation, type PalletPackingResult } from '../utils/palletPacking';

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
    selected_pallet_config_id?: string; // Phase 0: User-selected config
  }>;
}

/** Deep compare stores+items; used to avoid sending stores on update when user only changed driver/vehicle/date/notes */
function storesAndItemsEqual(a: StoreWithItems[], b: StoreWithItems[] | null): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i], sb = b[i];
    if (sa.store_id !== sb.store_id || sa.sequence_order !== sb.sequence_order) return false;
    if (sa.items.length !== sb.items.length) return false;
    const sortKey = (item: { product_id: string; quantity: number; notes?: string }) =>
      `${item.product_id}:${item.quantity}:${item.notes ?? ''}`;
    const aItems = [...sa.items].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    const bItems = [...sb.items].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    for (let j = 0; j < aItems.length; j++) {
      if (sortKey(aItems[j]) !== sortKey(bItems[j])) return false;
    }
  }
  return true;
}

export const DeliveryTripFormView: React.FC<DeliveryTripFormViewProps> = ({
  tripId,
  onSave,
  onCancel,
}) => {
  const isEdit = !!tripId;
  const { trip, loading: loadingTrip } = useDeliveryTrip(tripId || null);
  const { vehicles, loading: loadingVehicles } = useVehicles();

  // Store search with debounce - use backend search instead of frontend filtering
  const [storeSearchDebounced, setStoreSearchDebounced] = useState('');
  const { stores, loading: loadingStores } = useStores({
    is_active: true,
    search: storeSearchDebounced || undefined // Only search if there's a search term
  });

  // Cache store info for selected stores to prevent disappearing when stores array is empty
  const [storeCache, setStoreCache] = React.useState<Map<string, Store>>(new Map());

  // Update cache when stores are loaded
  React.useEffect(() => {
    if (stores.length > 0) {
      setStoreCache(prev => {
        const newCache = new Map(prev);
        stores.forEach(store => {
          newCache.set(store.id, store);
        });
        return newCache;
      });
    }
  }, [stores]);

  // Get store info - use cache if stores array is empty
  const getStoreInfo = React.useCallback((storeId: string): Store | null => {
    // First try to find in current stores array
    const store = stores.find(s => s.id === storeId);
    if (store) return store;

    // If not found, try cache
    return storeCache.get(storeId) || null;
  }, [stores, storeCache]);

  // Product search with debounce - use server-side search (supports millions of records)
  const [productSearch, setProductSearch] = useState<Map<number, string>>(new Map());
  const [productSearchDebounced, setProductSearchDebounced] = useState<Map<number, string>>(new Map());

  // Debounce product search for each store (300ms delay)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    productSearch.forEach((search, storeIndex) => {
      const timer = setTimeout(() => {
        setProductSearchDebounced(prev => {
          const newMap = new Map(prev);
          if (search && search.trim()) {
            newMap.set(storeIndex, search.trim());
          } else {
            newMap.delete(storeIndex);
          }
          return newMap;
        });
      }, 300);
      timers.push(timer);
    });

    // Clean up searches that were removed
    const currentKeys = new Set(productSearch.keys());
    setProductSearchDebounced(prev => {
      const newMap = new Map(prev);
      prev.forEach((_, key) => {
        if (!currentKeys.has(key)) {
          newMap.delete(key);
        }
      });
      return newMap;
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [productSearch]);

  // Get the most recent active search term (for single products fetch)
  // In a production app, you might want to fetch products per store separately
  const activeProductSearch = Array.from(productSearchDebounced.values())
    .find((s): s is string => typeof s === 'string' && s.trim().length > 0) || '';

  // Fetch products with server-side search (supports millions of records)
  // Note: This fetches products for the first active search. For multiple stores with different searches,
  // you'd need a more complex solution (multiple hooks or a custom hook that handles multiple searches)
  const { products, loading: loadingProducts } = useProducts({
    is_active: true,
    search: activeProductSearch || undefined
  });

  // Cache product info for selected products to prevent disappearing when products array changes
  const [productCache, setProductCache] = React.useState<Map<string, Product>>(new Map());

  // Update cache when products are loaded
  React.useEffect(() => {
    if (products.length > 0) {
      setProductCache(prev => {
        const newCache = new Map(prev);
        products.forEach(product => {
          newCache.set(product.id, product);
        });
        return newCache;
      });
    }
  }, [products]);

  // Get product info - use cache if products array is empty or doesn't contain the product
  const getProductInfo = React.useCallback((productId: string): Product | null => {
    // First try to find in current products array
    const product = products.find(p => p.id === productId);
    if (product) return product;

    // If not found, try cache
    return productCache.get(productId) || null;
  }, [products, productCache]);

  // Cache products when they are added to a store
  const cacheProduct = React.useCallback((product: Product) => {
    setProductCache(prev => {
      const newCache = new Map(prev);
      newCache.set(product.id, product);
      return newCache;
    });
  }, []);

  // Filter products - server-side search already done for active search
  // For stores with different search terms, fallback to client-side filtering from cache
  const getFilteredProducts = useMemo(() => {
    return (storeIndex: number) => {
      const searchTerm = productSearchDebounced.get(storeIndex);

      // If no search for this store, return all cached products (or empty if cache is small)
      if (!searchTerm) {
        // Return cached products that are likely to be used
        // For better UX, we could return recently used products or all cached products
        return Array.from(productCache.values());
      }

      // If this store's search matches the active search, products are already filtered by server
      if (searchTerm === activeProductSearch) {
        return products; // Already filtered by server
      }

      // If this store has different search, filter client-side from cache (fallback)
      // Note: For better performance with millions of products, consider fetching separately per store
      const searchLower = searchTerm.toLowerCase();
      return Array.from(productCache.values()).filter((product: Product) =>
        (product.product_code || '').toLowerCase().includes(searchLower) ||
        (product.product_name || '').toLowerCase().includes(searchLower) ||
        (product.category || '').toLowerCase().includes(searchLower)
      );
    };
  }, [products, productSearchDebounced, activeProductSearch, productCache]);

  // Removed debug logging to reduce console noise

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

  // Debounce store search for server-side search (supports millions of records)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStoreSearchDebounced(storeSearch.trim());
    }, 300); // 300ms delay - wait for user to finish typing

    return () => clearTimeout(timer);
  }, [storeSearch]);
  const [expandedStoreIndex, setExpandedStoreIndex] = useState<number | null>(null);
  const [productQuantityInput, setProductQuantityInput] = useState<Map<string, string>>(new Map()); // key: `${storeIndex}-${productId}`

  // Vehicle search
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [latestOdometer, setLatestOdometer] = useState<number | null>(null);
  const [activeVehicleIds, setActiveVehicleIds] = useState<Set<string>>(new Set()); // Vehicles in use (trip logs)
  const [vehiclesWithActiveTickets, setVehiclesWithActiveTickets] = useState<Set<string>>(new Set()); // Vehicles with active maintenance tickets
  const [vehiclesWithActiveDeliveryTrips, setVehiclesWithActiveDeliveryTrips] = useState<Set<string>>(new Set()); // Vehicles with active delivery trips

  // Refs for dropdown positioning
  const vehicleInputRef = useRef<HTMLDivElement>(null);
  const storeInputRef = useRef<HTMLDivElement>(null);

  // Snapshot of stores when trip is loaded in edit mode — used to avoid sending stores on update when user only changed driver/vehicle/date/notes (prevents accidental deletion of items)
  const initialStoresRef = useRef<StoreWithItems[] | null>(null);
  const [vehicleDropdownPosition, setVehicleDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Helper staff
  const [availableStaff, setAvailableStaff] = useState<Array<{ id: string; name: string; employee_code?: string | null }>>([]);
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([]);
  const [helperSearch, setHelperSearch] = useState('');
  const [showHelperDropdown, setShowHelperDropdown] = useState(false);
  const helperInputRef = useRef<HTMLDivElement>(null);
  const [helperDropdownPosition, setHelperDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Service staff driver (for crew/commission system)
  const [selectedDriverStaffId, setSelectedDriverStaffId] = useState<string>('');
  const [driverStaffSearch, setDriverStaffSearch] = useState('');
  const [showDriverStaffDropdown, setShowDriverStaffDropdown] = useState(false);
  const driverStaffInputRef = useRef<HTMLDivElement>(null);
  const [driverStaffDropdownPosition, setDriverStaffDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Edit reason (required for edit mode)
  const [editReason, setEditReason] = useState('');
  // Capacity summary state
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

  // Bin-packing pallet result (จัดรวมหลายชนิดในพาเลทเดียวกัน — แม่นยำกว่า)
  const [palletPackingResult, setPalletPackingResult] = useState<PalletPackingResult | null>(null);

  // Calculate capacity summary when vehicle or items change (with debounce)
  useEffect(() => {
    if (!formData.vehicle_id || selectedStores.length === 0) {
      setCapacitySummary(null);
      return;
    }

    // Collect all items from all stores
    const allItems = selectedStores.flatMap(store =>
      store.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))
    );

    if (allItems.length === 0) {
      setCapacitySummary(null);
      return;
    }

    // Set loading state
    setCapacitySummary(prev => ({
      ...prev,
      loading: true,
      errors: [],
      warnings: [],
    } as any));

    // Debounce: wait 500ms before calculating (to avoid too many requests)
    const timeoutId = setTimeout(() => {
      // คำนวณแบบเดิม (แยกแต่ละชนิดสินค้า) — ใช้สำหรับน้ำหนัก/ความสูง + fallback
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
          console.error('[DeliveryTripFormView] Error calculating capacity:', err);
          setCapacitySummary(prev => ({
            ...prev,
            loading: false,
            errors: [err.message || 'ไม่สามารถคำนวณความจุได้'],
            warnings: [],
          } as any));
        });

      // คำนวณแบบ bin-packing (จัดรวมหลายชนิดบนพาเลทเดียวกัน — แม่นยำกว่า)
      calculatePalletAllocation(allItems)
        .then(packing => {
          setPalletPackingResult(packing.errors.length > 0 ? null : packing);
        })
        .catch(() => setPalletPackingResult(null));
    }, 500);

    // Cleanup: cancel timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [formData.vehicle_id, selectedStores]);

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

      // Set crew members if editing
      if (trip.crews) {
        const helpers = trip.crews
          .filter(c => c.role === 'helper' && c.status === 'active')
          .map(c => c.staff_id);
        setSelectedHelpers(helpers);

        // Set driver staff from crew
        const driverCrew = trip.crews.find(c => c.role === 'driver' && c.status === 'active');
        if (driverCrew) {
          setSelectedDriverStaffId(driverCrew.staff_id);
          const driverStaff = availableStaff.find(s => s.id === driverCrew.staff_id);
          if (driverStaff) {
            setDriverStaffSearch(`${driverStaff.name}${driverStaff.employee_code ? ` (${driverStaff.employee_code})` : ''}`);
          }
        }
      }

      // Set vehicle search text
      const selectedVehicle = vehicles.find(v => v.id === trip.vehicle_id);
      if (selectedVehicle) {
        const displayText = `${selectedVehicle.plate}${selectedVehicle.make && selectedVehicle.model ? ` (${selectedVehicle.make} ${selectedVehicle.model})` : ''}`;
        setVehicleSearch(displayText);
      }

      // Only set selectedStores if we're in edit mode and haven't set it yet
      if (trip.stores && isEdit && selectedStores.length === 0) {
        const storesWithItems: StoreWithItems[] = trip.stores.map((store, index) => ({
          store_id: store.store_id,
          sequence_order: store.sequence_order,
          items: (store.items || []).map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            notes: item.notes || '',
            selected_pallet_config_id: item.selected_pallet_config_id || undefined,
          })),
        }));
        setSelectedStores(storesWithItems);
        // Snapshot for "did user change stores/items?" — if unchanged, we won't send stores on update to avoid overwriting/deleting items
        initialStoresRef.current = JSON.parse(JSON.stringify(storesWithItems));

        // Fetch store info and product info for all stores in the trip and cache them
        // This prevents "loading" state when stores/products arrays are empty
        const fetchStoreAndProductInfo = async () => {
          const storeIds = storesWithItems.map(s => s.store_id);
          const productIds = new Set<string>();

          // Collect all product IDs from all stores
          storesWithItems.forEach(store => {
            store.items.forEach(item => {
              productIds.add(item.product_id);
            });
          });

          // Fetch stores in parallel
          const storePromises = storeIds.map(storeId =>
            storeService.getById(storeId).catch(err => {
              console.error(`[DeliveryTripFormView] Error fetching store ${storeId}:`, err);
              return null;
            })
          );

          // Fetch products in parallel
          const productPromises = Array.from(productIds).map(productId =>
            productService.getById(productId).catch(err => {
              console.error(`[DeliveryTripFormView] Error fetching product ${productId}:`, err);
              return null;
            })
          );

          // Wait for all fetches to complete
          const [fetchedStores, fetchedProducts] = await Promise.all([
            Promise.all(storePromises),
            Promise.all(productPromises)
          ]);

          // Cache all fetched stores
          const validStores = fetchedStores.filter((s): s is Store => s !== null);
          if (validStores.length > 0) {
            setStoreCache(prev => {
              const newCache = new Map(prev);
              validStores.forEach(store => {
                newCache.set(store.id, store);
              });
              return newCache;
            });
          }

          // Cache all fetched products
          const validProducts = fetchedProducts.filter((p): p is Product => p !== null);
          if (validProducts.length > 0) {
            setProductCache(prev => {
              const newCache = new Map(prev);
              validProducts.forEach(product => {
                newCache.set(product.id, product);
              });
              return newCache;
            });
          }
        };

        fetchStoreAndProductInfo();
      }
    }
  }, [trip, vehicles, isEdit]); // Remove selectedStores from dependencies to prevent reset

  // Normalize text for better search (remove spaces, convert to lowercase)
  // Normalize text for search - keep spaces and hyphens for flexible matching
  const normalizeText = (text: string): string => {
    if (!text) return '';
    return text.toLowerCase().trim();
  };

  // Create searchable text from multiple fields
  const createSearchableText = (...texts: (string | null | undefined)[]): string => {
    return texts
      .filter(t => t)
      .map(t => normalizeText(t!))
      .join(' ');
  };

  // Filter vehicles by search - improved search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const searchLower = normalizeText(vehicleSearch);
    return vehicles.filter(vehicle => {
      const plateLower = normalizeText(vehicle.plate || '');
      const makeLower = normalizeText(vehicle.make || '');
      const modelLower = normalizeText(vehicle.model || '');
      const searchableText = createSearchableText(vehicle.plate, vehicle.make, vehicle.model);

      // Match in individual fields or combined
      return plateLower.includes(searchLower) ||
        makeLower.includes(searchLower) ||
        modelLower.includes(searchLower) ||
        searchableText.includes(searchLower);
    });
  }, [vehicles, vehicleSearch]);

  // Filter stores - server-side search already done, just sort and limit
  // This works for millions of records because filtering happens in database
  const filteredStores = useMemo(() => {
    // If no search, return empty (don't show all stores)
    if (!storeSearchDebounced || !storeSearchDebounced.trim()) return [];

    // Server has already filtered, just sort by relevance
    const searchLower = normalizeText(storeSearchDebounced);
    const searchTrimmed = searchLower.trim();

    // Score stores for better sorting (exact matches first)
    const scoredStores = stores.map(store => {
      // Get raw values (before normalization) for exact matching
      const rawCode = (store.customer_code || '').trim();
      const rawName = (store.customer_name || '').trim();

      // Normalized values for case-insensitive matching
      const codeLower = normalizeText(rawCode);
      const nameLower = normalizeText(rawName);

      let score = 0;
      let matches = false;

      // 1. Exact match (case-insensitive) in customer_code - highest priority
      if (codeLower === searchTrimmed) {
        score = 1000;
        matches = true;
      }
      // 2. Starts with in customer_code - high priority
      else if (codeLower.startsWith(searchTrimmed)) {
        score = 500;
        matches = true;
      }
      // 3. Direct match in customer_code (case-insensitive) - exact or partial
      else if (codeLower.includes(searchTrimmed)) {
        score = 300;
        matches = true;
      }
      // 4. Exact match in customer_name
      else if (nameLower === searchTrimmed) {
        score = 200;
        matches = true;
      }
      // 5. Starts with in customer_name
      else if (nameLower.startsWith(searchTrimmed)) {
        score = 150;
        matches = true;
      }
      // 6. Direct match in customer_name (case-insensitive)
      else if (nameLower.includes(searchTrimmed)) {
        score = 100;
        matches = true;
      }
      // 7. Match without special characters (hyphens, spaces, underscores) for flexible code matching
      else {
        const searchWithoutSpecial = searchTrimmed.replace(/[-\s_]/g, '');
        const codeWithoutSpecial = codeLower.replace(/[-\s_]/g, '');
        if (searchWithoutSpecial && codeWithoutSpecial.includes(searchWithoutSpecial)) {
          score = 50;
          matches = true;
        }
        // 8. Match code with special characters removed from search
        else if (searchWithoutSpecial && codeLower.includes(searchWithoutSpecial)) {
          score = 40;
          matches = true;
        }
        // 9. Match raw code (preserving case) - in case there are encoding issues
        else if (rawCode.toLowerCase().includes(searchTrimmed)) {
          score = 30;
          matches = true;
        }
        // 10. Match partial code segments
        else {
          const codeSegments = codeLower.split(/[-\s_]/).filter(s => s.length > 0);
          const searchSegments = searchTrimmed.split(/[-\s_]/).filter(s => s.length > 0);
          if (searchSegments.some(ss => codeSegments.some(cs => cs.startsWith(ss) || cs.includes(ss) || ss.includes(cs)))) {
            score = 20;
            matches = true;
          }
          // 11. Match individual words in customer_name
          else {
            const nameWords = nameLower.split(/\s+/).filter(w => w.length > 0);
            const searchWords = searchTrimmed.split(/\s+/).filter(w => w.length > 0);
            if (searchWords.some(sw => nameWords.some(nw => nw.startsWith(sw) || nw.includes(sw) || sw.includes(nw)))) {
              score = 10;
              matches = true;
            }
            // 12. Match in combined searchable text
            else {
              const searchableText = createSearchableText(
                store.customer_code,
                store.customer_name,
                store.address,
                store.contact_person
              );
              if (searchableText.includes(searchTrimmed)) {
                score = 5;
                matches = true;
              }
            }
          }
        }
      }

      return { store, score, matches };
    });

    // Filter only matching stores and sort by score (highest first)
    const filtered = scoredStores
      .filter(item => item.matches)
      .sort((a, b) => b.score - a.score)
      .map(item => item.store)
      .slice(0, 100); // Limit to 100 results for performance

    return filtered;
  }, [stores, storeSearchDebounced]);

  // getFilteredProducts is now defined above using useMemo

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

  // Fetch vehicles with active maintenance tickets
  useEffect(() => {
    const fetchVehiclesWithActiveTickets = async () => {
      try {
        // Query all active tickets at once instead of checking each vehicle
        const { supabase } = await import('../lib/supabase');
        const activeStatuses = ['pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress'];

        const { data: activeTickets, error } = await supabase
          .from('tickets')
          .select('vehicle_id')
          .in('status', activeStatuses);

        if (error) {
          console.error('[DeliveryTripFormView] Error fetching active tickets:', error);
          setVehiclesWithActiveTickets(new Set());
          return;
        }

        const vehicleIdsWithTickets = new Set(
          (activeTickets || []).map(ticket => ticket.vehicle_id).filter(Boolean)
        );

        setVehiclesWithActiveTickets(vehicleIdsWithTickets);
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching vehicles with active tickets:', err);
        setVehiclesWithActiveTickets(new Set());
      }
    };

    fetchVehiclesWithActiveTickets();
  }, []); // Fetch once on mount, not dependent on vehicles

  // Fetch vehicles with active delivery trips
  useEffect(() => {
    const fetchVehiclesWithActiveDeliveryTrips = async () => {
      try {
        // Get active delivery trips (planned or in_progress)
        const activeDeliveryTrips = await deliveryTripService.getAll({
          status: ['planned', 'in_progress']
        });
        const vehicleIds = new Set(activeDeliveryTrips.map(trip => trip.vehicle_id));
        setVehiclesWithActiveDeliveryTrips(vehicleIds);
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching vehicles with active delivery trips:', err);
        setVehiclesWithActiveDeliveryTrips(new Set());
      }
    };

    fetchVehiclesWithActiveDeliveryTrips();
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

  // Fetch available staff
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const staff = await serviceStaffService.getAllActive();
        setAvailableStaff(staff.map(s => ({ id: s.id, name: s.name, employee_code: s.employee_code })));
      } catch (err) {
        console.error('[DeliveryTripFormView] Error fetching staff:', err);
      }
    };
    fetchStaff();
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
  const handleAddStore = React.useCallback((storeId: string) => {
    // Find store in current stores array to cache it
    const store = stores.find(s => s.id === storeId);
    if (store) {
      // Cache store info immediately
      setStoreCache(prev => {
        const newCache = new Map(prev);
        newCache.set(storeId, store);
        return newCache;
      });
    }

    // Use functional update to ensure we have the latest state
    setSelectedStores(prevStores => {
      // Check if store is already selected
      if (prevStores.find(s => s.store_id === storeId)) {
        console.warn('[DeliveryTripFormView] Store already selected:', storeId);
        return prevStores;
      }

      const newStore: StoreWithItems = {
        store_id: storeId,
        sequence_order: prevStores.length + 1,
        items: [],
      };

      const newStores = [...prevStores, newStore];

      // Clear search and close dropdown after state update
      // Use setTimeout to ensure state update completes first
      setTimeout(() => {
        setStoreSearch('');
        setShowStoreDropdown(false);
        setExpandedStoreIndex(newStores.length - 1); // Expand the newly added store
      }, 0);

      return newStores;
    });
  }, [stores]); // Include stores to cache store info when adding

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

    const updateHelperPosition = () => {
      if (helperInputRef.current && showHelperDropdown) {
        const rect = helperInputRef.current.getBoundingClientRect();
        setHelperDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      } else {
        setHelperDropdownPosition(null);
      }
    };

    const updateDriverStaffPosition = () => {
      if (driverStaffInputRef.current && showDriverStaffDropdown) {
        const rect = driverStaffInputRef.current.getBoundingClientRect();
        setDriverStaffDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      } else {
        setDriverStaffDropdownPosition(null);
      }
    };

    updateVehiclePosition();
    updateHelperPosition();
    updateDriverStaffPosition();

    window.addEventListener('scroll', updateVehiclePosition, true);
    window.addEventListener('resize', updateVehiclePosition);
    window.addEventListener('scroll', updateHelperPosition, true);
    window.addEventListener('resize', updateHelperPosition);
    window.addEventListener('scroll', updateDriverStaffPosition, true);
    window.addEventListener('resize', updateDriverStaffPosition);

    return () => {
      window.removeEventListener('scroll', updateVehiclePosition, true);
      window.removeEventListener('resize', updateVehiclePosition);
      window.removeEventListener('scroll', updateHelperPosition, true);
      window.removeEventListener('resize', updateHelperPosition);
      window.removeEventListener('scroll', updateDriverStaffPosition, true);
      window.removeEventListener('resize', updateDriverStaffPosition);
    };
  }, [showVehicleDropdown, showHelperDropdown, showDriverStaffDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is on a portal dropdown (they have data-dropdown attribute)
      const isOnVehicleDropdown = target.closest('[data-vehicle-dropdown-portal]');
      const isOnStoreDropdown = target.closest('[data-store-dropdown-portal]');
      const isOnHelperDropdown = target.closest('[data-helper-dropdown-portal]');
      const isOnDriverStaffDropdown = target.closest('[data-driver-staff-dropdown-portal]');

      // Check if click is outside vehicle dropdown
      if (!isOnVehicleDropdown && !target.closest('[data-vehicle-dropdown]') && !target.closest('[data-vehicle-input]')) {
        setShowVehicleDropdown(false);
        setVehicleDropdownPosition(null);
      }

      // Check if click is outside store dropdown
      if (!isOnStoreDropdown && !target.closest('[data-store-dropdown]') && !target.closest('[data-store-input]')) {
        setShowStoreDropdown(false);
      }

      // Check if click is outside helper dropdown
      if (!isOnHelperDropdown && !target.closest('[data-helper-dropdown]') && !target.closest('[data-helper-input]')) {
        setShowHelperDropdown(false);
        setHelperDropdownPosition(null);
      }

      // Check if click is outside driver staff dropdown
      if (!isOnDriverStaffDropdown && !target.closest('[data-driver-staff-dropdown]') && !target.closest('[data-driver-staff-input]')) {
        setShowDriverStaffDropdown(false);
        setDriverStaffDropdownPosition(null);
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
  // Use useCallback to prevent unnecessary re-renders and ensure stable reference
  const handleAddProduct = React.useCallback((storeIndex: number, productId: string, quantity: number = 1) => {
    // Get product from current products array or cache
    let product = getProductInfo(productId);

    // If not found, try to fetch it
    if (!product) {
      // Try to fetch product by ID
      productService.getById(productId).then(fetchedProduct => {
        if (fetchedProduct) {
          cacheProduct(fetchedProduct);
          // Retry adding product after caching
          handleAddProduct(storeIndex, productId, quantity);
        }
      }).catch(err => {
        console.warn('[DeliveryTripFormView] Product not found:', productId, err);
      });
      return;
    }

    // Cache product to ensure it's available even if search changes
    cacheProduct(product);

    setSelectedStores(prevStores => {
      // Create a deep copy to avoid mutation issues
      const newStores = prevStores.map(store => ({
        ...store,
        items: [...store.items]
      }));

      const store = newStores[storeIndex];
      if (!store) {
        console.warn('[DeliveryTripFormView] Store not found at index:', storeIndex);
        return prevStores;
      }

      // Check if product already exists
      const existingIndex = store.items.findIndex(item => item.product_id === productId);
      if (existingIndex >= 0) {
        // Update quantity (create new object to avoid mutation)
        store.items[existingIndex] = {
          ...store.items[existingIndex],
          quantity: quantity
        };
      } else {
        // Add new product
        store.items.push({
          product_id: productId,
          quantity: quantity,
          notes: '',
        });
      }

      return newStores;
    });
  }, [getProductInfo, cacheProduct]);

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
      const store = getStoreInfo(storeWithItems.store_id);
      if (!store) return;

      storeWithItems.items.forEach(item => {
        const product = getProductInfo(item.product_id);
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
  }, [selectedStores, getStoreInfo, getProductInfo]);

  // Get destinations string (for auto-populate)
  const destinations = useMemo(() => {
    return selectedStores
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map(storeWithItems => {
        const store = getStoreInfo(storeWithItems.store_id);
        return store ? `${store.customer_code} - ${store.customer_name}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }, [selectedStores, getStoreInfo]);

  // Prevent form submission on Enter key press (except when clicking submit button)
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // If Enter is pressed and the target is not a submit button, prevent form submission
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.tagName !== 'BUTTON' && (target as HTMLInputElement).type !== 'submit') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

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
        const storeName = getStoreInfo(store.store_id)?.customer_name || 'ร้านค้า';
        setError(`กรุณาเลือกสินค้าสำหรับ ${storeName}`);
        return;
      }
    }

    // Validate edit reason for edit mode
    if (isEdit && (!editReason || !editReason.trim())) {
      setError('กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป');
      return;
    }

    // Validate capacity (pallets and weight) - only if vehicle is selected
    if (formData.vehicle_id) {
      try {
        // Collect all items from all stores
        const allItems = selectedStores.flatMap(store =>
          store.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
          }))
        );

        if (allItems.length > 0) {
          const capacityResult = await calculateTripCapacity(
            allItems,
            formData.vehicle_id
          );

          // ถ้ามี palletPackingResult (bin-packing) ใช้ค่าจากนั้นแทน
          if (!capacityResult.valid) {
            let errorsToCheck = capacityResult.errors;

            // ถ้ามี bin-packing result → กรอง error พาเลทแบบเก่าออก แล้ว validate ใหม่
            if (palletPackingResult && capacityResult.summary.vehicleMaxPallets !== null) {
              errorsToCheck = errorsToCheck.filter(
                err => !err.includes('จำนวนพาเลทเกินความจุ')
              );
              // เช็คใหม่ด้วย bin-packing count
              if (palletPackingResult.totalPallets > capacityResult.summary.vehicleMaxPallets) {
                errorsToCheck.push(
                  `จำนวนพาเลทเกินความจุ: ${palletPackingResult.totalPallets} พาเลท (สูงสุด ${capacityResult.summary.vehicleMaxPallets} พาเลท)`
                );
              }
            }

            if (errorsToCheck.length > 0) {
              setError(
                `ไม่สามารถสร้างทริปได้:\n${errorsToCheck.join('\n')}`
              );
              if (capacityResult.warnings.length > 0) {
                console.warn('Capacity warnings:', capacityResult.warnings);
              }
              return;
            }
          }

          // Show warnings if any (but allow submission)
          if (capacityResult.warnings.length > 0) {
            console.warn('Capacity warnings:', capacityResult.warnings);
          }
        }
      } catch (capacityErr: any) {
        console.error('[DeliveryTripFormView] Error validating capacity:', capacityErr);
        // Don't block submission if capacity validation fails (graceful degradation)
        // Just log the error
      }
    }

    try {
      setSaving(true);

      if (isEdit && tripId) {
        // For update, use UpdateDeliveryTripData
        const updateData: UpdateDeliveryTripData = {
          vehicle_id: formData.vehicle_id,
          driver_id: formData.driver_id || undefined,
          driver_staff_id: selectedDriverStaffId || undefined,
          planned_date: formData.planned_date,
          odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
          notes: formData.notes || undefined,
          edit_reason: editReason, // Required for edit mode
          helpers: selectedHelpers, // Include helpers for update
        };
        // Only send stores when user actually changed stores/items — otherwise backend replaces the full list and can delete items the user never touched
        if (!storesAndItemsEqual(selectedStores, initialStoresRef.current)) {
          updateData.stores = selectedStores.map(store => ({
            store_id: store.store_id,
            sequence_order: store.sequence_order,
            items: store.items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              notes: item.notes || undefined,
              selected_pallet_config_id: item.selected_pallet_config_id || undefined,
            })),
          }));
        }
        await deliveryTripService.update(tripId, updateData);
      } else {
        // For create, use CreateDeliveryTripData
        const createData: CreateDeliveryTripData = {
          vehicle_id: formData.vehicle_id,
          driver_id: formData.driver_id || undefined,
          driver_staff_id: selectedDriverStaffId || undefined,
          planned_date: formData.planned_date,
          odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
          notes: formData.notes || undefined,
          helpers: selectedHelpers,
          stores: selectedStores.map(store => ({
            store_id: store.store_id,
            sequence_order: store.sequence_order,
            items: store.items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              notes: item.notes || undefined,
              selected_pallet_config_id: item.selected_pallet_config_id || undefined,
            })),
          })),
        };
        await deliveryTripService.create(createData);
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
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
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
                      const isInUse = activeVehicleIds.has(vehicle.id); // In use (trip logs)
                      const hasActiveTicket = vehiclesWithActiveTickets.has(vehicle.id); // Has active maintenance ticket
                      const hasActiveDeliveryTrip = vehiclesWithActiveDeliveryTrips.has(vehicle.id); // Has active delivery trip

                      // Collect all statuses
                      const statuses: string[] = [];
                      if (isInUse) {
                        statuses.push('🚗 ใช้งานอยู่');
                      }
                      if (hasActiveTicket) {
                        statuses.push('🔧 ซ่อมอยู่');
                      }
                      if (hasActiveDeliveryTrip) {
                        statuses.push('📦 จัดส่งอยู่');
                      }

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
                          {statuses.length > 0 && (
                            <div className="text-xs mt-0.5 space-y-0.5">
                              {statuses.map((status, idx) => (
                                <div
                                  key={idx}
                                  className={
                                    status.includes('ใช้งานอยู่')
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : status.includes('ซ่อมอยู่')
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                  }
                                >
                                  {status}
                                </div>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
                {formData.vehicle_id && (
                  <div className="mt-1 space-y-1">
                    {activeVehicleIds.has(formData.vehicle_id) && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>รถคันนี้กำลังใช้งานอยู่</span>
                      </div>
                    )}
                    {vehiclesWithActiveTickets.has(formData.vehicle_id) && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>รถคันนี้กำลังซ่อมอยู่</span>
                      </div>
                    )}
                    {vehiclesWithActiveDeliveryTrips.has(formData.vehicle_id) && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>รถคันนี้มีทริปจัดส่งอยู่</span>
                      </div>
                    )}
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
              {/* placeholder for grid alignment */}
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

        {/* Crew Assignment Section */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <User size={20} />
            จัดพนักงานประจำทริป
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(สำคัญ - มีผลต่อค่าคอมมิชชั่น)</span>
          </h3>

          {(!selectedDriverStaffId && selectedHelpers.length === 0) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">ยังไม่ได้จัดพนักงาน</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">กรุณาเลือกคนขับและพนักงานบริการเพื่อให้ระบบคำนวณค่าคอมมิชชั่นได้ถูกต้อง</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Staff Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                คนขับ (เลือกได้ 1 คน) <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={driverStaffInputRef} data-driver-staff-dropdown>
                <Input
                  type="text"
                  value={driverStaffSearch}
                  onChange={(e) => {
                    setDriverStaffSearch(e.target.value);
                    setShowDriverStaffDropdown(true);
                    if (!e.target.value) {
                      setSelectedDriverStaffId('');
                    }
                    if (driverStaffInputRef.current) {
                      const rect = driverStaffInputRef.current.getBoundingClientRect();
                      setDriverStaffDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }
                  }}
                  onFocus={() => {
                    setShowDriverStaffDropdown(true);
                    if (driverStaffInputRef.current) {
                      const rect = driverStaffInputRef.current.getBoundingClientRect();
                      setDriverStaffDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }
                  }}
                  placeholder="ค้นหาคนขับ..."
                  icon={<Search size={18} />}
                  data-driver-staff-input
                />
                {selectedDriverStaffId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDriverStaffId('');
                      setDriverStaffSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                )}
                {showDriverStaffDropdown && driverStaffDropdownPosition && createPortal(
                  <div
                    data-driver-staff-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${driverStaffDropdownPosition.top}px`,
                      left: `${driverStaffDropdownPosition.left}px`,
                      width: `${driverStaffDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id))
                      .filter(s => {
                        const search = driverStaffSearch.toLowerCase();
                        return s.name.toLowerCase().includes(search) ||
                          (s.employee_code || '').toLowerCase().includes(search);
                      })
                      .map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDriverStaffId(staff.id);
                            setDriverStaffSearch(`${staff.name}${staff.employee_code ? ` (${staff.employee_code})` : ''}`);
                            setShowDriverStaffDropdown(false);
                            setDriverStaffDropdownPosition(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm ${selectedDriverStaffId === staff.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">{staff.name}</div>
                          {staff.employee_code && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
                          )}
                        </button>
                      ))}
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id))
                      .filter(s => s.name.toLowerCase().includes(driverStaffSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(driverStaffSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่พบพนักงาน
                        </div>
                      )}
                  </div>,
                  document.body
                )}
              </div>
              {selectedDriverStaffId && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                    <CheckCircle size={14} />
                    <span className="font-medium">
                      {availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'เลือกแล้ว'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">คนขับ</span>
                  </div>
                </div>
              )}
            </div>

            {/* Helper Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                พนักงานบริการ (เลือกได้หลายคน)
              </label>
              <div className="relative" ref={helperInputRef} data-helper-dropdown>
                <div className="flex flex-wrap gap-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[42px]">
                  {selectedHelpers.map(helperId => {
                    const helper = availableStaff.find(s => s.id === helperId);
                    return (
                      <span key={helperId} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {helper?.name || 'Unknown'}
                        <button
                          type="button"
                          onClick={() => setSelectedHelpers(prev => prev.filter(id => id !== helperId))}
                          className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    value={helperSearch}
                    onChange={(e) => {
                      setHelperSearch(e.target.value);
                      setShowHelperDropdown(true);
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({
                          top: rect.bottom + window.scrollY + 4,
                          left: rect.left + window.scrollX,
                          width: rect.width,
                        });
                      }
                    }}
                    onFocus={() => {
                      setShowHelperDropdown(true);
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({
                          top: rect.bottom + window.scrollY + 4,
                          left: rect.left + window.scrollX,
                          width: rect.width,
                        });
                      }
                    }}
                    placeholder={selectedHelpers.length === 0 ? "ค้นหาพนักงานบริการ..." : "เพิ่มอีก..."}
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
                    data-helper-input
                  />
                </div>

                {showHelperDropdown && helperDropdownPosition && createPortal(
                  <div
                    data-helper-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${helperDropdownPosition.top}px`,
                      left: `${helperDropdownPosition.left}px`,
                      width: `${helperDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId)
                      .filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase()))
                      .map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedHelpers(prev => [...prev, staff.id]);
                            setHelperSearch('');
                            setTimeout(() => {
                              if (helperInputRef.current) {
                                const rect = helperInputRef.current.getBoundingClientRect();
                                setHelperDropdownPosition({
                                  top: rect.bottom + window.scrollY + 4,
                                  left: rect.left + window.scrollX,
                                  width: rect.width,
                                });
                              }
                            }, 0);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                        >
                          <div>{staff.name}</div>
                          {staff.employee_code && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
                          )}
                        </button>
                      ))}
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId)
                      .filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่พบพนักงาน
                        </div>
                      )}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Crew Summary */}
          {(selectedDriverStaffId || selectedHelpers.length > 0) && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สรุปพนักงานในทริป ({(selectedDriverStaffId ? 1 : 0) + selectedHelpers.length} คน)
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDriverStaffId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    <Truck size={14} />
                    {availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'คนขับ'}
                    <span className="text-xs font-medium ml-1">(คนขับ)</span>
                  </span>
                )}
                {selectedHelpers.map(helperId => {
                  const helper = availableStaff.find(s => s.id === helperId);
                  return (
                    <span key={helperId} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800">
                      <User size={14} />
                      {helper?.name || 'Unknown'}
                      <span className="text-xs font-medium ml-1">(บริการ)</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Capacity Summary */}
        {formData.vehicle_id && selectedStores.length > 0 && (() => {
          // Check if there are any items in any store
          const hasItems = selectedStores.some(store => store.items.length > 0);

          return (
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Package size={20} />
                สรุปความจุ
              </h3>
              {!hasItems ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  <p>กรุณาเพิ่มสินค้าในร้านค้าก่อน</p>
                  <p className="text-xs mt-2">ระบบจะคำนวณความจุอัตโนมัติเมื่อมีการเพิ่มสินค้า</p>
                </div>
              ) : capacitySummary?.loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  กำลังคำนวณ...
                </div>
              ) : capacitySummary ? (
                <div className="space-y-3">
                  {capacitySummary.errors.length > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
                        <AlertCircle size={16} />
                        <span className="font-medium">ข้อผิดพลาด:</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                        {capacitySummary.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {capacitySummary.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                        <AlertCircle size={16} />
                        <span className="font-medium">คำเตือน:</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 space-y-1">
                        {capacitySummary.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        จำนวนพาเลท
                        {palletPackingResult ? (
                          <span className="block text-xs text-green-600 dark:text-green-400 font-normal mt-0.5">
                            (คำนวณแบบ bin-packing จัดรวมหลายชนิดบนพาเลทเดียวกัน)
                          </span>
                        ) : (
                          <span className="block text-xs text-slate-500 dark:text-slate-500 font-normal mt-0.5">
                            (ค่าประมาณแยกตามชนิดสินค้า การจัดเรียงจริงอาจใช้น้อยกว่าถ้ารวมพาเลทได้)
                          </span>
                        )}
                      </div>
                      {(() => {
                        const displayPallets = palletPackingResult?.totalPallets ?? capacitySummary.totalPallets;
                        const maxPallets = capacitySummary.vehicleMaxPallets;
                        return (
                          <>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {displayPallets}
                              {maxPallets !== null && (
                                <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                                  {' '}/ {maxPallets}
                                </span>
                              )}
                            </div>
                            {maxPallets !== null && (
                              <div className="mt-2">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${displayPallets > maxPallets
                                      ? 'bg-red-500'
                                      : displayPallets > maxPallets * 0.9
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                      }`}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (displayPallets / maxPallets) * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {Math.round(
                                    (displayPallets / maxPallets) * 100
                                  )}
                                  % ของความจุ
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        น้ำหนักรวม
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {capacitySummary.totalWeightKg.toFixed(2)} กก.
                        {capacitySummary.vehicleMaxWeightKg !== null && (
                          <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                            {' '}/ {capacitySummary.vehicleMaxWeightKg} กก.
                          </span>
                        )}
                      </div>
                      {capacitySummary.vehicleMaxWeightKg !== null && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg
                                ? 'bg-red-500'
                                : capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg * 0.9
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                                }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round(
                              (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                            )}
                            % ของความจุ
                          </div>
                        </div>
                      )}
                    </div>
                    {/* ตัดการแสดงความสูงรวมออก (ยังคำนวณภายในแต่ไม่แสดง) */}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  กำลังคำนวณความจุ...
                </div>
              )}
            </Card>
          );
        })()}

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
                {showStoreDropdown && (
                  <div
                    data-store-dropdown-portal
                    className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    onMouseDown={(e) => {
                      // Allow scrolling by not preventing default
                      e.stopPropagation();
                    }}
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
                                // Use onMouseDown to prevent dropdown from closing before click
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
                        </>
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                          {storeSearch ? (totalMatches > 0 ? 'ร้านค้านี้ถูกเลือกไปแล้ว' : 'ไม่พบร้านค้าที่ค้นหา') : 'พิมพ์เพื่อค้นหาร้านค้า'}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected Stores */}
          <div className="space-y-4">
            {selectedStores.map((storeWithItems, storeIndex) => {
              // Use getStoreInfo to get store from cache if stores array is empty
              const store = getStoreInfo(storeWithItems.store_id);
              if (!store) {
                // Store not found - show placeholder or loading
                return (
                  <div
                    key={storeWithItems.store_id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
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
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        ความสูงกองสูงสุด
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {capacitySummary?.totalHeightCm?.toFixed(1) || '0.0'} ซม.
                        {capacitySummary && capacitySummary.vehicleMaxHeightCm !== null && (
                          <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                            {' '}/ {capacitySummary!.vehicleMaxHeightCm} ซม.
                          </span>
                        )}
                      </div>
                      {capacitySummary && capacitySummary.vehicleMaxHeightCm !== null && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${capacitySummary!.totalHeightCm > capacitySummary!.vehicleMaxHeightCm
                                ? 'bg-red-500'
                                : capacitySummary!.totalHeightCm > capacitySummary!.vehicleMaxHeightCm * 0.9
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                                }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (capacitySummary!.totalHeightCm / capacitySummary!.vehicleMaxHeightCm) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round(
                              (capacitySummary!.totalHeightCm / capacitySummary!.vehicleMaxHeightCm) * 100
                            )}
                            % ของความจุ
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

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
                                className={`flex items-center gap-2 p-2 rounded border ${isAdded
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium text-sm ${isAdded
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
                                  <div className={`text-xs truncate ${isAdded
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

                          {/* Header row */}
                          <div className="hidden sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto] gap-2 px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <div>รหัสสินค้า</div>
                            <div>ชื่อสินค้า</div>
                            <div>หมวดหมู่</div>
                            <div className="text-right">จำนวน / หน่วย</div>
                            <div className="text-center">ลบ</div>
                          </div>

                          {storeWithItems.items.map((item, itemIndex) => {
                            const product = getProductInfo(item.product_id);
                            if (!product) return null;

                            return (
                              <div
                                key={item.product_id}
                                className="flex flex-col sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto] gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded"
                              >
                                {/* Code */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    รหัสสินค้า
                                  </div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100 break-words text-sm">
                                    {product.product_code}
                                  </div>
                                </div>

                                {/* Name */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    ชื่อสินค้า
                                  </div>
                                  <div className="text-sm text-slate-900 dark:text-slate-100 break-words">
                                    {product.product_name}
                                  </div>
                                </div>

                                {/* Category */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    หมวดหมู่
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {product.category}
                                  </div>
                                </div>

                                {/* Quantity + unit */}
                                <div className="flex items-center gap-1 sm:justify-end">
                                  <div className="flex-1 sm:flex-none">
                                    <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                      จำนวน
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
                                      className="w-full text-right"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap pl-1">
                                    {product.unit}
                                  </div>
                                </div>

                                {/* Remove button */}
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduct(storeIndex, itemIndex)}
                                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>

                                {/* Phase 0: Pallet Config Selector - Full width below */}
                                <div className="col-span-full">
                                  <PalletConfigSelector
                                    productId={item.product_id}
                                    productName={product.product_name}
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

        {/* Edit Reason - Required for Edit Mode */}
        {isEdit && (
          <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700">
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
              <AlertCircle size={20} />
              เหตุผลในการแก้ไข (บังคับ)
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป เพื่อบันทึกประวัติการแก้ไข
            </p>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="เช่น แก้ไขรถ, เปลี่ยนคนขับ, แก้ไขร้านค้า, แก้ไขสินค้า, เป็นต้น"
              rows={3}
              required
              className="w-full px-4 py-2 border-2 border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
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


