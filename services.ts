// Services - Export all service modules
// This file re-exports services for backward compatibility

// Vehicle Service
export { vehicleService, type VehicleSummary, type VehicleForMap } from './services/vehicleService';

// Ticket Service
export { ticketService, type TicketCost } from './services/ticketService';

// Usage Service
export { usageService, type DailyUsageData } from './services/usageService';

// Fuel Service
export { fuelService } from './services/fuelService';

// Maintenance Service
export { maintenanceService } from './services/maintenanceService';

// Alert Service
export { alertService } from './services/alertService';

// Reports Service
export { reportsService, type Financials, type MaintenanceTrends } from './services/reportsService';

// Profile Service
export { profileService } from './services/profileService';

// Legacy Vehicle interface for backward compatibility
export interface Vehicle {
  id: string;
  plate: string;
  make?: string;
  model?: string;
  status: 'active' | 'maintenance' | 'idle';
  lat?: number;
  lng?: number;
  fuelLevel?: number;
}

// Legacy vehicleUsageService alias - import first then re-export
import { usageService } from './services/usageService';
export const vehicleUsageService = usageService;