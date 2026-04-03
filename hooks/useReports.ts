// Reports Hooks - Custom React hooks for reports and analytics
import { useState, useEffect, useMemo } from 'react';
import { reportsService, type MonthlyFuelReport, type VehicleFuelComparison, type FuelTrend, type MonthlyTripReport, type VehicleTripSummary, type DriverTripReport, type MonthlyMaintenanceReport, type VehicleMaintenanceComparison, type CostPerKm, type MonthlyCostTrend, type StaffCommissionSummary, type StaffItemStatistics, type StaffItemDetail, type MonthlyDeliveryReportRow, type DeliverySummaryByStoreRow } from '../services/reportsService';

// Re-export types for convenience
export type {
  MonthlyFuelReport,
  VehicleFuelComparison,
  FuelTrend,
  MonthlyTripReport,
  VehicleTripSummary,
  DriverTripReport,
  MonthlyMaintenanceReport,
  VehicleMaintenanceComparison,
  CostPerKm,
  MonthlyCostTrend,
  StaffCommissionSummary,
  StaffItemStatistics,
  StaffItemDetail,
  MonthlyDeliveryReportRow,
};

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

// Cost Analysis Hooks
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

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: options?.startDate?.getTime(),
      end: options?.endDate?.getTime(),
      branch: options?.branch,
      limit: options?.limit,
    });
  }, [options?.startDate?.getTime(), options?.endDate?.getTime(), options?.branch, options?.limit]);

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

  const dependencyKey = useMemo(() => {
    return JSON.stringify({
      start: options?.startDate?.getTime(),
      end: options?.endDate?.getTime(),
      branch: options?.branch,
    });
  }, [options?.startDate?.getTime(), options?.endDate?.getTime(), options?.branch]);

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
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useDeliverySummaryByStore = (
  startDate?: Date,
  endDate?: Date,
  storeId?: string
) => {
  const [data, setData] = useState<DeliverySummaryByStoreRow[]>([]);
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
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useMonthlyDeliveryReport = (months: number = 6) => {
  const [data, setData] = useState<MonthlyDeliveryReportRow[]>([]);
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
  }, [dependencyKey]);

  return { data, loading, error };
};

export const useStaffItemStatistics = (
  startDate?: Date,
  endDate?: Date
) => {
  const [data, setData] = useState<StaffItemStatistics[]>([]);
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
      staff: staffId,
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
    if (!storeId || !productId) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
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
  }, [dependencyKey]);

  return { data, loading, error };
};

/**
 * Hook to refresh delivery stats by vehicle
 * ใช้สำหรับ refresh ข้อมูลสรุปการส่งสินค้าตามรถ
 */
export const useRefreshDeliveryStats = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async (startDate?: Date, endDate?: Date): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await reportsService.refreshDeliveryStatsByVehicle(startDate, endDate);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('[useRefreshDeliveryStats] Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { refresh, loading, error };
};
