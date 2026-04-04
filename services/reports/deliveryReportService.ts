// Delivery and staff reports - delivery summary, monthly delivery, staff commission, staff item stats
import { supabase } from '../../lib/supabase';

export interface StaffCommissionSummary {
  staff_id: string;
  staff_name: string;
  totalTrips: number;
  totalActualCommission: number;
  averageCommissionPerTrip: number;
}

export interface StaffItemStatistics {
  staff_id: string;
  staff_name: string;
  staff_code: string | null;
  staff_phone: string | null;
  staff_status: string;
  total_trips: number;
  total_items_carried: number;
  completed_trips: number;
  in_progress_trips: number;
  planned_trips: number;
  last_trip_date: string | null;
  first_trip_date: string | null;
}

export interface StaffItemDetail {
  staff_id: string;
  staff_name: string;
  staff_code: string | null;
  staff_phone: string | null;
  staff_status: string;
  delivery_trip_id: string;
  trip_number: string;
  planned_date: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  total_quantity: number;
  quantity_per_staff: number;
  store_name: string | null;
  store_code: string | null;
}

export interface MonthlyDeliveryReportRow {
  month: string;
  monthLabel: string;
  totalTrips: number;
  totalStores: number;
  totalItems: number;
  totalQuantity: number;
  totalDistance: number;
  averageItemsPerTrip: number;
  averageQuantityPerTrip: number;
}

export interface DeliverySummaryByStoreRow {
  store_id: string;
  customer_code: string;
  customer_name: string;
  address: string | null;
  totalTrips: number;
  totalItems: number;
  totalQuantity: number;
  products: Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    unit: string;
    totalQuantity: number;
    deliveryCount: number;
  }>;
}

export const deliveryReportService = {
  getDeliverySummaryByVehicle: async (
    startDate?: Date,
    endDate?: Date,
    vehicleId?: string
  ): Promise<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalTrips: number;
    totalStores: number;
    totalItems: number;
    totalQuantity: number;
    totalDistance: number;
    averageItemsPerTrip: number;
    averageQuantityPerTrip: number;
    averageStoresPerTrip: number;
  }>> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      let statsQuery = supabase
        .from('delivery_stats_by_day_vehicle')
        .select(`
          stat_date,
          vehicle_id,
          total_trips,
          total_stores,
          total_items,
          total_quantity
        `)
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (vehicleId) {
        statsQuery = statsQuery.eq('vehicle_id', vehicleId);
      }

      const { data: stats, error: statsError } = await statsQuery;

      if (statsError) {
        console.error('[reportsService] Error fetching vehicle stats:', statsError);
        throw statsError;
      }

      if (!stats || stats.length === 0) {
        return [];
      }

      const vehicleIds = Array.from(new Set(stats.map((s: any) => s.vehicle_id))).filter(Boolean);

      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, make, model, branch')
        .in('id', vehicleIds);

      if (vehiclesError) {
        console.error('[reportsService] Error fetching vehicles for stats:', vehiclesError);
        throw vehiclesError;
      }

      const vehicleMap = new Map(
        (vehicles || []).map((v: any) => [v.id, v])
      );

      let tripLogsQuery = supabase
        .from('trip_logs')
        .select('vehicle_id, distance_km')
        .eq('status', 'checked_in')
        .not('distance_km', 'is', null)
        .gte('checkout_time', startDate.toISOString())
        .lte('checkout_time', endDate.toISOString())
        .in('vehicle_id', vehicleIds);

      const { data: tripLogs, error: tripLogsError } = await tripLogsQuery;

      if (tripLogsError) {
        console.error('[reportsService] Error fetching trip logs for distance:', tripLogsError);
        console.warn('[reportsService] Falling back to delivery_stats_by_day_vehicle distance');
      }

      const aggregatedByVehicle = new Map<string, {
        vehicle_id: string;
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
        totalTrips: number;
        totalStores: number;
        totalItems: number;
        totalQuantity: number;
        totalDistance: number;
      }>();

      (stats as any[]).forEach(stat => {
        const vid = stat.vehicle_id;
        if (!vid) return;

        const vehicle = vehicleMap.get(vid) as any;

        if (!aggregatedByVehicle.has(vid)) {
          aggregatedByVehicle.set(vid, {
            vehicle_id: vid,
            plate: vehicle?.plate || 'N/A',
            make: vehicle?.make || null,
            model: vehicle?.model || null,
            branch: vehicle?.branch || null,
            totalTrips: 0,
            totalStores: 0,
            totalItems: 0,
            totalQuantity: 0,
            totalDistance: 0,
          });
        }

        const agg = aggregatedByVehicle.get(vid)!;
        agg.totalTrips += Number(stat.total_trips || 0);
        agg.totalStores += Number(stat.total_stores || 0);
        agg.totalItems += Number(stat.total_items || 0);
        agg.totalQuantity += Number(stat.total_quantity || 0);
      });

      if (tripLogs && tripLogs.length > 0) {
        const distanceMap = new Map<string, number>();

        tripLogs.forEach(log => {
          if (!log.vehicle_id || !log.distance_km) return;

          const vid = log.vehicle_id;
          if (!distanceMap.has(vid)) {
            distanceMap.set(vid, 0);
          }
          distanceMap.set(vid, (distanceMap.get(vid) || 0) + Number(log.distance_km || 0));
        });

        distanceMap.forEach((distance, vid) => {
          if (aggregatedByVehicle.has(vid)) {
            aggregatedByVehicle.get(vid)!.totalDistance = distance;
          }
        });
      } else {
        console.warn('[reportsService] No trip_logs data found, falling back to stats table distance');
        const { data: statsWithDistance } = await supabase
          .from('delivery_stats_by_day_vehicle')
          .select('vehicle_id, total_distance_km')
          .gte('stat_date', startDateStr)
          .lte('stat_date', endDateStr);

        if (vehicleId && statsWithDistance) {
          const filteredStats = statsWithDistance.filter((s: any) => s.vehicle_id === vehicleId);
          filteredStats.forEach((stat: any) => {
            const vid = stat.vehicle_id;
            if (aggregatedByVehicle.has(vid)) {
              aggregatedByVehicle.get(vid)!.totalDistance += Number(stat.total_distance_km || 0);
            }
          });
        } else if (statsWithDistance) {
          statsWithDistance.forEach((stat: any) => {
            const vid = stat.vehicle_id;
            if (aggregatedByVehicle.has(vid)) {
              aggregatedByVehicle.get(vid)!.totalDistance += Number(stat.total_distance_km || 0);
            }
          });
        }
      }

      const result = Array.from(aggregatedByVehicle.values()).map(vehicleData => ({
        vehicle_id: vehicleData.vehicle_id,
        plate: vehicleData.plate,
        make: vehicleData.make,
        model: vehicleData.model,
        branch: vehicleData.branch,
        totalTrips: vehicleData.totalTrips,
        totalStores: vehicleData.totalStores,
        totalItems: vehicleData.totalItems,
        totalQuantity: vehicleData.totalQuantity,
        totalDistance: vehicleData.totalDistance,
        averageItemsPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalItems / vehicleData.totalTrips : 0,
        averageQuantityPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalQuantity / vehicleData.totalTrips : 0,
        averageStoresPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalStores / vehicleData.totalTrips : 0,
      })).sort((a, b) => b.totalTrips - a.totalTrips);

      return result;
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByVehicle error:', error);
      throw error;
    }
  },

  getDeliverySummaryByStore: async (
    startDate?: Date,
    endDate?: Date,
    storeId?: string
  ): Promise<DeliverySummaryByStoreRow[]> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      let storeStatsQuery = supabase
        .from('delivery_stats_by_day_store')
        .select('stat_date, store_id, total_trips, total_items, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (storeId) {
        storeStatsQuery = storeStatsQuery.eq('store_id', storeId);
      }

      const { data: storeStats, error: storeStatsError } = await storeStatsQuery;

      if (storeStatsError) {
        console.error('[reportsService] Error fetching store stats:', storeStatsError);
        throw storeStatsError;
      }

      if (!storeStats || storeStats.length === 0) {
        return [];
      }

      const aggregatedStoreStats = new Map<string, {
        store_id: string;
        totalTrips: number;
        totalItems: number;
        totalQuantity: number;
      }>();

      (storeStats as any[]).forEach(stat => {
        const sid = stat.store_id;
        if (!sid) return;

        if (!aggregatedStoreStats.has(sid)) {
          aggregatedStoreStats.set(sid, {
            store_id: sid,
            totalTrips: 0,
            totalItems: 0,
            totalQuantity: 0,
          });
        }

        const agg = aggregatedStoreStats.get(sid)!;
        agg.totalTrips += Number(stat.total_trips || 0);
        agg.totalItems += Number(stat.total_items || 0);
        agg.totalQuantity += Number(stat.total_quantity || 0);
      });

      const storeIds = Array.from(aggregatedStoreStats.keys());

      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, customer_code, customer_name, address')
        .in('id', storeIds);

      if (storesError) {
        console.error('[reportsService] Error fetching stores for stats:', storesError);
        throw storesError;
      }

      const storeMap = new Map(
        (stores || []).map((s: any) => [s.id, s])
      );

      let storeProductStatsQuery = supabase
        .from('delivery_stats_by_day_store_product')
        .select('stat_date, store_id, product_id, total_deliveries, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr)
        .in('store_id', storeIds);

      const { data: storeProductStats, error: storeProductError } = await storeProductStatsQuery;

      if (storeProductError) {
        console.error('[reportsService] Error fetching store+product stats:', storeProductError);
        throw storeProductError;
      }

      const productIds = Array.from(
        new Set(
          (storeProductStats || []).map((s: any) => s.product_id).filter(Boolean)
        )
      );

      let productsMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, product_code, product_name, unit')
          .in('id', productIds);

        if (productsError) {
          console.error('[reportsService] Error fetching products for stats:', productsError);
          throw productsError;
        }

        productsMap = new Map(
          (products || []).map((p: any) => [p.id, p])
        );
      }

      const storeProductAgg = new Map<string, Map<string, {
        product_id: string;
        totalQuantity: number;
        deliveryCount: number;
      }>>();

      (storeProductStats || []).forEach((stat: any) => {
        const sid = stat.store_id;
        const pid = stat.product_id;
        if (!sid || !pid) return;

        if (!storeProductAgg.has(sid)) {
          storeProductAgg.set(sid, new Map());
        }
        const productMapForStore = storeProductAgg.get(sid)!;

        if (!productMapForStore.has(pid)) {
          productMapForStore.set(pid, {
            product_id: pid,
            totalQuantity: 0,
            deliveryCount: 0,
          });
        }

        const agg = productMapForStore.get(pid)!;
        agg.totalQuantity += Number(stat.total_quantity || 0);
        agg.deliveryCount += Number(stat.total_deliveries || 0);
      });

      const result = Array.from(aggregatedStoreStats.values()).map(storeStat => {
        const store = storeMap.get(storeStat.store_id) as any;
        if (!store) return null;

        const productMapForStore = storeProductAgg.get(storeStat.store_id) || new Map();

        const products = Array.from(productMapForStore.values()).map(p => {
          const product = productsMap.get(p.product_id) as any;
          return {
            product_id: p.product_id,
            product_code: product?.product_code || '',
            product_name: product?.product_name || '',
            unit: product?.unit || '',
            totalQuantity: p.totalQuantity,
            deliveryCount: p.deliveryCount,
          };
        }).sort((a, b) => b.totalQuantity - a.totalQuantity);

        return {
          store_id: storeStat.store_id,
          customer_code: store.customer_code,
          customer_name: store.customer_name,
          address: store.address,
          totalTrips: storeStat.totalTrips,
          totalItems: storeStat.totalItems,
          totalQuantity: storeStat.totalQuantity,
          products,
        };
      }).filter(Boolean) as Array<{
        store_id: string;
        customer_code: string;
        customer_name: string;
        address: string | null;
        totalTrips: number;
        totalItems: number;
        totalQuantity: number;
        products: Array<{
          product_id: string;
          product_code: string;
          product_name: string;
          unit: string;
          totalQuantity: number;
          deliveryCount: number;
        }>;
      }>;

      return result.sort((a, b) => b.totalTrips - a.totalTrips);
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByStore error:', error);
      throw error;
    }
  },

  getDeliverySummaryByProduct: async (
    startDate?: Date,
    endDate?: Date,
    productId?: string
  ): Promise<Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    totalQuantity: number;
    totalDeliveries: number;
    totalStores: number;
    stores: Array<{
      store_id: string;
      customer_code: string;
      customer_name: string;
      quantity: number;
      deliveryCount: number;
    }>;
  }>> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      let statsQuery = supabase
        .from('delivery_stats_by_day_store_product')
        .select('stat_date, store_id, product_id, total_deliveries, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (productId) {
        statsQuery = statsQuery.eq('product_id', productId);
      }

      const { data: stats, error: statsError } = await statsQuery;

      if (statsError) {
        console.error('[reportsService] Error fetching product stats:', statsError);
        throw statsError;
      }

      if (!stats || stats.length === 0) {
        return [];
      }

      const productIds = Array.from(
        new Set((stats as any[]).map(s => s.product_id).filter(Boolean))
      );
      const storeIds = Array.from(
        new Set((stats as any[]).map(s => s.store_id).filter(Boolean))
      );

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_code, product_name, category, unit')
        .in('id', productIds);

      if (productsError) {
        console.error('[reportsService] Error fetching products for stats:', productsError);
        throw productsError;
      }

      const productMap = new Map(
        (products || []).map((p: any) => [p.id, p])
      );

      let storesMap = new Map<string, any>();
      if (storeIds.length > 0) {
        const { data: stores, error: storesError } = await supabase
          .from('stores')
          .select('id, customer_code, customer_name')
          .in('id', storeIds);

        if (storesError) {
          console.error('[reportsService] Error fetching stores for product stats:', storesError);
          throw storesError;
        }

        storesMap = new Map(
          (stores || []).map((s: any) => [s.id, s])
        );
      }

      const productAgg = new Map<string, {
        product_id: string;
        totalQuantity: number;
        totalDeliveries: number;
        storeStats: Map<string, {
          store_id: string;
          totalQuantity: number;
          deliveryCount: number;
        }>;
      }>();

      (stats as any[]).forEach(stat => {
        const pid = stat.product_id;
        const sid = stat.store_id;
        if (!pid || !sid) return;

        if (!productAgg.has(pid)) {
          productAgg.set(pid, {
            product_id: pid,
            totalQuantity: 0,
            totalDeliveries: 0,
            storeStats: new Map(),
          });
        }

        const agg = productAgg.get(pid)!;
        agg.totalQuantity += Number(stat.total_quantity || 0);
        agg.totalDeliveries += Number(stat.total_deliveries || 0);

        if (!agg.storeStats.has(sid)) {
          agg.storeStats.set(sid, {
            store_id: sid,
            totalQuantity: 0,
            deliveryCount: 0,
          });
        }

        const storeAgg = agg.storeStats.get(sid)!;
        storeAgg.totalQuantity += Number(stat.total_quantity || 0);
        storeAgg.deliveryCount += Number(stat.total_deliveries || 0);
      });

      const result = Array.from(productAgg.values()).map(productStat => {
        const product = productMap.get(productStat.product_id) as any;
        if (!product) return null;

        const stores = Array.from(productStat.storeStats.values()).map(s => {
          const store = storesMap.get(s.store_id) as any;
          return {
            store_id: s.store_id,
            customer_code: store?.customer_code || '',
            customer_name: store?.customer_name || '',
            quantity: s.totalQuantity,
            deliveryCount: s.deliveryCount,
          };
        }).sort((a, b) => b.quantity - a.quantity);

        return {
          product_id: product.id,
          product_code: product.product_code,
          product_name: product.product_name,
          category: product.category,
          unit: product.unit,
          totalQuantity: productStat.totalQuantity,
          totalDeliveries: productStat.totalDeliveries,
          totalStores: productStat.storeStats.size,
          stores,
        };
      }).filter(Boolean) as Array<{
        product_id: string;
        product_code: string;
        product_name: string;
        category: string;
        unit: string;
        totalQuantity: number;
        totalDeliveries: number;
        totalStores: number;
        stores: Array<{
          store_id: string;
          customer_code: string;
          customer_name: string;
          quantity: number;
          deliveryCount: number;
        }>;
      }>;

      return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByProduct error:', error);
      throw error;
    }
  },

  getMonthlyDeliveryReport: async (
    months: number = 6
  ): Promise<MonthlyDeliveryReportRow[]> => {
    try {
      const now = new Date();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

      const { data: allCompletedTrips, error: tripsError } = await supabase
        .from('delivery_trips')
        .select('id, planned_date')
        .eq('status', 'completed');

      if (tripsError) {
        console.error('[reportsService] Error fetching trips:', tripsError);
        throw tripsError;
      }

      if (!allCompletedTrips || allCompletedTrips.length === 0) {
        return [];
      }

      const allTripIds = allCompletedTrips.map(t => t.id);

      const { data: tripStores } = await supabase
        .from('delivery_trip_stores')
        .select(`
          id, 
          delivery_trip_id, 
          delivery_status, 
          delivered_at,
          delivery_trip:delivery_trips!inner(id, updated_at, planned_date)
        `)
        .in('delivery_trip_id', allTripIds);

      if (!tripStores || tripStores.length === 0) {
        return [];
      }

      let tripLogs: any[] = [];
      try {
        const { data: tripLogsData, error: tripLogsError } = await supabase
          .from('trip_logs')
          .select('id, delivery_trip_id, checkin_time')
          .in('delivery_trip_id', allTripIds)
          .not('checkin_time', 'is', null);

        if (tripLogsError) {
          console.warn('[reportsService] trip_logs fetch error, fallback to empty:', tripLogsError.message);
        } else {
          tripLogs = tripLogsData || [];
        }
      } catch (err: any) {
        console.warn('[reportsService] trip_logs fetch exception, fallback to empty:', err?.message || err);
      }

      const tripLogMap = new Map((tripLogs || []).map(tl => [tl.delivery_trip_id, tl]));

      const filteredStores = tripStores.filter((store: any) => {
        let effectiveDateStr = store.delivered_at;

        if (!effectiveDateStr) {
          const tripLog = tripLogMap.get(store.delivery_trip_id) as any;
          if (tripLog?.checkin_time) {
            effectiveDateStr = tripLog.checkin_time;
          }
        }

        if (!effectiveDateStr) {
          effectiveDateStr = store.delivery_trip?.updated_at;
        }

        if (!effectiveDateStr) {
          effectiveDateStr = store.delivery_trip?.planned_date;
        }

        if (!effectiveDateStr) return false;

        const effectiveDate = new Date(effectiveDateStr);
        return effectiveDate >= startDate && effectiveDate <= endDate;
      });

      if (filteredStores.length === 0) {
        return [];
      }

      const tripIds = [...new Set(filteredStores.map((ts: any) => ts.delivery_trip_id))];
      const tripStoreIds = (tripStores || []).map(ts => ts.id);

      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('delivery_trip_store_id, quantity')
        .in('delivery_trip_store_id', tripStoreIds);

      const { data: tripLogsForDistance } = await supabase
        .from('trip_logs')
        .select('delivery_trip_id, distance_km')
        .in('delivery_trip_id', tripIds);

      const filteredTripLogs = (tripLogsForDistance || []).filter(log => log.delivery_trip_id !== null);

      const monthMap = new Map<string, {
        trips: any[];
        tripLogs: any[];
      }>();

      allCompletedTrips.forEach(trip => {
        const date = new Date(trip.planned_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            trips: [],
            tripLogs: [],
          });
        }
        monthMap.get(monthKey)!.trips.push(trip);
      });

      filteredTripLogs.forEach(log => {
        if (log.delivery_trip_id) {
          const storeForTrip = filteredStores.find((s: any) => s.delivery_trip_id === log.delivery_trip_id);
          if (storeForTrip) {
            let effectiveDateStr = storeForTrip.delivered_at;

            if (!effectiveDateStr) {
              const tripLog = tripLogMap.get(storeForTrip.delivery_trip_id) as any;
              if (tripLog?.checkin_time) {
                effectiveDateStr = tripLog.checkin_time;
              }
            }

            if (!effectiveDateStr) {
              effectiveDateStr = storeForTrip.delivery_trip?.updated_at;
            }

            if (!effectiveDateStr) {
              effectiveDateStr = storeForTrip.delivery_trip?.planned_date;
            }

            if (effectiveDateStr) {
              const date = new Date(effectiveDateStr);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const monthData = monthMap.get(monthKey);
              if (monthData) {
                monthData.tripLogs.push(log);
              }
            }
          }
        }
      });

      const result = Array.from(monthMap.entries()).map(([monthKey, monthData]) => {
        const date = new Date(monthKey + '-01');
        const monthLabel = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });

        const tripIdsForMonth = Array.from(monthData.trips);
        const storesForMonth = filteredStores.filter((ts: any) => tripIdsForMonth.includes(ts.delivery_trip_id));
        const itemsForMonth = (tripItems || []).filter(item => {
          const store = tripStores?.find(ts => ts.id === item.delivery_trip_store_id);
          return store && tripIdsForMonth.includes(store.delivery_trip_id);
        });

        const totalQuantity = itemsForMonth.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const totalDistance = monthData.tripLogs.reduce((sum, log) => sum + (log.distance_km || 0), 0);

        return {
          month: monthKey,
          monthLabel,
          totalTrips: tripIdsForMonth.length,
          totalStores: storesForMonth.length,
          totalItems: itemsForMonth.length,
          totalQuantity,
          totalDistance,
          averageItemsPerTrip: monthData.trips.length > 0 ? itemsForMonth.length / monthData.trips.length : 0,
          averageQuantityPerTrip: monthData.trips.length > 0 ? totalQuantity / monthData.trips.length : 0,
        };
      }).sort((a, b) => a.month.localeCompare(b.month));

      return result;
    } catch (error) {
      console.error('[reportsService] getMonthlyDeliveryReport error:', error);
      throw error;
    }
  },

  getStaffCommissionSummary: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<StaffCommissionSummary[]> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      const { data: trips, error: tripsError } = await supabase
        .from('delivery_trips')
        .select('id, planned_date')
        .eq('status', 'completed')
        .gte('planned_date', startDateStr)
        .lte('planned_date', endDateStr);

      if (tripsError) {
        console.error('[reportsService] Error fetching trips for staff commission summary:', tripsError);
        throw tripsError;
      }

      if (!trips || trips.length === 0) {
        return [];
      }

      const tripIds = (trips as any[]).map(t => t.id);

      const { data: logs, error: logsError } = await supabase
        .from('commission_logs')
        .select(`
          staff_id,
          delivery_trip_id,
          total_items_delivered,
          actual_commission,
          staff:service_staff!commission_logs_staff_id_fkey (
            id,
            name,
            status
          )
        `)
        .in('delivery_trip_id', tripIds);

      if (logsError) {
        console.error('[reportsService] Error fetching commission logs for staff summary:', logsError);
        throw logsError;
      }

      if (!logs || logs.length === 0) {
        return [];
      }

      type StaffAgg = {
        staff_id: string;
        staff_name: string;
        totalActualCommission: number;
        tripIds: Set<string>;
      };

      const staffMap = new Map<string, StaffAgg>();

      (logs as any[]).forEach(log => {
        const staffId = log.staff_id as string | null;
        if (!staffId) return;

        const staffName =
          (log.staff as any)?.name ||
          'ไม่ทราบชื่อ';

        if (!staffMap.has(staffId)) {
          staffMap.set(staffId, {
            staff_id: staffId,
            staff_name: staffName,
            totalActualCommission: 0,
            tripIds: new Set<string>(),
          });
        }

        const agg = staffMap.get(staffId)!;
        agg.totalActualCommission += Number(log.actual_commission || 0);
        if (log.delivery_trip_id) {
          agg.tripIds.add(log.delivery_trip_id as string);
        }
      });

      const result: StaffCommissionSummary[] = Array.from(staffMap.values()).map(agg => {
        const totalTrips = agg.tripIds.size;
        const totalActualCommission = agg.totalActualCommission;

        return {
          staff_id: agg.staff_id,
          staff_name: agg.staff_name,
          totalTrips,
          totalActualCommission,
          averageCommissionPerTrip: totalTrips > 0
            ? totalActualCommission / totalTrips
            : 0,
        };
      })
        .sort((a, b) => b.totalActualCommission - a.totalActualCommission);

      return result;
    } catch (error) {
      console.error('[reportsService] getStaffCommissionSummary error:', error);
      throw error;
    }
  },

  getProductDeliveryHistory: async (
    storeId: string,
    productId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    delivery_date: string;
    trip_number: string;
    trip_id: string;
    quantity: number;
    vehicle_plate: string | null;
    driver_name: string | null;
  }>> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date range provided');
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      let tripsQuery = supabase
        .from('delivery_trips')
        .select(`
          id,
          trip_number,
          planned_date,
          vehicle:vehicles!delivery_trips_vehicle_id_fkey(plate),
          driver:profiles!delivery_trips_driver_id_fkey(full_name)
        `)
        .eq('status', 'completed')
        .gte('planned_date', startDateStr)
        .lte('planned_date', endDateStr);

      const { data: trips, error: tripsError } = await tripsQuery;

      if (tripsError) {
        console.error('[reportsService] Error fetching trips:', { error: tripsError });
        throw new Error(`Failed to fetch delivery trips: ${tripsError.message || 'Unknown error'}`);
      }

      if (!trips || trips.length === 0) {
        return [];
      }

      const tripIds = trips.map((t: any) => t.id);
      const tripMap = new Map(trips.map((t: any) => [t.id, t]));

      const { data: tripStores } = await supabase
        .from('delivery_trip_stores')
        .select('id, delivery_trip_id')
        .in('delivery_trip_id', tripIds)
        .eq('store_id', storeId);

      if (!tripStores || tripStores.length === 0) {
        return [];
      }

      const tripStoreIds = tripStores.map(ts => ts.id);
      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('delivery_trip_store_id, quantity')
        .in('delivery_trip_store_id', tripStoreIds)
        .eq('product_id', productId);

      if (!tripItems || tripItems.length === 0) {
        return [];
      }

      const result = tripItems.map(item => {
        const tripStore = tripStores.find(ts => ts.id === item.delivery_trip_store_id);
        if (!tripStore) return null;

        const trip = tripMap.get(tripStore.delivery_trip_id) as any;
        if (!trip) return null;

        const vehicle = trip.vehicle as any;
        const driver = trip.driver as any;

        return {
          delivery_date: trip.planned_date,
          trip_number: trip.trip_number,
          trip_id: trip.id,
          quantity: Number(item.quantity || 0),
          vehicle_plate: vehicle?.plate || null,
          driver_name: driver?.full_name || null,
        };
      }).filter((item): item is {
        delivery_date: string;
        trip_number: string;
        trip_id: string;
        quantity: number;
        vehicle_plate: string | null;
        driver_name: string | null;
      } => item !== null);

      return result.sort((a, b) => {
        const dateCompare = b.delivery_date.localeCompare(a.delivery_date);
        if (dateCompare !== 0) return dateCompare;
        return b.trip_number.localeCompare(a.trip_number);
      });
    } catch (error) {
      console.error('[reportsService] getProductDeliveryHistory error:', error);
      throw error;
    }
  },

  getStaffItemStatistics: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<StaffItemStatistics[]> => {
    try {
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = startDate ? formatDateForQuery(startDate) : null;
      const endDateStr = endDate ? formatDateForQuery(endDate) : null;

      const { data, error } = await supabase.rpc('get_staff_item_statistics', {
        start_date: startDateStr,
        end_date: endDateStr,
      });

      if (error) {
        console.error('[reportsService] getStaffItemStatistics error:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        staff_code: item.staff_code,
        staff_phone: item.staff_phone,
        staff_status: item.staff_status,
        total_trips: parseInt(item.total_trips || '0', 10),
        total_items_carried: parseFloat(item.total_items_carried || '0'),
        completed_trips: parseInt(item.completed_trips || '0', 10),
        in_progress_trips: parseInt(item.in_progress_trips || '0', 10),
        planned_trips: parseInt(item.planned_trips || '0', 10),
        last_trip_date: item.last_trip_date,
        first_trip_date: item.first_trip_date,
      }));
    } catch (error) {
      console.error('[reportsService] getStaffItemStatistics error:', error);
      throw error;
    }
  },

  getStaffItemDetails: async (
    startDate?: Date,
    endDate?: Date,
    staffId?: string
  ): Promise<StaffItemDetail[]> => {
    try {
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = startDate ? formatDateForQuery(startDate) : null;
      const endDateStr = endDate ? formatDateForQuery(endDate) : null;

      const { data, error } = await supabase.rpc('get_staff_item_details', {
        start_date: startDateStr,
        end_date: endDateStr,
        staff_id_param: staffId || null,
      });

      if (error) {
        console.error('[reportsService] getStaffItemDetails error:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        staff_code: item.staff_code,
        staff_phone: item.staff_phone,
        staff_status: item.staff_status,
        delivery_trip_id: item.delivery_trip_id,
        trip_number: item.trip_number,
        planned_date: item.planned_date,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        unit: item.unit,
        total_quantity: parseFloat(item.total_quantity || '0'),
        quantity_per_staff: parseFloat(item.quantity_per_staff || '0'),
        store_name: item.store_name,
        store_code: item.store_code,
      }));
    } catch (error) {
      console.error('[reportsService] getStaffItemDetails error:', error);
      throw error;
    }
  },

  refreshDeliveryStatsByVehicle: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<void> => {
    try {
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      const { error } = await supabase.rpc('refresh_delivery_stats_by_day_vehicle', {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });

      if (error) {
        console.error('[reportsService] Error refreshing delivery stats:', error);
        throw error;
      }
    } catch (error) {
      console.error('[reportsService] refreshDeliveryStatsByVehicle error:', error);
      throw error;
    }
  },
};
