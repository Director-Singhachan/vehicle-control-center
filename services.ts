// Mock services to simulate backend data

export interface Vehicle {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'idle';
  lat: number;
  lng: number;
  fuelLevel: number;
}

export const vehicleService = {
  getSummary: async () => ({
    total: 142,
    active: 98,
    maintenance: 12,
    idle: 32
  }),
  getLocations: async (): Promise<Vehicle[]> => [
    { id: 'v1', name: 'Truck A-101', status: 'active', lat: 40.7128, lng: -74.0060, fuelLevel: 75 },
    { id: 'v2', name: 'Van B-205', status: 'active', lat: 40.7282, lng: -73.9942, fuelLevel: 42 },
    { id: 'v3', name: 'Truck A-105', status: 'maintenance', lat: 40.7484, lng: -73.9857, fuelLevel: 10 },
    { id: 'v4', name: 'Sedan S-001', status: 'idle', lat: 40.7589, lng: -73.9733, fuelLevel: 90 },
    { id: 'v5', name: 'Truck C-404', status: 'active', lat: 40.7000, lng: -74.0100, fuelLevel: 60 },
  ]
};

export const ticketService = {
  getUrgentCount: async () => 5,
  getRecentTickets: async () => [
    { id: 1, vehicle: 'Truck A-105', issue: 'Brake pad replacement', priority: 'High' },
    { id: 2, vehicle: 'Van B-205', issue: 'Oil change due', priority: 'Medium' },
  ]
};

export const vehicleUsageService = {
  getDailyUsage: async () => ({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [65, 78, 72, 85, 90, 45, 40]
  })
};

export const reportsService = {
  getFinancials: async () => ({
    todayRevenue: 12500,
    todayCost: 3200,
    revenueTrend: 5.4, // percent
    costTrend: -1.2 // percent
  }),
  getMaintenanceTrends: async () => ({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    costs: [4000, 3000, 5500, 3200, 4800, 3100],
    incidents: [12, 8, 15, 9, 11, 7]
  })
};