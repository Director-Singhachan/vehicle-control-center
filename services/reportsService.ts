// Reports Service - Re-export hub (all report domains)
import { fuelReportService } from './reports/fuelReportService';
import { tripSummaryService } from './reports/tripSummaryService';
import { productReportService } from './reports/productReportService';
import { deliveryReportService } from './reports/deliveryReportService';

// Re-export types from split services
export type { Financials, MonthlyFuelReport, VehicleFuelComparison, FuelTrend } from './reports/fuelReportService';
export type { MonthlyTripReport, VehicleTripSummary, DriverTripReport } from './reports/tripSummaryService';
export type {
  MaintenanceTrends,
  MonthlyMaintenanceReport,
  VehicleMaintenanceComparison,
  VehicleMaintenanceHistory,
  CostAnalysis,
  CostPerKm,
  MonthlyCostTrend,
} from './reports/productReportService';
export type {
  StaffCommissionSummary,
  StaffItemStatistics,
  StaffItemDetail,
  MonthlyDeliveryReportRow,
  DeliverySummaryByStoreRow,
} from './reports/deliveryReportService';

export const reportsService = {
  ...fuelReportService,
  ...tripSummaryService,
  ...productReportService,
  ...deliveryReportService,
};
