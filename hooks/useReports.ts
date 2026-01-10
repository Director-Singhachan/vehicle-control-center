// Reports Hooks
import { useState, useEffect, useMemo } from 'react';
import { reportsService } from '../services/reportsService';
import type {
  MonthlyFuelReport,
  VehicleFuelComparison,
  FuelTrend,
  MonthlyTripReport,
  VehicleTripSummary,
  DriverTripReport,
  MonthlyMaintenanceReport,
  VehicleMaintenanceComparison,
  VehicleMaintenanceHistory,
  CostAnalysis,
  CostPerKm,
  MonthlyCostTrend,
  StaffCommissionSummary,
  StaffItemStatistics,
  StaffItemDetail,
} from '../services/reportsService';

// Fuel Reports Hooks
export const useMonthlyFuelReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyFuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyFuelReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyFuelReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleFuelComparison = (months: number = 6, options?: { startDate?: Date; endDate?: Date; branch?: string }) => {
  const [data, setData] = useState<VehicleFuelComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleFuelComparison(months, options?.startDate, options?.endDate, options?.branch);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleFuelComparison] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months, options?.startDate?.getTime(), options?.endDate?.getTime(), options?.branch]);

  return { data, loading, error };
};

export const useFuelTrend = (months: number = 6, options?: { startDate?: Date; endDate?: Date; branch?: string }) => {
  const [data, setData] = useState<FuelTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getFuelTrend(months, options?.startDate, options?.endDate, options?.branch);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useFuelTrend] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months, options?.startDate?.getTime(), options?.endDate?.getTime(), options?.branch]);

  return { data, loading, error };
};

// Trip Reports Hooks
export const useMonthlyTripReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyTripReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyTripReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyTripReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleTripSummary = (months: number = 6) => {
  const [data, setData] = useState<VehicleTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleTripSummary(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleTripSummary] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useDriverTripReport = (months: number = 6) => {
  const [data, setData] = useState<DriverTripReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getDriverTripReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useDriverTripReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

// Maintenance Reports Hooks
export const useMonthlyMaintenanceReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyMaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyMaintenanceReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyMaintenanceReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleMaintenanceComparison = (months: number = 6) => {
  const [data, setData] = useState<VehicleMaintenanceComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleMaintenanceComparison(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleMaintenanceComparison] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useVehicleMaintenanceHistory = (vehicleId: string | null) => {
  const [data, setData] = useState<VehicleMaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleMaintenanceHistory(vehicleId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleMaintenanceHistory] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vehicleId]);

  return { data, loading, error };
};

// Cost Analysis Hooks
export const useCostAnalysis = (startDate: Date, endDate: Date) => {
  const [data, setData] = useState<CostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getCostAnalysis(startDate, endDate);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useCostAnalysis] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  return { data, loading, error };
};

export const useCostPerKm = (months: number = 6) => {
  const [data, setData] = useState<CostPerKm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getCostPerKm(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useCostPerKm] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

export const useMonthlyCostTrend = (months: number = 6) => {
  const [data, setData] = useState<MonthlyCostTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyCostTrend(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyCostTrend] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

// Vehicle Usage Ranking Hook
export const useVehicleUsageRanking = (options?: {
  startDate?: Date;
  endDate?: Date;
  branch?: string | null;
  limit?: number;
}) => {
  const [data, setData] = useState<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalDistance: number;
    totalTrips: number;
    totalHours: number;
    averageDistance: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create stable dependency string to prevent unnecessary re-fetches
  const dependencyKey = useMemo(() => {
    if (!options) return 'no-options';
    return JSON.stringify({
      startDate: options.startDate?.toISOString(),
      endDate: options.endDate?.toISOString(),
      branch: options.branch,
      limit: options.limit,
    });
  }, [
    options?.startDate?.getTime(),
    options?.endDate?.getTime(),
    options?.branch,
    options?.limit,
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleUsageRanking(options);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleUsageRanking] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dependencyKey]);

  return { data, loading, error };
};

// Vehicle Fuel Consumption Hook
export const useVehicleFuelConsumption = (options?: {
  startDate?: Date;
  endDate?: Date;
  branch?: string | null;
}) => {
  const [data, setData] = useState<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalLiters: number;
    totalCost: number;
    fillCount: number;
    averageEfficiency: number | null;
    averagePricePerLiter: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create stable dependency string to prevent unnecessary re-fetches
  const dependencyKey = useMemo(() => {
    if (!options) return 'no-options';
    return JSON.stringify({
      startDate: options.startDate?.toISOString(),
      endDate: options.endDate?.toISOString(),
      branch: options.branch,
    });
  }, [
    options?.startDate?.getTime(),
    options?.endDate?.getTime(),
    options?.branch,
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getVehicleFuelConsumption(options);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useVehicleFuelConsumption] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

// Delivery Trip Reports Hooks
export const useDeliverySummaryByVehicle = (
  startDate?: Date,
  endDate?: Date,
  vehicleId?: string
) => {
  const [data, setData] = useState<Array<{
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
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
      vehicle: vehicleId,
    });
  }, [startDate?.getTime(), endDate?.getTime(), vehicleId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getDeliverySummaryByVehicle(startDate, endDate, vehicleId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useDeliverySummaryByVehicle] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useDeliverySummaryByStore = (
  startDate?: Date,
  endDate?: Date,
  storeId?: string
) => {
  const [data, setData] = useState<Array<{
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
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
      store: storeId,
    });
  }, [startDate?.getTime(), endDate?.getTime(), storeId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getDeliverySummaryByStore(startDate, endDate, storeId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useDeliverySummaryByStore] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useDeliverySummaryByProduct = (
  startDate?: Date,
  endDate?: Date,
  productId?: string
) => {
  const [data, setData] = useState<Array<{
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
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
      product: productId,
    });
  }, [startDate?.getTime(), endDate?.getTime(), productId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getDeliverySummaryByProduct(startDate, endDate, productId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useDeliverySummaryByProduct] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useMonthlyDeliveryReport = (months: number = 6) => {
  const [data, setData] = useState<Array<{
    month: string;
    monthLabel: string;
    totalTrips: number;
    totalStores: number;
    totalItems: number;
    totalQuantity: number;
    totalDistance: number;
    averageItemsPerTrip: number;
    averageQuantityPerTrip: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getMonthlyDeliveryReport(months);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useMonthlyDeliveryReport] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  return { data, loading, error };
};

// Staff commission / workload report hooks
export const useStaffCommissionSummary = (
  startDate?: Date,
  endDate?: Date
) => {
  const [data, setData] = useState<StaffCommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
    });
  }, [startDate?.getTime(), endDate?.getTime()]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getStaffCommissionSummary(startDate, endDate);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useStaffCommissionSummary] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useStaffItemStatistics = (
  startDate?: Date,
  endDate?: Date
) => {
  const [data, setData] = useState<import('../services/reportsService').StaffItemStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
    });
  }, [startDate?.getTime(), endDate?.getTime()]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getStaffItemStatistics(startDate, endDate);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useStaffItemStatistics] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useStaffItemDetails = (
  startDate?: Date,
  endDate?: Date,
  staffId?: string
) => {
  const [data, setData] = useState<StaffItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: startDate?.getTime(),
      end: endDate?.getTime(),
      staffId,
    });
  }, [startDate?.getTime(), endDate?.getTime(), staffId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await reportsService.getStaffItemDetails(startDate, endDate, staffId);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useStaffItemDetails] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useProductDeliveryHistory = (
  storeId: string,
  productId: string,
  startDate?: Date,
  endDate?: Date
) => {
  const [data, setData] = useState<Array<{
    delivery_date: string;
    trip_number: string;
    trip_id: string;
    quantity: number;
    vehicle_plate: string | null;
    driver_name: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      store: storeId,
      product: productId,
      start: startDate?.getTime(),
      end: endDate?.getTime(),
    });
  }, [storeId, productId, startDate?.getTime(), endDate?.getTime()]);

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId || !productId) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await reportsService.getProductDeliveryHistory(storeId, productId, startDate, endDate);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('[useProductDeliveryHistory] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return { data, loading, error };
};

