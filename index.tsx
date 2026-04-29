import React, { useState, useEffect, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import {
  LayoutDashboard,
  Truck,
  Wrench,
  FileText,
  Settings,
  Menu,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Shield,
  CheckSquare,
  Route,
  Droplet,
  Calendar,
  Package,
  Users,
  DollarSign,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ClipboardList,
  Boxes,
  Database,
  Upload,
  UserCog,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
// Lazy load views เพื่อลด initial bundle และให้หน้าแรกโหลดเร็วขึ้น
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const ProfileView = lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const DatabaseExplorerView = lazy(() => import('./views/DatabaseExplorerView').then(m => ({ default: m.DatabaseExplorerView })));
const VehiclesView = lazy(() => import('./views/VehiclesView').then(m => ({ default: m.VehiclesView })));
const VehicleDetailView = lazy(() => import('./views/VehicleDetailView').then(m => ({ default: m.VehicleDetailView })));
const VehicleFormView = lazy(() => import('./views/VehicleFormView').then(m => ({ default: m.VehicleFormView })));
const TicketsView = lazy(() => import('./views/TicketsView').then(m => ({ default: m.TicketsView })));
const TicketDetailView = lazy(() => import('./views/TicketDetailView').then(m => ({ default: m.TicketDetailView })));
const TicketFormView = lazy(() => import('./views/TicketFormView').then(m => ({ default: m.TicketFormView })));
const ApprovalBoardView = lazy(() => import('./views/ApprovalBoardView').then(m => ({ default: m.ApprovalBoardView })));
const TripLogFormView = lazy(() => import('./views/TripLogFormView').then(m => ({ default: m.TripLogFormView })));
const TripLogListView = lazy(() => import('./views/TripLogListView').then(m => ({ default: m.TripLogListView })));
const FuelLogFormView = lazy(() => import('./views/FuelLogFormView').then(m => ({ default: m.FuelLogFormView })));
const FuelLogListView = lazy(() => import('./views/FuelLogListView').then(m => ({ default: m.FuelLogListView })));
const ReportsView = lazy(() => import('./views/ReportsView').then(m => ({ default: m.ReportsView })));
const DailySummaryView = lazy(() => import('./views/DailySummaryView').then(m => ({ default: m.DailySummaryView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const DeliveryTripListView = lazy(() => import('./views/DeliveryTripListView').then(m => ({ default: m.DeliveryTripListView })));
const DeliveryTripFormView = lazy(() => import('./views/DeliveryTripFormView').then(m => ({ default: m.DeliveryTripFormView })));
const DeliveryTripDetailView = lazy(() => import('./views/DeliveryTripDetailView').then(m => ({ default: m.DeliveryTripDetailView })));
const TripMetricsView = lazy(() => import('./views/TripMetricsView').then(m => ({ default: m.TripMetricsView })));
const StoreDeliveryDetailView = lazy(() => import('./views/StoreDeliveryDetailView').then(m => ({ default: m.StoreDeliveryDetailView })));
const ServiceStaffManagementView = lazy(() => import('./views/ServiceStaffManagementView').then(m => ({ default: m.ServiceStaffManagementView })));
const AdminStaffManagementView = lazy(() => import('./views/AdminStaffManagementView').then(m => ({ default: m.AdminStaffManagementView })));
const StaffVehicleUsageView = lazy(() => import('./views/StaffVehicleUsageView').then(m => ({ default: m.StaffVehicleUsageView })));
const CommissionManagementView = lazy(() => import('./views/CommissionManagementView').then(m => ({ default: m.CommissionManagementView })));
const CommissionRatesView = lazy(() => import('./views/CommissionRatesView').then(m => ({ default: m.CommissionRatesView })));
const RoleFeatureAccessSettingsView = lazy(() =>
  import('./views/RoleFeatureAccessSettingsView').then(m => ({ default: m.RoleFeatureAccessSettingsView })),
);
const StockDashboardView = lazy(() => import('./views/StockDashboardView').then(m => ({ default: m.StockDashboardView })));
const ProductsManagementView = lazy(() => import('./views/ProductsManagementView').then(m => ({ default: m.ProductsManagementView })));
const WarehouseManagementView = lazy(() => import('./views/WarehouseManagementView').then(m => ({ default: m.WarehouseManagementView })));
const CustomerTiersManagementView = lazy(() => import('./views/CustomerTiersManagementView').then(m => ({ default: m.CustomerTiersManagementView })));
const ProductTierPricingView = lazy(() => import('./views/ProductTierPricingView').then(m => ({ default: m.ProductTierPricingView })));
const InventoryReceiptsView = lazy(() => import('./views/InventoryReceiptsView').then(m => ({ default: m.InventoryReceiptsView })));
const PurchaseReceiptsManageView = lazy(() =>
  import('./views/PurchaseReceiptsManageView').then(m => ({ default: m.PurchaseReceiptsManageView })),
);

const ConfirmOrderView = lazy(() => import('./views/ConfirmOrderView').then(m => ({ default: m.ConfirmOrderView })));
const CreateOrderView = lazy(() => import('./views/CreateOrderView').then(m => ({ default: m.CreateOrderView })));
const CustomerManagementView = lazy(() => import('./views/CustomerManagementView').then(m => ({ default: m.CustomerManagementView })));
const PendingOrdersView = lazy(() => import('./views/PendingOrdersView').then(m => ({ default: m.PendingOrdersView })));
const PendingSalesView = lazy(() => import('./views/PendingSalesView').then(m => ({ default: m.PendingSalesView })));
const PartialDeliveryOrdersView = lazy(() => import('./views/PartialDeliveryOrdersView').then(m => ({ default: m.PartialDeliveryOrdersView })));

const TrackOrdersView = lazy(() => import('./views/TrackOrdersView').then(m => ({ default: m.TrackOrdersView })));
const SalesTripsView = lazy(() => import('./views/SalesTripsView').then(m => ({ default: m.SalesTripsView })));
const CleanupTestOrdersView = lazy(() => import('./views/CleanupTestOrdersView').then(m => ({ default: m.CleanupTestOrdersView })));
const PackingSimulationView = lazy(() => import('./views/PackingSimulationView').then(m => ({ default: m.PackingSimulationView })));
const ExcelImportView = lazy(() => import('./views/ExcelImportView').then(m => ({ default: m.ExcelImportView })));
const CustomerImportView = lazy(() => import('./views/CustomerImportView').then(m => ({ default: m.CustomerImportView })));
const TripPlanningBoardView = lazy(() => import('./views/TripPlanningBoardView').then(m => ({ default: m.TripPlanningBoardView })));
import { ProtectedRoute } from './components/ProtectedRoute';
import { FeatureAccessProvider, useFeatureAccess } from './hooks/useFeatureAccess';
import { firstAccessibleTabId, NAV_FALLBACK_TAB_ORDER, TAB_TO_PRIMARY_FEATURE } from './types/featureAccess';
import { useAuth, usePendingTickets, usePartialDeliveryQueueCount, usePendingOrdersQueueCount } from './hooks';
import { usePendingBillingTrips } from './hooks/usePendingBillingTrips';
import { ticketService, type TicketWithRelations } from './services/ticketService';
import { prefetchService } from './services/prefetchService';
import { Avatar } from './components/ui/Avatar';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useActivityTicker } from './hooks/useActivityTicker';
import { HeaderActivityTicker } from './components/layout/HeaderActivityTicker';
import { DebugDataProvider } from './context/DebugDataContext';
import { DebugTools } from './components/debug/DebugTools';
import { useDebugStore } from './stores/debugStore';

const SidebarItem = ({ icon: Icon, label, active, onClick, onMouseEnter, isCollapsed, hasSubmenu, isOpen, isWarning, badgeCount }: any) => (
  <button
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg transition-colors duration-200 ${active
      ? 'bg-enterprise-50 text-enterprise-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
      : 'text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
      }`}
  >
    <div className="relative">
      <Icon size={isCollapsed ? 24 : 20} />
      {isWarning && isCollapsed && (
        <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-sm">
          <AlertTriangle size={10} className="text-amber-500 fill-amber-500/20" />
        </div>
      )}
      {!isWarning && isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[10px] h-[10px] rounded-full bg-orange-500 dark:bg-orange-500 border-2 border-white dark:border-charcoal-900"
          title={`งานคิวออเดอร์ ${badgeCount} รายการ (รอจัดทริป + แบ่งส่งค้างจัด)`}
          aria-hidden
        />
      )}
    </div>
    {!isCollapsed && (
      <span className={`flex-1 text-left ${isWarning ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}>
        {label}
      </span>
    )}
    {!isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
      <span
        className="ml-1 flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 dark:bg-orange-500 text-white text-[10px] font-bold leading-none"
        title={`งานคิวออเดอร์ ${badgeCount} รายการ (รอจัดทริป + แบ่งส่งค้างจัด)`}
      >
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
    {!isCollapsed && isWarning && (
      <AlertTriangle size={14} className="text-amber-500 fill-amber-500/20 animate-pulse" />
    )}
    {!isCollapsed && hasSubmenu && (
      isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
    )}
  </button>
);

const SubSidebarItem = ({ label, active, onClick, isCollapsed, isFlyout, isWarning, badgeCount }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${isFlyout ? 'px-4' : 'pl-12 pr-4'} py-2 rounded-lg transition-colors duration-200 ${active
      ? 'text-enterprise-600 dark:text-blue-400 font-medium bg-enterprise-50 dark:bg-blue-900/30'
      : 'text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
      }`}
  >
    {!isCollapsed && (
      <span className={`text-sm whitespace-nowrap flex-1 text-left ${isWarning ? 'text-amber-600 dark:text-amber-400 font-semibold italic' : ''}`}>
        {label}
      </span>
    )}
    {!isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
      <span
        className="ml-2 flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 dark:bg-orange-500 text-white text-[10px] font-bold leading-none"
        title={`${badgeCount} รายการ`}
      >
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
    {!isCollapsed && isWarning && (
      <AlertTriangle size={12} className="text-amber-500 ml-2" />
    )}
  </button>
);

const MaintenanceView = ({ isDev, onReset, featureName, onContact, onBypass }: { isDev?: boolean, onReset?: () => void, featureName?: string, onContact?: () => void, onBypass?: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-charcoal-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl max-w-2xl mx-auto my-12 animate-in zoom-in-95 duration-300">
    <div className="relative mb-8">
      <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 animate-pulse"></div>
      <div className="relative p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border-2 border-amber-100 dark:border-amber-800/50">
        <AlertTriangle size={64} className="text-amber-500" />
      </div>
      <div className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800">
        <Wrench size={16} className="text-slate-400" />
      </div>
    </div>

    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
      {isDev || featureName ? "ปิดการเข้าถึงชั่วคราว" : "กำลังปรับปรุงระบบ"}
    </h2>

    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 text-lg">
      {isDev || featureName
        ? "หน้านี้มีสถานะการเข้าถึงที่ถูก Force Disabled โดยทีมนักพัฒนาอยู่ (Development / Testing Mode) คุณสามารถเปิดใช้งานใหม่ได้ผ่าน Debug Control Center"
        : "ขออภัยในความไม่สะดวก ฟีเจอร์นี้กำลังอยู่ในช่วงการปรับปรุงและพัฒนาชุดใหม่ เพื่อประสิทธิภาพที่ดียิ่งขึ้น โปรดรอติดตามในเวอร์ชันถัดไป"}
    </p>

    {(isDev || featureName) && (
      <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
        <button
          onClick={onReset || onContact}
          className="px-8 py-3 bg-enterprise-600 hover:bg-enterprise-700 text-white rounded-2xl font-bold shadow-lg shadow-enterprise-600/30 transition-all active:scale-95 flex items-center justify-center space-x-2"
        >
          <Settings size={18} />
          <span>จัดการ Feature Flags</span>
        </button>
        {isDev && onBypass && (
          <button
            onClick={onBypass}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-amber-500 rounded-2xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 border border-amber-500/30"
          >
            <ShieldAlert size={18} />
            <span>Bypass Block (Dev Mode)</span>
          </button>
        )}
      </div>
    )}

    {!(isDev || featureName) && (
      <div className="flex items-center space-x-2 text-slate-400 mt-4">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-sm font-medium">ทีมวิศวกรกำลังดำเนินการพัฒนาระบบ</span>
      </div>
    )}
  </div>
);

const MenuSectionHeader = ({ label }: { label: string }) => (
  <div className="px-4 py-2 mt-2 mb-1">
    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
      {label}
    </p>
    <div className="h-px bg-slate-100 dark:bg-slate-800 mt-1"></div>
  </div>
);

// Main App Content (wrapped in ProtectedRoute)
const AppContent = () => {
  const { user, profile, signOut, isAdmin, isManager, isInspector, isExecutive, isDriver, isSales, isHR, isWarehouse, isDev, isRealDev, overriddenRole, loading: authLoading, refreshProfile } = useAuth();
  const { can, canAccessTab, loading: featureAccessLoading } = useFeatureAccess();
  const { featureOverrides, setPanelTab } = useDebugStore();
  const [devBypassedFeatures, setDevBypassedFeatures] = useState<string[]>([]);
  const showHrMenu =
    can('tab.admin_staff', 'view') ||
    can('tab.service_staff', 'view') ||
    can('tab.commission', 'view') ||
    can('tab.commission_rates', 'view');

  /** เมนูฝ่ายขาย: อย่าใช้แค่ !isDriver — ต้องมีสิทธิ์ฟีเจอร์อย่างน้อยหนึ่งรายการ (ยกเว้น isSales ที่อาจมีแค่ confirm_orders) */
  const showSalesNavGroup = React.useMemo(() => {
    const salesExtras =
      can('tab.create_order', 'view') ||
      can('tab.track_orders', 'view') ||
      can('tab.sales_trips', 'view') ||
      can('tab.customers', 'view') ||
      can('tab.cleanup_test_orders', 'view') ||
      can('tab.products', 'view') ||
      can('tab.product_pricing', 'view') ||
      can('tab.customer_tiers', 'view');
    if (isDriver && !isSales) return false;
    if (!isDriver || isSales) {
      return isSales ? salesExtras || can('tab.confirm_orders', 'view') : salesExtras;
    }
    return false;
  }, [isDriver, isSales, can]);

  const showStockNavGroup = React.useMemo(() => {
    if (isDriver) return false;
    return (
      can('tab.stock_dashboard', 'view') ||
      can('tab.confirm_orders', 'view') ||
      can('tab.warehouses', 'view') ||
      can('tab.inventory_receipts', 'view') ||
      can('tab.purchase_receipts', 'view')
    );
  }, [isDriver, can]);

  /** ฝ่ายขายที่ได้รับสิทธิ์เมนูขนส่ง/รถ จาก matrix — แสดงกลุ่ม "ฝ่ายขนส่ง" ได้ */
  const salesHasLogisticsMenu = React.useMemo(() => {
    if (!isSales) return false;
    return (
      can('tab.dashboard', 'view') ||
      can('tab.vehicles', 'view') ||
      can('tab.maintenance', 'view') ||
      can('tab.triplogs', 'view') ||
      can('tab.fuellogs', 'view') ||
      can('tab.approvals', 'view') ||
      can('tab.daily_summary', 'view') ||
      can('tab.delivery_trips', 'view') ||
      can('tab.packing_simulation', 'view') ||
      can('tab.pending_orders', 'view')
    );
  }, [isSales, can]);

  // Don't wait for profile - show UI immediately if user exists
  // Profile will load in background and update when ready
  const { count: pendingTicketsCount } = usePendingTickets();
  const { count: pendingBillingTripsCount, trips: pendingBillingTrips } = usePendingBillingTrips();
  const canSeePartialDeliveryQueue = !isDriver && can('tab.pending_orders', 'view');
  const { count: partialDeliveryQueueCount, refetch: refetchPartialDeliveryQueueCount } =
    usePartialDeliveryQueueCount(canSeePartialDeliveryQueue);
  const { count: pendingOrdersQueueCount, refetch: refetchPendingOrdersQueueCount } =
    usePendingOrdersQueueCount(canSeePartialDeliveryQueue);

  const logisticsOrdersAttentionCount = partialDeliveryQueueCount + pendingOrdersQueueCount;

  // Combine counts for notification badge
  const pendingCount = isSales ? pendingBillingTripsCount : pendingTicketsCount;
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth >= 1024;
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 1024;
  });
  // Set initial tab based on user role
  const [activeTab, setActiveTab] = useState(() => {
    // Drivers should start at triplogs page
    // We'll check this in useEffect after profile loads
    return 'dashboard';
  });

  // State declarations for tickets - must be before useEffect that uses them
  const [ticketView, setTicketView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const isNavigatingToTicketRef = React.useRef(false);

  // Track previous activeTab to detect tab changes
  const prevActiveTabRef = React.useRef(activeTab);

  // รีเฟรชจำนวนคิวเมื่อเปิดหน้า (ให้ badge ตรงกับรายการหลังจัดทริป)
  useEffect(() => {
    if (!canSeePartialDeliveryQueue) return;
    if (activeTab === 'partial-delivery') void refetchPartialDeliveryQueueCount();
    if (activeTab === 'pending-orders') void refetchPendingOrdersQueueCount();
  }, [
    activeTab,
    canSeePartialDeliveryQueue,
    refetchPartialDeliveryQueueCount,
    refetchPendingOrdersQueueCount,
  ]);

  // Reset ticketView to 'list' when switching to maintenance tab
  // This ensures we always start with the list view when opening maintenance tab
  // BUT only if we're not navigating to a specific ticket
  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;

    // If we're navigating to a ticket, skip the reset
    if (isNavigatingToTicketRef.current) {
      isNavigatingToTicketRef.current = false;
      return;
    }

    // Only reset if we're switching TO maintenance tab from a different tab
    // AND we don't have a selectedTicketId (meaning we're not navigating to a specific ticket)
    if (activeTab === 'maintenance' && prevTab !== 'maintenance') {
      // Don't reset if we have a selectedTicketId - this means we're navigating to a specific ticket
      if (!selectedTicketId && ticketView !== 'list') {
        console.log('[AppContent] Resetting ticketView to list (switched to maintenance tab)');
        setTicketView('list');
        setSelectedTicketId(null);
      }
    } else if (activeTab !== 'maintenance' && prevTab === 'maintenance') {
      // Reset when switching away from maintenance
      if (ticketView !== 'list') {
        console.log('[AppContent] Resetting ticketView to list (switched away from maintenance)');
        setTicketView('list');
        setSelectedTicketId(null);
      }
    }
  }, [activeTab, selectedTicketId, ticketView]); // Include selectedTicketId to prevent reset when navigating to ticket

  // Track viewport width to tailor driver experience on mobile
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Collapse sidebar automatically on smaller screens for full-width forms
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // State declarations - must be before useEffect that uses them
  const [vehicleView, setVehicleView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Fix: Reset vehicleView to 'list' if it's 'detail' but no selectedVehicleId
  // Use useLayoutEffect to fix before render to prevent flickering
  React.useLayoutEffect(() => {
    if (vehicleView === 'detail' && !selectedVehicleId) {
      console.log('[AppContent] ⚠️ Fixing: vehicleView is detail but no selectedVehicleId - resetting to list');
      setVehicleView('list');
    }
  }, [vehicleView, selectedVehicleId]);

  const [tripLogView, setTripLogView] = useState<'list' | 'form'>('list');
  const [fuelLogView, setFuelLogView] = useState<'list' | 'form'>('list');
  const [tripLogMode, setTripLogMode] = useState<'checkout' | 'checkin'>('checkout');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isCommissionOpen, setIsCommissionOpen] = useState(false);
  const [isCommissionHovered, setIsCommissionHovered] = useState(false);
  const commissionMenuRef = React.useRef<HTMLDivElement>(null);

  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isOrdersHovered, setIsOrdersHovered] = useState(false);
  const ordersMenuRef = React.useRef<HTMLDivElement>(null);

  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isStockHovered, setIsStockHovered] = useState(false);
  const stockMenuRef = React.useRef<HTMLDivElement>(null);

  const [isTripsOpen, setIsTripsOpen] = useState(false);
  const [isTripsHovered, setIsTripsHovered] = useState(false);
  const tripsMenuRef = React.useRef<HTMLDivElement>(null);

  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [isLogisticsHovered, setIsLogisticsHovered] = useState(false);
  const logisticsMenuRef = React.useRef<HTMLDivElement>(null);
  const logisticsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [logisticsFlyoutPosition, setLogisticsFlyoutPosition] = useState({ top: 0, left: 0 });
  const [logisticsFlyoutMaxHeight, setLogisticsFlyoutMaxHeight] = useState<number>(400);

  const [isHRHovered, setIsHRHovered] = useState(false);
  const hrMenuRef = React.useRef<HTMLDivElement>(null);
  const hrTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [hrFlyoutPosition, setHRFlyoutPosition] = useState({ top: 0, left: 0 });
  const [hrFlyoutMaxHeight, setHRFlyoutMaxHeight] = useState<number>(400);

  const commissionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });

  // Settings menu state
  const [isSettingsHovered, setIsSettingsHovered] = useState(false);
  const settingsMenuRef = React.useRef<HTMLDivElement>(null);
  const settingsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [settingsFlyoutPosition, setSettingsFlyoutPosition] = useState({ top: 0, left: 0 });

  // Mobile inline submenu expansion states
  const [mobileOrdersExpanded, setMobileOrdersExpanded] = useState(false);
  const [mobileStockExpanded, setMobileStockExpanded] = useState(false);
  const [mobileLogisticsExpanded, setMobileLogisticsExpanded] = useState(false);
  const [mobileHRExpanded, setMobileHRExpanded] = useState(false);
  const [mobileSettingsExpanded, setMobileSettingsExpanded] = useState(false);

  const navigateAndCloseMobile = (tab: string, extra?: () => void) => {
    setActiveTab(tab);
    extra?.();
    if (isMobile) {
      setSidebarOpen(false);
      setMobileOrdersExpanded(false);
      setMobileStockExpanded(false);
      setMobileLogisticsExpanded(false);
      setMobileHRExpanded(false);
      setMobileSettingsExpanded(false);
    }
  };

  // Import menu handlers
  const [isImportHovered, setIsImportHovered] = useState(false);
  const importMenuRef = React.useRef<HTMLDivElement>(null);
  const importTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [importFlyoutPosition, setImportFlyoutPosition] = useState({ top: 0, left: 0 });

  const handleImportMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (importTimeoutRef.current) {
      clearTimeout(importTimeoutRef.current);
      importTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const estimatedHeight = 220;
    const margin = 12;

    let top = rect.top;
    const maxTop = viewportHeight - estimatedHeight - margin;
    if (top > maxTop) {
      top = Math.max(margin, maxTop);
    }

    setImportFlyoutPosition({
      top,
      left: rect.right + 8,
    });

    setIsImportHovered(true);
  };

  const handleImportMouseLeave = () => {
    if (isMobile) return;
    importTimeoutRef.current = setTimeout(() => {
      setIsImportHovered(false);
    }, 150);
  };

  const handleImportFlyoutMouseEnter = () => {
    if (importTimeoutRef.current) {
      clearTimeout(importTimeoutRef.current);
      importTimeoutRef.current = null;
    }
    setIsImportHovered(true);
  };

  const handleImportFlyoutMouseLeave = () => {
    importTimeoutRef.current = setTimeout(() => {
      setIsImportHovered(false);
      setHoveredImportDept(null);
    }, 150);
  };

  // Level 2 Import Flyout handlers
  const [hoveredImportDept, setHoveredImportDept] = useState<string | null>(null);
  const [importDeptFlyoutPosition, setImportDeptFlyoutPosition] = useState({ top: 0, left: 0 });
  const importDeptTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleImportDeptMouseEnter = (e: React.MouseEvent, dept: string) => {
    if (importDeptTimeoutRef.current) {
      clearTimeout(importDeptTimeoutRef.current);
      importDeptTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setImportDeptFlyoutPosition({
      top: rect.top - 8,
      left: rect.right + 4,
    });
    setHoveredImportDept(dept);
  };

  const handleImportDeptMouseLeave = () => {
    importDeptTimeoutRef.current = setTimeout(() => {
      setHoveredImportDept(null);
    }, 150);
  };

  const handleImportDeptFlyoutMouseEnter = () => {
    if (importDeptTimeoutRef.current) {
      clearTimeout(importDeptTimeoutRef.current);
      importDeptTimeoutRef.current = null;
    }
    // Prevent Level 1 from closing while in Level 2
    if (importTimeoutRef.current) {
      clearTimeout(importTimeoutRef.current);
      importTimeoutRef.current = null;
    }
    setIsImportHovered(true);
  };

  const handleImportDeptFlyoutMouseLeave = () => {
    // Both levels should close if we leave Level 2 and don't enter Level 1
    importDeptTimeoutRef.current = setTimeout(() => {
      setHoveredImportDept(null);
    }, 150);

    importTimeoutRef.current = setTimeout(() => {
      setIsImportHovered(false);
    }, 150);
  };

  // Calculate flyout position when hovering
  const handleCommissionMouseEnter = (e: React.MouseEvent) => {
    // Clear any pending close timeout
    if (commissionTimeoutRef.current) {
      clearTimeout(commissionTimeoutRef.current);
      commissionTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const flyoutEstimatedHeight = 200; // Estimated height of flyout menu

    // Check if flyout will overflow bottom of viewport
    let topPosition = rect.top;
    if (rect.top + flyoutEstimatedHeight > viewportHeight) {
      // Position flyout so it ends at the bottom with some margin
      topPosition = Math.max(10, viewportHeight - flyoutEstimatedHeight - 10);
    }

    setFlyoutPosition({
      top: topPosition,
      left: rect.right + 8,
    });
    setIsCommissionHovered(true);
  };

  const handleCommissionMouseLeave = () => {
    // Delay closing to allow mouse to move to flyout
    commissionTimeoutRef.current = setTimeout(() => {
      setIsCommissionHovered(false);
    }, 150);
  };

  const handleFlyoutMouseEnter = () => {
    // Cancel close timeout when mouse enters flyout
    if (commissionTimeoutRef.current) {
      clearTimeout(commissionTimeoutRef.current);
      commissionTimeoutRef.current = null;
    }
    setIsCommissionHovered(true);
  };

  const handleFlyoutMouseLeave = () => {
    // Close immediately when leaving flyout
    setIsCommissionHovered(false);
  };

  // Orders menu handlers
  const [ordersFlyoutPosition, setOrdersFlyoutPosition] = useState({ top: 0, left: 0 });
  const ordersTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleOrdersMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (ordersTimeoutRef.current) {
      clearTimeout(ordersTimeoutRef.current);
      ordersTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // ประเมินความสูงของเมนูฝ่ายขายให้เผื่อเคสที่มีหลายเมนู (เช่น เพิ่ม "จัดการลูกค้า")
    // แล้วบังคับไม่ให้เกินขอบล่างของหน้าจอ เพื่อให้เมนูล่างสุดยังมองเห็นได้
    const estimatedHeight = 380; // สูงกว่าเดิมเล็กน้อยเผื่อหลายเมนู
    const margin = 12;

    // เริ่มจากยึด top ตามปุ่มเมนูใน sidebar
    let top = rect.top;

    // ถ้าเมนูจะล้นด้านล่าง ให้ขยับขึ้น แต่ไม่ให้ล้นด้านบน
    const maxTop = viewportHeight - estimatedHeight - margin;
    if (top > maxTop) {
      top = Math.max(margin, maxTop);
    }

    setOrdersFlyoutPosition({
      top,
      left: rect.right + 8,
    });

    setIsOrdersHovered(true);
  };

  const handleOrdersMouseLeave = () => {
    if (isMobile) return;
    ordersTimeoutRef.current = setTimeout(() => {
      setIsOrdersHovered(false);
    }, 150);
  };

  const handleOrdersFlyoutMouseEnter = () => {
    if (ordersTimeoutRef.current) {
      clearTimeout(ordersTimeoutRef.current);
      ordersTimeoutRef.current = null;
    }
    setIsOrdersHovered(true);
  };

  const handleOrdersFlyoutMouseLeave = () => {
    setIsOrdersHovered(false);
  };

  // Stock menu handlers
  const [stockFlyoutPosition, setStockFlyoutPosition] = useState({ top: 0, left: 0 });
  const stockTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleStockMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (stockTimeoutRef.current) {
      clearTimeout(stockTimeoutRef.current);
      stockTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const flyoutEstimatedHeight = 200;

    let top = rect.top;
    if (top + flyoutEstimatedHeight > viewportHeight - 10) {
      top = Math.max(10, viewportHeight - flyoutEstimatedHeight - 10);
    }

    setStockFlyoutPosition({
      top,
      left: rect.right + 8,
    });

    setIsStockHovered(true);
  };

  const handleStockMouseLeave = () => {
    if (isMobile) return;
    stockTimeoutRef.current = setTimeout(() => {
      setIsStockHovered(false);
    }, 150);
  };

  const handleStockFlyoutMouseEnter = () => {
    if (stockTimeoutRef.current) {
      clearTimeout(stockTimeoutRef.current);
      stockTimeoutRef.current = null;
    }
    setIsStockHovered(true);
  };

  const handleStockFlyoutMouseLeave = () => {
    setIsStockHovered(false);
  };

  // Trips menu handlers
  const [tripsFlyoutPosition, setTripsFlyoutPosition] = useState({ top: 0, left: 0 });
  const tripsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleTripsMouseEnter = (e: React.MouseEvent) => {
    if (tripsTimeoutRef.current) {
      clearTimeout(tripsTimeoutRef.current);
      tripsTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const flyoutEstimatedHeight = 150;

    let top = rect.top;
    if (top + flyoutEstimatedHeight > viewportHeight - 10) {
      top = Math.max(10, viewportHeight - flyoutEstimatedHeight - 10);
    }

    setTripsFlyoutPosition({
      top,
      left: rect.right + 8,
    });

    setIsTripsHovered(true);
  };

  const handleTripsMouseLeave = () => {
    tripsTimeoutRef.current = setTimeout(() => {
      setIsTripsHovered(false);
    }, 150);
  };

  const handleTripsFlyoutMouseEnter = () => {
    if (tripsTimeoutRef.current) {
      clearTimeout(tripsTimeoutRef.current);
      tripsTimeoutRef.current = null;
    }
    setIsTripsHovered(true);
  };

  const handleTripsFlyoutMouseLeave = () => {
    setIsTripsHovered(false);
  };

  // Logistics menu handlers
  const handleLogisticsMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (logisticsTimeoutRef.current) {
      clearTimeout(logisticsTimeoutRef.current);
      logisticsTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const maxFlyoutHeight = Math.min(560, Math.floor(viewportHeight * 0.85) - margin);
    let top = rect.top;
    if (top + maxFlyoutHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - maxFlyoutHeight - margin);
    }
    const actualMaxHeight = viewportHeight - top - margin;
    setLogisticsFlyoutMaxHeight(actualMaxHeight);
    setLogisticsFlyoutPosition({
      top,
      left: rect.right + 8,
    });

    setIsLogisticsHovered(true);
  };

  const handleLogisticsMouseLeave = () => {
    if (isMobile) return;
    logisticsTimeoutRef.current = setTimeout(() => {
      setIsLogisticsHovered(false);
    }, 150);
  };

  const handleLogisticsFlyoutMouseEnter = () => {
    if (logisticsTimeoutRef.current) {
      clearTimeout(logisticsTimeoutRef.current);
      logisticsTimeoutRef.current = null;
    }
    setIsLogisticsHovered(true);
  };

  const handleLogisticsFlyoutMouseLeave = () => {
    setIsLogisticsHovered(false);
  };

  // HR menu handlers
  const handleHRMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (hrTimeoutRef.current) {
      clearTimeout(hrTimeoutRef.current);
      hrTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const maxFlyoutHeight = Math.min(400, Math.floor(viewportHeight * 0.75) - margin);
    let top = rect.top;
    if (top + maxFlyoutHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - maxFlyoutHeight - margin);
    }
    setHRFlyoutMaxHeight(viewportHeight - top - margin);
    setHRFlyoutPosition({ top, left: rect.right + 8 });
    setIsHRHovered(true);
  };

  const handleHRMouseLeave = () => {
    if (isMobile) return;
    hrTimeoutRef.current = setTimeout(() => {
      setIsHRHovered(false);
    }, 150);
  };

  const handleHRFlyoutMouseEnter = () => {
    if (hrTimeoutRef.current) {
      clearTimeout(hrTimeoutRef.current);
      hrTimeoutRef.current = null;
    }
    setIsHRHovered(true);
  };

  const handleHRFlyoutMouseLeave = () => {
    setIsHRHovered(false);
  };

  // Settings menu handlers
  const handleSettingsMouseEnter = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const flyoutEstimatedHeight = 250;

    let topPosition = rect.top;
    if (rect.top + flyoutEstimatedHeight > viewportHeight) {
      topPosition = Math.max(10, viewportHeight - flyoutEstimatedHeight - 10);
    }

    setSettingsFlyoutPosition({
      top: topPosition,
      left: rect.right + 8,
    });
    setIsSettingsHovered(true);
  };

  const handleSettingsMouseLeave = () => {
    if (isMobile) return;
    settingsTimeoutRef.current = setTimeout(() => {
      setIsSettingsHovered(false);
    }, 150);
  };

  const handleSettingsFlyoutMouseEnter = () => {
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
    setIsSettingsHovered(true);
  };

  const handleSettingsFlyoutMouseLeave = () => {
    setIsSettingsHovered(false);
  };

  // Open commission menu if one of its sub-items is active
  useEffect(() => {
    // ปิด accordion ย่อยทั้งหมด ใช้ hover flyout อย่างเดียว
    setIsCommissionOpen(false);
    setIsOrdersOpen(false);
    setIsStockOpen(false);
    setIsTripsOpen(false);
    setIsLogisticsOpen(false);
  }, [activeTab]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (commissionTimeoutRef.current) {
        clearTimeout(commissionTimeoutRef.current);
      }
      if (settingsTimeoutRef.current) {
        clearTimeout(settingsTimeoutRef.current);
      }
      if (logisticsTimeoutRef.current) {
        clearTimeout(logisticsTimeoutRef.current);
      }
      if (importDeptTimeoutRef.current) {
        clearTimeout(importDeptTimeoutRef.current);
      }
    };
  }, []);
  const [deliveryTripView, setDeliveryTripView] = useState<'list' | 'form' | 'detail' | 'metrics'>('list');
  const [selectedDeliveryTripId, setSelectedDeliveryTripId] = useState<string | null>(null);
  const [deliveryTripReturnContext, setDeliveryTripReturnContext] = useState<
    'delivery-list' | 'triplogs' | 'daily-summary' | 'vehicles' | 'service-staff-usage' | 'reports'
  >('delivery-list');
  const [reportsInitialTab, setReportsInitialTab] = useState<'trip-pnl' | null>(null);
  useEffect(() => {
    if (activeTab !== 'reports') setReportsInitialTab(null);
  }, [activeTab]);
  const [storeDetailView, setStoreDetailView] = useState<'list' | 'detail'>('list');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [serviceStaffView, setServiceStaffView] = useState<'list' | 'usage'>('list');
  const [selectedServiceStaffId, setSelectedServiceStaffId] = useState<string | null>(null);
  const [serviceStaffUsageNavState, setServiceStaffUsageNavState] = useState<{
    staffId: string;
    from: string;
    to: string;
    page: number;
    scrollY: number;
  } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationItems, setNotificationItems] = useState<TicketWithRelations[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Activity ticker for the top bar
  const isHighLevel = isAdmin || isManager || isInspector || isExecutive || isDev;
  const { items: tickerItems, loading: tickerLoading } = useActivityTicker({
    branch: profile?.branch,
    isHighLevel,
  });

  // คนขับ: UX บันทึกเติมน้ำมันใช้แต่ฟอร์ม (ไม่ใช้ลิสต์)
  useEffect(() => {
    if (isDriver && activeTab === 'fuellogs' && fuelLogView === 'list') {
      setFuelLogView('form');
    }
  }, [isDriver, activeTab, fuelLogView]);

  // คนขับ: เปิดแท็บบันทึกเที่ยว → โหมดฟอร์ม (ตามเดิม)
  useEffect(() => {
    if (isDriver && activeTab === 'triplogs') {
      setTripLogView('form');
      setTripLogMode('checkout');
    }
  }, [isDriver, activeTab]);

  // หน้า RLS test ถูกถอดออก — ถ้ามี navigation state เก่า
  useEffect(() => {
    if (activeTab === 'rls-test') {
      setActiveTab('profile');
    }
  }, [activeTab]);

  // แท็บปัจจุบันไม่มีสิทธิ์ view ตาม matrix → ย้ายไปแท็บแรกที่อนุญาต (ทุก role เดียวกัน ไม่ whitelist แยก sales / service_staff / คนขับ)
  useEffect(() => {
    if (!profile || featureAccessLoading) return;
    const feature = TAB_TO_PRIMARY_FEATURE[activeTab];
    if (!feature || can(feature, 'view')) return;
    const next = firstAccessibleTabId(can, NAV_FALLBACK_TAB_ORDER);
    if (next) setActiveTab(next);
    else if (can('tab.profile', 'view')) setActiveTab('profile');
  }, [profile, activeTab, can, featureAccessLoading]);

  // โหลดครั้งแรกที่ activeTab เป็น dashboard: คนขับ/ฝ่ายขายที่ไม่ได้รับสิทธิ์แดชบอร์ดยังพาไปหน้าเริ่มตามเดิม
  useEffect(() => {
    if (!isDriver || !profile || featureAccessLoading) return;
    if (activeTab === 'dashboard' && !can('tab.dashboard', 'view')) {
      setActiveTab('triplogs');
      setTripLogView('form');
      setTripLogMode('checkout');
    }
  }, [isDriver, profile, activeTab, can, featureAccessLoading]);

  useEffect(() => {
    if (!isSales || !profile || featureAccessLoading) return;
    if (activeTab === 'dashboard' && !can('tab.dashboard', 'view')) {
      setActiveTab('create-order');
    }
  }, [isSales, profile, activeTab, can, featureAccessLoading]);

  // Force refresh profile on mount to ensure role is up to date
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

  // Load pending tickets or billing trips for notification dropdown when opened
  useEffect(() => {
    const loadNotifications = async () => {
      if (!showNotifications) return;
      if (!profile) return;

      setLoadingNotifications(true);
      try {
        // For sales role, trips are already loaded by usePendingBillingTrips hook
        // We don't need to fetch again, just set loading to false
        if (isSales) {
          setNotificationItems([]); // Clear ticket items, we'll show trips from hook instead
        } else {
          // For other roles, show pending tickets
          let statusFilter: string[] = [];
          const role = profile.role;

          if (role === 'inspector') {
            statusFilter = ['pending'];
          } else if (role === 'manager') {
            statusFilter = ['approved_inspector'];
          } else if (role === 'executive') {
            statusFilter = ['approved_manager'];
          } else {
            statusFilter = [];
          }

          if (statusFilter.length === 0) {
            setNotificationItems([]);
            return;
          }

          const { data } = await ticketService.getWithRelations({
            status: statusFilter,
            limit: 10,
          });
          setNotificationItems(data);
        }
      } catch (err) {
        console.error('[AppContent] Failed to load notification items:', err);
        setNotificationItems([]);
      } finally {
        setLoadingNotifications(false);
      }
    };

    loadNotifications();
  }, [showNotifications, profile, isSales]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside notification dropdown and bell button
      if (
        target &&
        !target.closest('[data-notification-dropdown]') &&
        !target.closest('[data-notification-bell]')
      ) {
        setShowNotifications(false);
      }
    };

    // Add event listener with a small delay to avoid immediate close when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showNotifications]);

  // Debug logging
  React.useEffect(() => {
    console.log('[AppContent] Rendered:', {
      hasUser: !!user,
      hasProfile: !!profile,
      activeTab,
      authLoading,
      role: profile?.role
    });
  }, [user, profile, activeTab, authLoading]);

  // Load navigation state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('navigationState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.activeTab) setActiveTab(state.activeTab);
        if (state.vehicleView) setVehicleView(state.vehicleView);
        if (state.selectedVehicleId) setSelectedVehicleId(state.selectedVehicleId);
        if (state.ticketView) setTicketView(state.ticketView);
        if (state.selectedTicketId) setSelectedTicketId(state.selectedTicketId);
        if (state.isDark !== undefined) setIsDark(state.isDark);
      } catch (e) {
        console.error('Failed to restore navigation state:', e);
      }
    }
  }, []);

  // Prefetch แบบกระจายเวลา เพื่อไม่ให้โหลดทุกอย่างพร้อมกัน (ลดหน่วงและกินสเปค)
  useEffect(() => {
    const t1 = setTimeout(() => prefetchService.prefetchDashboard(), 300);
    const t2 = setTimeout(() => prefetchService.prefetchVehicles(), 800);
    const t3 = setTimeout(() => prefetchService.prefetchTicketsWithRelations(), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Save navigation state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      activeTab,
      vehicleView,
      selectedVehicleId,
      ticketView,
      selectedTicketId,
      isDark
    };
    localStorage.setItem('navigationState', JSON.stringify(state));
  }, [activeTab, vehicleView, selectedVehicleId, ticketView, selectedTicketId, isDark]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const sidebarWidthClass = isMobile ? 'w-64' : (isSidebarOpen ? 'w-64' : 'w-20');
  const sidebarTransformClass = isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0';
  const contentMarginClass = isMobile ? 'ml-0' : (isSidebarOpen ? 'ml-64' : 'ml-20');

  // ไม่แสดง sidebar/content จนกว่า profile จะโหลด — ป้องกันคนขับ/ฝ่ายขายเห็นเมนูอื่นแวบแล้วหาย
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-charcoal-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-slate-400">
          <div className="w-12 h-12 border-2 border-enterprise-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-charcoal-950 flex font-sans selection:bg-enterprise-500 selection:text-white">

      {/* Sidebar */}
      <aside
        className={`${sidebarWidthClass} ${sidebarTransformClass} bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-md border-r border-slate-200 dark:border-slate-800/50 flex flex-col transition-all duration-300 fixed h-full z-30 overflow-visible ${isMobile ? 'shadow-2xl' : ''}`}
      >
        <div className="p-6 flex items-center justify-center">
          <div className="w-10 h-10 bg-enterprise-600 dark:bg-enterprise-500 rounded-lg flex items-center justify-center shadow-lg shadow-enterprise-500/30">
            <Truck className="text-white" size={24} />
          </div>
          {isSidebarOpen && (
            <div className="ml-3">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Fleet <span className="text-enterprise-600 dark:text-enterprise-400">Control</span></h1>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 px-3 space-y-1 mt-4 overflow-y-auto overflow-x-clip scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-600 [&:has(.group\/menu:hover)]:overflow-x-visible">
          {/* 1. รายงาน (Reports) */}
          {(can('tab.reports', 'view') || featureOverrides['tab.reports'] === 'off') && (
            <SidebarItem
              icon={FileText}
              label={isSidebarOpen ? "รายงาน" : ""}
              active={activeTab === 'reports'}
              onClick={() => navigateAndCloseMobile('reports')}
              isCollapsed={!isSidebarOpen}
              isWarning={featureOverrides['tab.reports'] === 'off'}
            />
          )}

          {/* 2. ฝ่ายขาย (Orders/Sales) — ต้องผ่านสิทธิ์ฟีเจอร์อย่างน้อยหนึ่งรายการ */}
          {showSalesNavGroup && (
            <>
              <div
                ref={ordersMenuRef}
                className="relative group/menu"
                onMouseEnter={handleOrdersMouseEnter}
                onMouseLeave={handleOrdersMouseLeave}
              >
                <SidebarItem
                  icon={ShoppingCart}
                  label={isSidebarOpen ? "ฝ่ายขาย" : ""}
                  active={
                    activeTab === 'create-order' ||
                    activeTab === 'confirm-orders' ||
                    activeTab === 'track-orders' ||
                    activeTab === 'sales-trips' ||
                    activeTab === 'products' ||
                    activeTab === 'product-pricing' ||
                    activeTab === 'customer-tiers' ||
                    activeTab === 'customers' ||
                    activeTab === 'cleanup-test-orders'
                  }
                  onClick={() => {
                    if (isMobile) {
                      setMobileOrdersExpanded(prev => !prev);
                    } else {
                      const first =
                        can('tab.create_order', 'view')
                          ? 'create-order'
                          : can('tab.confirm_orders', 'view')
                            ? 'confirm-orders'
                            : can('tab.track_orders', 'view')
                              ? 'track-orders'
                              : can('tab.sales_trips', 'view')
                                ? 'sales-trips'
                                : can('tab.customers', 'view')
                                  ? 'customers'
                                  : can('tab.cleanup_test_orders', 'view')
                                    ? 'cleanup-test-orders'
                                    : can('tab.products', 'view')
                                      ? 'products'
                                      : can('tab.product_pricing', 'view')
                                        ? 'product-pricing'
                                        : can('tab.customer_tiers', 'view')
                                          ? 'customer-tiers'
                                          : null;
                      if (first && activeTab !== first) setActiveTab(first);
                    }
                  }}
                  isCollapsed={!isSidebarOpen}
                  hasSubmenu={true}
                  isOpen={isMobile ? mobileOrdersExpanded : isOrdersHovered}
                />
              </div>

              {/* Mobile inline submenu for Orders */}
              {isMobile && mobileOrdersExpanded && isSidebarOpen && (
                <div className="pl-2 pr-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {(can('tab.create_order', 'view') || featureOverrides['tab.create_order'] === 'off') && (
                    <SubSidebarItem
                      label="สร้างออเดอร์"
                      active={activeTab === 'create-order'}
                      onClick={() => navigateAndCloseMobile('create-order')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.create_order'] === 'off'}
                    />
                  )}
                  {(can('tab.confirm_orders', 'view') || featureOverrides['tab.confirm_orders'] === 'off') && (
                    <SubSidebarItem
                      label="ยืนยันและแบ่งส่ง"
                      active={activeTab === 'confirm-orders'}
                      onClick={() => navigateAndCloseMobile('confirm-orders')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.confirm_orders'] === 'off'}
                    />
                  )}
                  {(can('tab.track_orders', 'view') || featureOverrides['tab.track_orders'] === 'off') && (
                    <SubSidebarItem
                      label="ติดตามออเดอร์"
                      active={activeTab === 'track-orders'}
                      onClick={() => navigateAndCloseMobile('track-orders')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.track_orders'] === 'off'}
                    />
                  )}
                  {(can('tab.sales_trips', 'view') || featureOverrides['tab.sales_trips'] === 'off') && (
                    <SubSidebarItem
                      label="ออกใบแจ้งหนี้"
                      active={activeTab === 'sales-trips'}
                      onClick={() => navigateAndCloseMobile('sales-trips')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.sales_trips'] === 'off'}
                    />
                  )}
                  {(can('tab.cleanup_test_orders', 'view') || featureOverrides['tab.cleanup_test_orders'] === 'off' ||
                    can('tab.customers', 'view') || featureOverrides['tab.customers'] === 'off' ||
                    can('tab.products', 'view') || featureOverrides['tab.products'] === 'off' ||
                    can('tab.product_pricing', 'view') || featureOverrides['tab.product_pricing'] === 'off' ||
                    can('tab.customer_tiers', 'view') || featureOverrides['tab.customer_tiers'] === 'off') && (
                      <MenuSectionHeader label="เฉพาะเจ้าหน้าที่ / Manager" />
                    )}
                  {(can('tab.cleanup_test_orders', 'view') || featureOverrides['tab.cleanup_test_orders'] === 'off') && (
                    <SubSidebarItem
                      label="จัดการออเดอร์"
                      active={activeTab === 'cleanup-test-orders'}
                      onClick={() => navigateAndCloseMobile('cleanup-test-orders')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.cleanup_test_orders'] === 'off'}
                    />
                  )}
                  {(can('tab.customers', 'view') || featureOverrides['tab.customers'] === 'off') && (
                    <SubSidebarItem
                      label="จัดการลูกค้า"
                      active={activeTab === 'customers'}
                      onClick={() => navigateAndCloseMobile('customers')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.customers'] === 'off'}
                    />
                  )}
                  {(can('tab.products', 'view') || featureOverrides['tab.products'] === 'off') && (
                    <SubSidebarItem
                      label="จัดการสินค้า / ราคา"
                      active={activeTab === 'products'}
                      onClick={() => navigateAndCloseMobile('products')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.products'] === 'off'}
                    />
                  )}
                  {(can('tab.product_pricing', 'view') || featureOverrides['tab.product_pricing'] === 'off') && (
                    <SubSidebarItem
                      label="กำหนดราคาตามลูกค้า"
                      active={activeTab === 'product-pricing'}
                      onClick={() => navigateAndCloseMobile('product-pricing')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.product_pricing'] === 'off'}
                    />
                  )}
                  {(can('tab.customer_tiers', 'view') || featureOverrides['tab.customer_tiers'] === 'off') && (
                    <SubSidebarItem
                      label="ระดับลูกค้า"
                      active={activeTab === 'customer-tiers'}
                      onClick={() => navigateAndCloseMobile('customer-tiers')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.customer_tiers'] === 'off'}
                    />
                  )}
                </div>
              )}

              {/* Desktop flyout submenu for Orders */}
              {!isMobile && isOrdersHovered && (
                <div
                  className="fixed z-[100]"
                  style={{
                    top: `${ordersFlyoutPosition.top}px`,
                    left: `${ordersFlyoutPosition.left}px`,
                  }}
                  onMouseEnter={handleOrdersFlyoutMouseEnter}
                  onMouseLeave={handleOrdersFlyoutMouseLeave}
                >
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl dark:shadow-black/50 min-w-[220px] py-2 ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in slide-in-from-left-2 duration-150 max-h-[70vh] overflow-y-auto">
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">เมนูฝ่ายขาย</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>
                    <div className="px-2 space-y-0.5">
                      {(can('tab.create_order', 'view') || featureOverrides['tab.create_order'] === 'off' ||
                        can('tab.confirm_orders', 'view') || featureOverrides['tab.confirm_orders'] === 'off' ||
                        can('tab.track_orders', 'view') || featureOverrides['tab.track_orders'] === 'off' ||
                        can('tab.sales_trips', 'view') || featureOverrides['tab.sales_trips'] === 'off') && <MenuSectionHeader label="รายการออเดอร์" />}
                      {(can('tab.create_order', 'view') || featureOverrides['tab.create_order'] === 'off') && (
                        <SubSidebarItem
                          label="สร้างออเดอร์"
                          active={activeTab === 'create-order'}
                          onClick={() => {
                            setActiveTab('create-order');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.create_order'] === 'off'}
                        />
                      )}
                      {(can('tab.confirm_orders', 'view') || featureOverrides['tab.confirm_orders'] === 'off') && (
                        <SubSidebarItem
                          label="ยืนยันและแบ่งส่ง"
                          active={activeTab === 'confirm-orders'}
                          onClick={() => {
                            setActiveTab('confirm-orders');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.confirm_orders'] === 'off'}
                        />
                      )}
                      {(can('tab.track_orders', 'view') || featureOverrides['tab.track_orders'] === 'off') && (
                        <SubSidebarItem
                          label="ติดตามออเดอร์"
                          active={activeTab === 'track-orders'}
                          onClick={() => {
                            setActiveTab('track-orders');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.track_orders'] === 'off'}
                        />
                      )}
                      {(can('tab.sales_trips', 'view') || featureOverrides['tab.sales_trips'] === 'off') && (
                        <SubSidebarItem
                          label="ออกใบแจ้งหนี้"
                          active={activeTab === 'sales-trips'}
                          onClick={() => {
                            setActiveTab('sales-trips');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.sales_trips'] === 'off'}
                        />
                      )}

                      {(can('tab.cleanup_test_orders', 'view') || featureOverrides['tab.cleanup_test_orders'] === 'off' ||
                        can('tab.customers', 'view') || featureOverrides['tab.customers'] === 'off' ||
                        can('tab.products', 'view') || featureOverrides['tab.products'] === 'off' ||
                        can('tab.product_pricing', 'view') || featureOverrides['tab.product_pricing'] === 'off' ||
                        can('tab.customer_tiers', 'view') || featureOverrides['tab.customer_tiers'] === 'off') && (
                          <MenuSectionHeader label="เฉพาะเจ้าหน้าที่ / Manager" />
                        )}
                      {(can('tab.cleanup_test_orders', 'view') || featureOverrides['tab.cleanup_test_orders'] === 'off') && (
                        <SubSidebarItem
                          label="จัดการออเดอร์"
                          active={activeTab === 'cleanup-test-orders'}
                          onClick={() => {
                            setActiveTab('cleanup-test-orders');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.cleanup_test_orders'] === 'off'}
                        />
                      )}
                      {(can('tab.customers', 'view') || featureOverrides['tab.customers'] === 'off') && (
                        <SubSidebarItem
                          label="จัดการลูกค้า"
                          active={activeTab === 'customers'}
                          onClick={() => {
                            setActiveTab('customers');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.customers'] === 'off'}
                        />
                      )}
                      {(can('tab.products', 'view') || featureOverrides['tab.products'] === 'off') && (
                        <SubSidebarItem
                          label="จัดการสินค้า / ราคา"
                          active={activeTab === 'products'}
                          onClick={() => {
                            setActiveTab('products');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.products'] === 'off'}
                        />
                      )}
                      {(can('tab.product_pricing', 'view') || featureOverrides['tab.product_pricing'] === 'off') && (
                        <SubSidebarItem
                          label="กำหนดราคาตามลูกค้า"
                          active={activeTab === 'product-pricing'}
                          onClick={() => {
                            setActiveTab('product-pricing');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.product_pricing'] === 'off'}
                        />
                      )}
                      {(can('tab.customer_tiers', 'view') || featureOverrides['tab.customer_tiers'] === 'off') && (
                        <SubSidebarItem
                          label="ระดับลูกค้า"
                          active={activeTab === 'customer-tiers'}
                          onClick={() => {
                            setActiveTab('customer-tiers');
                            setIsOrdersHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                          isWarning={featureOverrides['tab.customer_tiers'] === 'off'}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 3. คลังสินค้า (Stock) */}
          {showStockNavGroup && (
            <>
              <div
                ref={stockMenuRef}
                className="relative group/menu"
                onMouseEnter={handleStockMouseEnter}
                onMouseLeave={handleStockMouseLeave}
              >
                <SidebarItem
                  icon={Boxes}
                  label={isSidebarOpen ? "คลังสินค้า" : ""}
                  active={activeTab === 'stock-dashboard' || activeTab === 'warehouses' || activeTab === 'inventory-receipts' || activeTab === 'purchase-receipts' || activeTab === 'confirm-orders'}
                  onClick={() => {
                    if (isMobile) {
                      setMobileStockExpanded(prev => !prev);
                    } else {
                      const firstStock =
                        (can('tab.stock_dashboard', 'view') || featureOverrides['tab.stock_dashboard'] === 'off')
                          ? 'stock-dashboard'
                          : (can('tab.confirm_orders', 'view') || featureOverrides['tab.confirm_orders'] === 'off')
                            ? 'confirm-orders'
                            : (can('tab.warehouses', 'view') || featureOverrides['tab.warehouses'] === 'off')
                              ? 'warehouses'
                              : can('tab.purchase_receipts', 'view')
                                ? 'purchase-receipts'
                                : (can('tab.inventory_receipts', 'view') || featureOverrides['tab.inventory_receipts'] === 'off')
                                  ? 'inventory-receipts'
                                  : null;
                      if (firstStock && activeTab !== firstStock) setActiveTab(firstStock);
                    }
                  }}
                  isCollapsed={!isSidebarOpen}
                  hasSubmenu={true}
                  isOpen={isMobile ? mobileStockExpanded : isStockHovered}
                  isWarning={
                    featureOverrides['tab.stock_dashboard'] === 'off' ||
                    featureOverrides['tab.confirm_orders'] === 'off' ||
                    featureOverrides['tab.warehouses'] === 'off' ||
                    featureOverrides['tab.inventory_receipts'] === 'off'
                  }
                />
              </div>

              {/* Mobile inline submenu for Stock */}
              {isMobile && mobileStockExpanded && isSidebarOpen && (
                <div className="pl-2 pr-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {(can('tab.stock_dashboard', 'view') || featureOverrides['tab.stock_dashboard'] === 'off') && (
                    <SubSidebarItem
                      label="Stock Dashboard"
                      active={activeTab === 'stock-dashboard'}
                      onClick={() => navigateAndCloseMobile('stock-dashboard')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.stock_dashboard'] === 'off'}
                    />
                  )}
                  {(can('tab.confirm_orders', 'view') || featureOverrides['tab.confirm_orders'] === 'off') && (
                    <SubSidebarItem
                      label="ยืนยันและแบ่งส่ง"
                      active={activeTab === 'confirm-orders'}
                      onClick={() => navigateAndCloseMobile('confirm-orders')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.confirm_orders'] === 'off'}
                    />
                  )}
                  {(can('tab.warehouses', 'view') || featureOverrides['tab.warehouses'] === 'off') && (
                    <SubSidebarItem
                      label="จัดการคลัง"
                      active={activeTab === 'warehouses'}
                      onClick={() => navigateAndCloseMobile('warehouses')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.warehouses'] === 'off'}
                    />
                  )}
                  {can('tab.purchase_receipts', 'view') && (
                    <SubSidebarItem label="บันทึกต้นทุนจัดซื้อ" active={activeTab === 'purchase-receipts'} onClick={() => navigateAndCloseMobile('purchase-receipts')} isCollapsed={false} isFlyout={false} />
                  )}
                  {(can('tab.inventory_receipts', 'view') || featureOverrides['tab.inventory_receipts'] === 'off') && (
                    <SubSidebarItem
                      label="ประวัติรับสินค้า"
                      active={activeTab === 'inventory-receipts'}
                      onClick={() => navigateAndCloseMobile('inventory-receipts')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.inventory_receipts'] === 'off'}
                    />
                  )}
                </div>
              )}

              {/* Desktop flyout submenu for Stock */}
              {!isMobile && isStockHovered && (
                <div
                  className="fixed z-[100]"
                  style={{
                    top: `${stockFlyoutPosition.top}px`,
                    left: `${stockFlyoutPosition.left}px`,
                  }}
                  onMouseEnter={handleStockFlyoutMouseEnter}
                  onMouseLeave={handleStockFlyoutMouseLeave}
                >
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl dark:shadow-black/50 min-w-[220px] py-2 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">เมนูคลังสินค้า</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>
                    <div className="px-2 space-y-1">
                      {(can('tab.stock_dashboard', 'view') || can('tab.confirm_orders', 'view')) && (
                        <MenuSectionHeader label="ข้อมูลคลังสินค้า" />
                      )}
                      {can('tab.stock_dashboard', 'view') && (
                        <SubSidebarItem
                          label="Stock Dashboard"
                          active={activeTab === 'stock-dashboard'}
                          onClick={() => {
                            setActiveTab('stock-dashboard');
                            setIsStockHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}
                      {can('tab.confirm_orders', 'view') && (
                        <SubSidebarItem
                          label="ยืนยันและแบ่งส่ง"
                          active={activeTab === 'confirm-orders'}
                          onClick={() => {
                            setActiveTab('confirm-orders');
                            setIsStockHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}

                      {(can('tab.warehouses', 'view') ||
                        can('tab.inventory_receipts', 'view') ||
                        can('tab.purchase_receipts', 'view')) && (
                          <>
                            <MenuSectionHeader label="จัดการระบบคลัง" />
                            {can('tab.warehouses', 'view') && (
                              <SubSidebarItem
                                label="จัดการคลัง"
                                active={activeTab === 'warehouses'}
                                onClick={() => {
                                  setActiveTab('warehouses');
                                  setIsStockHovered(false);
                                }}
                                isCollapsed={false}
                                isFlyout={true}
                              />
                            )}
                            {can('tab.purchase_receipts', 'view') && (
                              <SubSidebarItem
                                label="บันทึกต้นทุนจัดซื้อ"
                                active={activeTab === 'purchase-receipts'}
                                onClick={() => {
                                  setActiveTab('purchase-receipts');
                                  setIsStockHovered(false);
                                }}
                                isCollapsed={false}
                                isFlyout={true}
                              />
                            )}
                            {can('tab.inventory_receipts', 'view') && (
                              <SubSidebarItem
                                label="ประวัติรับสินค้า"
                                active={activeTab === 'inventory-receipts'}
                                onClick={() => {
                                  setActiveTab('inventory-receipts');
                                  setIsStockHovered(false);
                                }}
                                isCollapsed={false}
                                isFlyout={true}
                              />
                            )}
                          </>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 4. ฝ่ายขนส่ง (Logistics) - Consolidated — ฝ่ายขายแสดงได้ถ้ามีสิทธิ์แท็บในกลุ่มนี้อย่างน้อยหนึ่งรายการ */}
          {(!isSales || salesHasLogisticsMenu) && (
            <>
              <div
                ref={logisticsMenuRef}
                className="relative group/menu"
                onMouseEnter={handleLogisticsMouseEnter}
                onMouseLeave={handleLogisticsMouseLeave}
              >
                <SidebarItem
                  icon={Truck}
                  label={isSidebarOpen ? "ฝ่ายขนส่ง" : ""}
                  active={
                    activeTab === 'dashboard' ||
                    activeTab === 'vehicles' ||
                    activeTab === 'maintenance' ||
                    activeTab === 'triplogs' ||
                    activeTab === 'fuellogs' ||
                    activeTab === 'approvals' ||
                    activeTab === 'daily-summary' ||
                    activeTab === 'delivery-trips' ||
                    activeTab === 'packing-simulation' ||
                    activeTab === 'pending-orders' ||
                    activeTab === 'partial-delivery'
                  }
                  badgeCount={canSeePartialDeliveryQueue ? logisticsOrdersAttentionCount : 0}
                  onClick={() => {
                    if (isMobile) {
                      setMobileLogisticsExpanded(prev => !prev);
                    } else if (isDriver) {
                      setActiveTab('triplogs');
                      setTripLogView('form');
                    } else {
                      const logisticsEntryOrder = [
                        'dashboard',
                        'pending-orders',
                        'delivery-trips',
                        'packing-simulation',
                        'triplogs',
                        'fuellogs',
                        'maintenance',
                        'vehicles',
                        'approvals',
                        'daily-summary',
                      ] as const;
                      for (const tab of logisticsEntryOrder) {
                        const f = TAB_TO_PRIMARY_FEATURE[tab];
                        if (f && (can(f, 'view') || featureOverrides[f] === 'off')) {
                          setActiveTab(tab);
                          return;
                        }
                      }
                    }
                  }}
                  isCollapsed={!isSidebarOpen}
                  hasSubmenu={true}
                  isOpen={isMobile ? mobileLogisticsExpanded : isLogisticsHovered}
                  isWarning={
                    featureOverrides['tab.dashboard'] === 'off' ||
                    featureOverrides['tab.vehicles'] === 'off' ||
                    featureOverrides['tab.maintenance'] === 'off' ||
                    featureOverrides['tab.triplogs'] === 'off' ||
                    featureOverrides['tab.fuellogs'] === 'off' ||
                    featureOverrides['tab.approvals'] === 'off' ||
                    featureOverrides['tab.daily_summary'] === 'off' ||
                    featureOverrides['tab.delivery_trips'] === 'off' ||
                    featureOverrides['tab.packing_simulation'] === 'off' ||
                    featureOverrides['tab.pending_orders'] === 'off'
                  }
                />
              </div>

              {/* Mobile inline submenu for Logistics */}
              {isMobile && mobileLogisticsExpanded && isSidebarOpen && (
                <div className="pl-2 pr-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <SubSidebarItem
                    label="บันทึกการใช้งานรถ"
                    active={activeTab === 'triplogs'}
                    onClick={() => navigateAndCloseMobile('triplogs', () => setTripLogView(isDriver ? 'form' : 'list'))}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.triplogs'] === 'off'}
                  />
                  <SubSidebarItem
                    label="บันทึกการเติมน้ำมัน"
                    active={activeTab === 'fuellogs'}
                    onClick={() => navigateAndCloseMobile('fuellogs', () => setFuelLogView(isDriver ? 'form' : 'list'))}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.fuellogs'] === 'off'}
                  />
                  <SubSidebarItem
                    label="แจ้งซ่อม / การซ่อมบำรุง"
                    active={activeTab === 'maintenance'}
                    onClick={() => navigateAndCloseMobile('maintenance', () => setTicketView(isDriver ? 'form' : 'list'))}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.maintenance'] === 'off'}
                  />
                  <SubSidebarItem
                    label="จำลองจัดเรียง"
                    active={activeTab === 'packing-simulation'}
                    onClick={() => navigateAndCloseMobile('packing-simulation')}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.packing_simulation'] === 'off'}
                  />
                  {!isDriver && (can('tab.dashboard', 'view') || featureOverrides['tab.dashboard'] === 'off') && (
                    <SubSidebarItem
                      label="เดชบอร์ด(ฝ่ายขนส่ง)"
                      active={activeTab === 'dashboard'}
                      onClick={() => navigateAndCloseMobile('dashboard')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.dashboard'] === 'off'}
                    />
                  )}
                  {!isDriver && (can('tab.vehicles', 'view') || featureOverrides['tab.vehicles'] === 'off') && (
                    <SubSidebarItem
                      label="ยานพาหนะ"
                      active={activeTab === 'vehicles'}
                      onClick={() => navigateAndCloseMobile('vehicles')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.vehicles'] === 'off'}
                    />
                  )}
                  {(can('tab.approvals', 'view') || featureOverrides['tab.approvals'] === 'off') && (
                    <SubSidebarItem
                      label="ภาพรวมการอนุมัติ"
                      active={activeTab === 'approvals'}
                      onClick={() => navigateAndCloseMobile('approvals')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.approvals'] === 'off'}
                    />
                  )}
                  {!isDriver && (can('tab.daily_summary', 'view') || featureOverrides['tab.daily_summary'] === 'off') && (
                    <SubSidebarItem
                      label="สรุปการใช้รถรายวัน"
                      active={activeTab === 'daily-summary'}
                      onClick={() => navigateAndCloseMobile('daily-summary')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.daily_summary'] === 'off'}
                    />
                  )}
                  {!isDriver && (can('tab.delivery_trips', 'view') || featureOverrides['tab.delivery_trips'] === 'off') && (
                    <SubSidebarItem
                      label="ทริปส่งสินค้า"
                      active={activeTab === 'delivery-trips'}
                      onClick={() => navigateAndCloseMobile('delivery-trips', () => { setDeliveryTripView('list'); setSelectedDeliveryTripId(null); })}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.delivery_trips'] === 'off'}
                    />
                  )}
                  {!isDriver && (can('tab.pending_orders', 'view') || featureOverrides['tab.pending_orders'] === 'off') && (
                    <SubSidebarItem
                      label="ออเดอร์รอจัดส่ง"
                      active={activeTab === 'pending-orders'}
                      onClick={() => navigateAndCloseMobile('pending-orders')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.pending_orders'] === 'off'}
                      badgeCount={
                        can('tab.pending_orders', 'view') ? pendingOrdersQueueCount : 0
                      }
                    />
                  )}
                  {!isDriver && (can('tab.trip_planning_board', 'view') || featureOverrides['tab.trip_planning_board'] === 'off') && (
                    <SubSidebarItem
                      label="บอร์ดจัดคิว (Draft)"
                      active={activeTab === 'trip-planning-board'}
                      onClick={() => navigateAndCloseMobile('trip-planning-board')}
                      isCollapsed={false}
                      isFlyout={false}
                      isWarning={featureOverrides['tab.trip_planning_board'] === 'off'}
                    />
                  )}
                  {!isDriver && can('tab.pending_orders', 'view') && (
                    <SubSidebarItem
                      label="ออเดอร์แบ่งส่ง"
                      active={activeTab === 'partial-delivery'}
                      onClick={() => navigateAndCloseMobile('partial-delivery')}
                      isCollapsed={false}
                      isFlyout={false}
                      badgeCount={partialDeliveryQueueCount}
                    />
                  )}
                </div>
              )}

              {/* Desktop flyout submenu for Logistics */}
              {!isMobile && isLogisticsHovered && (
                <div
                  className="fixed z-[100]"
                  style={{
                    top: `${logisticsFlyoutPosition.top}px`,
                    left: `${logisticsFlyoutPosition.left}px`,
                  }}
                  onMouseEnter={handleLogisticsFlyoutMouseEnter}
                  onMouseLeave={handleLogisticsFlyoutMouseLeave}
                >
                  <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in slide-in-from-left-2 duration-150 overflow-y-auto"
                    style={{ maxHeight: logisticsFlyoutMaxHeight, width: 'fit-content', minWidth: '500px' }}
                  >
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">เมนูฝ่ายขนส่ง</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>

                    <div className="flex divide-x divide-slate-100 dark:divide-slate-800">
                      {/* Column 1: ออเดอร์ & จัดส่ง */}
                      <div className="flex-1 px-2 space-y-0.5 min-w-[240px]">
                        <MenuSectionHeader label="งานออเดอร์และการจัดส่ง" />
                        <div className="px-4 py-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">งานทั่วไป</p>
                        </div>



                        {!isDriver && can('tab.pending_orders', 'view') && (
                          <SubSidebarItem
                            label="ออเดอร์รอจัดส่ง"
                            active={activeTab === 'pending-orders'}
                            onClick={() => {
                              setActiveTab('pending-orders');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                            badgeCount={pendingOrdersQueueCount}
                          />
                        )}

                        {!isDriver && can('tab.trip_planning_board', 'view') && (
                          <SubSidebarItem
                            label="บอร์ดจัดคิว (Draft)"
                            active={activeTab === 'trip-planning-board'}
                            onClick={() => {
                              setActiveTab('trip-planning-board');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {!isDriver && can('tab.pending_orders', 'view') && (
                          <SubSidebarItem
                            label="ออเดอร์แบ่งส่ง"
                            active={activeTab === 'partial-delivery'}
                            onClick={() => {
                              setActiveTab('partial-delivery');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                            badgeCount={partialDeliveryQueueCount}
                          />
                        )}

                        {!isDriver && can('tab.delivery_trips', 'view') && (
                          <SubSidebarItem
                            label="ทริปส่งสินค้า"
                            active={activeTab === 'delivery-trips'}
                            onClick={() => {
                              setActiveTab('delivery-trips');
                              setDeliveryTripView('list');
                              setSelectedDeliveryTripId(null);
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {/* จำลองจัดเรียง */}
                        <SubSidebarItem
                          label="จำลองจัดเรียง"
                          active={activeTab === 'packing-simulation'}
                          onClick={() => {
                            setActiveTab('packing-simulation');
                            setIsLogisticsHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      </div>

                      {/* Column 2: งานรถ & บุคลากร */}
                      <div className="flex-1 px-2 space-y-0.5 min-w-[240px]">
                        <MenuSectionHeader label="งานรถและพนักงานขับ" />
                        <div className="px-4 py-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">งานทั่วไป</p>
                        </div>

                        {/* Trip Logs */}
                        <SubSidebarItem
                          label="บันทึกการใช้งานรถ"
                          active={activeTab === 'triplogs'}
                          onClick={() => {
                            setActiveTab('triplogs');
                            setTripLogView(isDriver ? 'form' : 'list');
                            setIsLogisticsHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />

                        {/* Fuel Logs */}
                        <SubSidebarItem
                          label="บันทึกการเติมน้ำมัน"
                          active={activeTab === 'fuellogs'}
                          onClick={() => {
                            setActiveTab('fuellogs');
                            setFuelLogView(isDriver ? 'form' : 'list');
                            setIsLogisticsHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />

                        {/* Maintenance */}
                        <SubSidebarItem
                          label="การซ่อมบำรุง"
                          active={activeTab === 'maintenance'}
                          onClick={() => {
                            setActiveTab('maintenance');
                            if (isDriver) {
                              setTicketView('form');
                            } else {
                              setTicketView('list');
                            }
                            setIsLogisticsHovered(false);
                          }}
                          isCollapsed={false}
                          isFlyout={true}
                        />

                        {((!isDriver &&
                          (can('tab.dashboard', 'view') ||
                            can('tab.vehicles', 'view') ||
                            can('tab.daily_summary', 'view'))) ||
                          can('tab.approvals', 'view') ||
                          can('tab.service_staff', 'view')) && (
                            <MenuSectionHeader label="เฉพาะเจ้าหน้าที่ / Manager" />
                          )}

                        {!isDriver && can('tab.dashboard', 'view') && (
                          <SubSidebarItem
                            label="เดชบอร์ด(ฝ่ายขนส่ง)"
                            active={activeTab === 'dashboard'}
                            onClick={() => {
                              setActiveTab('dashboard');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {!isDriver && can('tab.vehicles', 'view') && (
                          <SubSidebarItem
                            label="ยานพาหนะ"
                            active={activeTab === 'vehicles'}
                            onClick={() => {
                              setActiveTab('vehicles');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {can('tab.approvals', 'view') && (
                          <SubSidebarItem
                            label="ภาพรวมการอนุมัติ"
                            active={activeTab === 'approvals'}
                            onClick={() => {
                              setActiveTab('approvals');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {!isDriver && can('tab.daily_summary', 'view') && (
                          <SubSidebarItem
                            label="สรุปการใช้รถรายวัน"
                            active={activeTab === 'daily-summary'}
                            onClick={() => {
                              setActiveTab('daily-summary');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}

                        {can('tab.service_staff', 'view') && (
                          <SubSidebarItem
                            label="จัดการพนักงาน"
                            active={activeTab === 'service-staff'}
                            onClick={() => {
                              setActiveTab('service-staff');
                              setIsLogisticsHovered(false);
                            }}
                            isCollapsed={false}
                            isFlyout={true}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 5. 
           */}
          {showHrMenu && (
            <>
              <div
                ref={hrMenuRef}
                className="relative group/menu"
                onMouseEnter={handleHRMouseEnter}
                onMouseLeave={handleHRMouseLeave}
              >
                <SidebarItem
                  icon={UserCog}
                  label={isSidebarOpen ? "บุคคล / HR" : ""}
                  active={
                    activeTab === 'admin-staff' ||
                    activeTab === 'service-staff' ||
                    activeTab === 'commission' ||
                    activeTab === 'commission-rates'
                  }
                  onClick={() => {
                    if (isMobile) {
                      setMobileHRExpanded(prev => !prev);
                    } else {
                      setActiveTab('admin-staff');
                    }
                  }}
                  isCollapsed={!isSidebarOpen}
                  hasSubmenu={true}
                  isOpen={isMobile ? mobileHRExpanded : isHRHovered}
                />
              </div>

              {/* Mobile inline submenu for HR */}
              {isMobile && mobileHRExpanded && isSidebarOpen && (
                <div className="pl-2 pr-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {can('tab.admin_staff', 'view') && (
                    <SubSidebarItem
                      label="บัญชีพนักงาน"
                      active={activeTab === 'admin-staff'}
                      onClick={() => navigateAndCloseMobile('admin-staff')}
                      isCollapsed={false}
                      isFlyout={false}
                    />
                  )}
                  {can('tab.service_staff', 'view') && (
                    <SubSidebarItem
                      label="ประวัติการปฏิบัติงาน"
                      active={activeTab === 'service-staff'}
                      onClick={() => navigateAndCloseMobile('service-staff')}
                      isCollapsed={false}
                      isFlyout={false}
                    />
                  )}
                  {can('tab.commission', 'view') && (
                    <SubSidebarItem
                      label="ค่าคอมมิชชั่น"
                      active={activeTab === 'commission'}
                      onClick={() => navigateAndCloseMobile('commission')}
                      isCollapsed={false}
                      isFlyout={false}
                    />
                  )}
                  {can('tab.commission_rates', 'view') && (
                    <SubSidebarItem
                      label="ตั้งค่าอัตราค่าคอมมิชชั่น"
                      active={activeTab === 'commission-rates'}
                      onClick={() => navigateAndCloseMobile('commission-rates')}
                      isCollapsed={false}
                      isFlyout={false}
                    />
                  )}
                </div>
              )}

              {/* Desktop flyout submenu for HR */}
              {!isMobile && isHRHovered && (
                <div
                  className="fixed z-[100]"
                  style={{
                    top: `${hrFlyoutPosition.top}px`,
                    left: `${hrFlyoutPosition.left}px`,
                  }}
                  onMouseEnter={handleHRFlyoutMouseEnter}
                  onMouseLeave={handleHRFlyoutMouseLeave}
                >
                  <div
                    className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl min-w-[220px] py-2 ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in slide-in-from-left-2 duration-150 overflow-y-auto"
                    style={{ maxHeight: hrFlyoutMaxHeight }}
                  >
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-[10px] font-black text-pink-500 dark:text-pink-400 uppercase tracking-widest">บุคคล / HR</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></div>
                    </div>
                    <div className="px-2 space-y-0.5">
                      {(can('tab.admin_staff', 'view') || can('tab.service_staff', 'view')) && (
                        <MenuSectionHeader label="จัดการพนักงาน" />
                      )}
                      {can('tab.admin_staff', 'view') && (
                        <SubSidebarItem
                          label="บัญชีพนักงาน"
                          active={activeTab === 'admin-staff'}
                          onClick={() => { setActiveTab('admin-staff'); setIsHRHovered(false); }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}
                      {can('tab.service_staff', 'view') && (
                        <SubSidebarItem
                          label="ประวัติการปฏิบัติงาน"
                          active={activeTab === 'service-staff'}
                          onClick={() => { setActiveTab('service-staff'); setIsHRHovered(false); }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}
                      {(can('tab.commission', 'view') || can('tab.commission_rates', 'view')) && (
                        <MenuSectionHeader label="ค่าตอบแทน" />
                      )}
                      {can('tab.commission', 'view') && (
                        <SubSidebarItem
                          label="ค่าคอมมิชชั่น"
                          active={activeTab === 'commission'}
                          onClick={() => { setActiveTab('commission'); setIsHRHovered(false); }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}
                      {can('tab.commission_rates', 'view') && (
                        <SubSidebarItem
                          label="ตั้งค่าอัตราค่าคอมมิชชั่น"
                          active={activeTab === 'commission-rates'}
                          onClick={() => { setActiveTab('commission-rates'); setIsHRHovered(false); }}
                          isCollapsed={false}
                          isFlyout={true}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 space-y-1">
          {/* Import Data - Admin Only */}
          {can('tab.excel_import', 'view') && (
            <div
              ref={importMenuRef}
              className="relative group/menu"
              onMouseEnter={handleImportMouseEnter}
              onMouseLeave={handleImportMouseLeave}
            >
              <SidebarItem
                icon={Upload}
                label={isSidebarOpen ? "นำเข้าข้อมูล" : ""}
                active={activeTab === 'excel-import'}
                onClick={() => {
                  // No-op or handle specific click action if needed
                }}
                isCollapsed={!isSidebarOpen}
                hasSubmenu={true}
                isOpen={isImportHovered}
              />

              {/* Flyout Style Submenu (Level 1: Departments) */}
              {isImportHovered && (
                <div
                  className="fixed z-[100] w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 animate-in fade-in slide-in-from-left-2 duration-200"
                  style={{
                    top: importFlyoutPosition.top,
                    left: importFlyoutPosition.left,
                  }}
                  onMouseEnter={handleImportFlyoutMouseEnter}
                  onMouseLeave={handleImportFlyoutMouseLeave}
                >
                  <div className="flex flex-col gap-1">
                    <button
                      onMouseEnter={(e) => handleImportDeptMouseEnter(e, 'sales')}
                      onMouseLeave={handleImportDeptMouseLeave}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${hoveredImportDept === 'sales'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold translate-x-1'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                    >
                      <span className="text-sm">ฝ่ายขาย</span>
                      <ChevronRight size={14} className={hoveredImportDept === 'sales' ? 'translate-x-0.5' : 'opacity-40'} />
                    </button>

                    <button
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                    >
                      <span className="text-sm">ฝ่ายคลังสินค้า</span>
                      <ChevronRight size={14} className="opacity-20" />
                    </button>

                    <button
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                    >
                      <span className="text-sm">ฝ่ายจัดซื้อ</span>
                      <ChevronRight size={14} className="opacity-20" />
                    </button>
                  </div>

                  {/* Flyout Level 2: Items for Department */}
                  {hoveredImportDept === 'sales' && (
                    <div
                      className="fixed z-[110] w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 animate-in fade-in slide-in-from-left-2 duration-200"
                      style={{
                        top: importDeptFlyoutPosition.top,
                        left: importDeptFlyoutPosition.left,
                      }}
                      onMouseEnter={handleImportDeptFlyoutMouseEnter}
                      onMouseLeave={handleImportDeptFlyoutMouseLeave}
                    >
                      <div className="mb-2 px-3 py-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800">
                        รายการนำเข้า (ฝ่ายขาย)
                      </div>
                      <SubSidebarItem
                        label="Step Pricing"
                        active={activeTab === 'excel-import'}
                        onClick={() => {
                          setActiveTab('excel-import');
                          setIsImportHovered(false);
                          setHoveredImportDept(null);
                        }}
                        isCollapsed={false}
                        isFlyout={true}
                      />
                      <SubSidebarItem
                        label="ข้อมูลลูกค้า"
                        active={activeTab === 'customer-import'}
                        onClick={() => {
                          setActiveTab('customer-import');
                          setIsImportHovered(false);
                          setHoveredImportDept(null);
                        }}
                        isCollapsed={false}
                        isFlyout={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Database Explorer */}
          {isDev && (
            <SidebarItem
              icon={Database}
              label={isSidebarOpen ? "เมนูหลังบ้าน (DB)" : ""}
              active={activeTab === 'db-explorer'}
              onClick={() => navigateAndCloseMobile('db-explorer')}
              isCollapsed={!isSidebarOpen}
              isWarning={featureOverrides['tab.db_explorer'] === 'off'}
            />
          )}
          {/* Settings Menu with Submenu */}
          <>
            <div
              ref={settingsMenuRef}
              className="relative group/menu"
              onMouseEnter={handleSettingsMouseEnter}
              onMouseLeave={handleSettingsMouseLeave}
            >
              <SidebarItem
                icon={Settings}
                label={isSidebarOpen ? "ตั้งค่า" : ""}
                active={
                  activeTab === 'profile' ||
                  activeTab === 'settings' ||
                  activeTab === 'role-feature-access'
                }
                onClick={() => {
                  if (isMobile) {
                    setMobileSettingsExpanded(prev => !prev);
                  }
                }}
                isCollapsed={!isSidebarOpen}
                hasSubmenu={true}
                isOpen={isMobile ? mobileSettingsExpanded : isSettingsHovered}
                isWarning={
                  featureOverrides['tab.profile'] === 'off' ||
                  featureOverrides['tab.settings'] === 'off' ||
                  featureOverrides['tab.role_feature_access'] === 'off'
                }
              />
            </div>

            {/* Mobile inline submenu for Settings */}
            {isMobile && mobileSettingsExpanded && isSidebarOpen && (
              <div className="pl-2 pr-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {(can('tab.profile', 'view') || featureOverrides['tab.profile'] === 'off') && (
                  <SubSidebarItem
                    label="โปรไฟล์"
                    active={activeTab === 'profile'}
                    onClick={() => navigateAndCloseMobile('profile')}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.profile'] === 'off'}
                  />
                )}
                {(can('tab.role_feature_access', 'view') || featureOverrides['tab.role_feature_access'] === 'off') && (
                  <SubSidebarItem
                    label="สิทธิ์ตามฟีเจอร์"
                    active={activeTab === 'role-feature-access'}
                    onClick={() => navigateAndCloseMobile('role-feature-access')}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.role_feature_access'] === 'off'}
                  />
                )}
                {(can('tab.settings', 'view') || featureOverrides['tab.settings'] === 'off') && (
                  <SubSidebarItem
                    label="ตั้งค่าแจ้งเตือน"
                    active={activeTab === 'settings'}
                    onClick={() => navigateAndCloseMobile('settings')}
                    isCollapsed={false}
                    isFlyout={false}
                    isWarning={featureOverrides['tab.settings'] === 'off'}
                  />
                )}
              </div>
            )}

            {/* Desktop flyout submenu for Settings */}
            {!isMobile && isSettingsHovered && (
              <div
                className="fixed z-[100]"
                style={{
                  top: `${settingsFlyoutPosition.top}px`,
                  left: `${settingsFlyoutPosition.left}px`,
                }}
                onMouseEnter={handleSettingsFlyoutMouseEnter}
                onMouseLeave={handleSettingsFlyoutMouseLeave}
              >
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl dark:shadow-black/50 min-w-[220px] py-2 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in slide-in-from-left-2 duration-150">
                  <div className="px-4 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">เมนูตั้งค่า</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                  </div>
                  <div className="px-2 space-y-1">
                    <SubSidebarItem
                      label="โปรไฟล์"
                      active={activeTab === 'profile'}
                      onClick={() => {
                        setActiveTab('profile');
                        setIsSettingsHovered(false);
                      }}
                      isCollapsed={false}
                      isFlyout={true}
                    />
                    {can('tab.role_feature_access', 'view') && (
                      <SubSidebarItem
                        label="สิทธิ์ตามฟีเจอร์"
                        active={activeTab === 'role-feature-access'}
                        onClick={() => {
                          setActiveTab('role-feature-access');
                          setIsSettingsHovered(false);
                        }}
                        isCollapsed={false}
                        isFlyout={true}
                      />
                    )}
                    {can('tab.settings', 'view') && (
                      <SubSidebarItem
                        label="ตั้งค่าแจ้งเตือน"
                        active={activeTab === 'settings'}
                        onClick={() => {
                          setActiveTab('settings');
                          setIsSettingsHovered(false);
                        }}
                        isCollapsed={false}
                        isFlyout={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </>

          <SidebarItem icon={LogOut} label={isSidebarOpen ? "ออกจากระบบ" : ""} onClick={() => {
            setShowLogoutConfirm(true);
          }} />
        </div>
      </aside>

      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-300 overflow-x-hidden ${contentMarginClass}`}>

        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center flex-1 min-w-0">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 flex-shrink-0">
              <Menu size={20} />
            </button>
            <HeaderActivityTicker
              items={tickerItems}
              loading={tickerLoading}
              showBranchTag={isHighLevel}
            />
          </div>

          <div className="flex items-center space-x-4 relative">
            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-yellow-400 transition-colors">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="relative">
              <button
                data-notification-bell
                onClick={() => setShowNotifications((prev) => !prev)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 relative"
                title={pendingCount > 0 ? (isSales ? `${pendingCount} ทริปรอออกบิล` : `${pendingCount} ตั๋วรออนุมัติ`) : 'การแจ้งเตือน'}
              >
                <Bell size={20} />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white dark:border-charcoal-900 flex items-center justify-center text-xs text-white font-semibold px-1">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  data-notification-dropdown
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      การแจ้งเตือน
                    </span>
                    <button
                      className="text-xs text-enterprise-600 dark:text-enterprise-400 hover:underline"
                      onClick={() => {
                        if (isSales) {
                          setActiveTab('sales-trips');
                        } else {
                          setActiveTab('maintenance');
                          setTicketView('list');
                        }
                        setShowNotifications(false);
                      }}
                    >
                      ดูทั้งหมด
                    </button>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {loadingNotifications ? (
                      <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                        กำลังโหลดรายการ...
                      </div>
                    ) : isSales ? (
                      // Sales: Show pending billing trips
                      pendingBillingTrips.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่มีทริปที่รอออกบิล
                        </div>
                      ) : (
                        pendingBillingTrips.map((trip) => {
                          const pendingStores = trip.stores?.filter((store: any) => store.invoice_status !== 'issued').length || 0;
                          const totalStores = trip.stores?.length || 0;
                          const plannedDate = new Date(trip.planned_date).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                          });

                          return (
                            <button
                              key={trip.id}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                              onClick={() => {
                                setActiveTab('sales-trips');
                                setShowNotifications(false);
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                      {trip.trip_number || `ทริป #${trip.sequence_order || 'N/A'}`}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                      {trip.vehicle?.plate || 'ไม่ระบุ'} · {plannedDate}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 truncate">
                                      รอออกบิล {pendingStores}/{totalStores} ร้าน
                                    </p>
                                  </div>
                                  <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 flex-shrink-0">
                                    รอออกบิล
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )
                    ) : (
                      // Other roles: Show pending tickets
                      notificationItems.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่มีตั๋วที่รออนุมัติ
                        </div>
                      ) : (
                        notificationItems.map((ticket) => (
                          <button
                            key={ticket.id}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                            onClick={() => {
                              // Set flag to prevent useEffect from resetting
                              isNavigatingToTicketRef.current = true;
                              // Set selectedTicketId and view first, then change tab
                              // This prevents the useEffect from resetting the view
                              setSelectedTicketId(ticket.id.toString());
                              setTicketView('detail');
                              setActiveTab('maintenance');
                              setShowNotifications(false);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              {/* Vehicle Image */}
                              {(ticket as any).vehicle_image_url ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                  <img
                                    src={(ticket as any).vehicle_image_url}
                                    alt={ticket.vehicle_plate || 'Vehicle'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="hidden w-full h-full flex items-center justify-center bg-enterprise-100 dark:bg-enterprise-900">
                                    <Truck className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center">
                                  <Truck className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {ticket.ticket_number || `ตั๋ว #${ticket.id}`}
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                    {ticket.repair_type || 'ตั๋วซ่อมบำรุง'} ·{' '}
                                    {ticket.vehicle_plate || '-'}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 truncate">
                                    {ticket.problem_description || 'ไม่มีคำอธิบาย'}
                                  </p>
                                </div>
                                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
                                  รออนุมัติ
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-700 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile?.full_name || user?.email || 'ผู้ใช้'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(() => {
                    // Only show loading if we're actually loading AND don't have profile
                    if (authLoading && !profile && !user) {
                      return 'กำลังโหลด...';
                    }
                    // If we have profile, show localized role label
                    if (profile?.role) {
                      return profile.role === 'admin' ? 'ผู้ดูแลระบบ' :
                        profile.role === 'manager' ? 'ผู้จัดการ' :
                          profile.role === 'inspector' ? 'ผู้ตรวจสอบ' :
                            profile.role === 'executive' ? 'ผู้บริหาร' :
                              profile.role === 'driver' ? 'พนักงานขับรถ' :
                                profile.role === 'sales' ? 'ฝ่ายขาย' :
                                  profile.role === 'service_staff' ? 'พนักงานบริการ' :
                                    profile.role === 'hr' ? 'บุคคล' :
                                      profile.role === 'accounting' ? 'บัญชี' :
                                        profile.role === 'warehouse' ? 'คลังสินค้า' :
                                          profile.role === 'dev' ? 'ผู้พัฒนา' :
                                            profile.role === 'user' ? 'ผู้ใช้ทั่วไป' :
                                              'ผู้ใช้ทั่วไป';
                    }
                    // If we have user but no profile AND not loading anymore, show default
                    if (user && !profile && !authLoading) {
                      return 'ผู้ใช้';
                    }
                    // Default fallback
                    return 'ผู้ใช้';
                  })()}
                  {/* Debug Role */}
                  {isRealDev && overriddenRole ? (
                    <span className="block text-[10px] text-amber-500 font-bold mt-0.5">
                      Dev Mode: จำลองสิทธิ์ ({profile?.role})
                    </span>
                  ) : (
                    <span className="block text-[10px] text-slate-300 opacity-50">
                      ({profile?.role || 'no-role'})
                    </span>
                  )}
                </p>
              </div>
              <Avatar
                src={profile?.avatar_url}
                alt={profile?.full_name || user?.email || 'User'}
                size="md"
                fallback={profile?.full_name || user?.email}
              />
            </div>
          </div>
        </header>

        {/* View Content - Lazy loaded views ใช้ Suspense เพื่อไม่ block หน้าแรก */}
        <div className="p-6 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto flex-1 flex flex-col">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[320px] text-slate-500 dark:text-slate-400">
              <span>กำลังโหลด...</span>
            </div>
          }>
            {(() => {
              const featureKey = TAB_TO_PRIMARY_FEATURE[activeTab];
              if (featureKey && featureOverrides[featureKey] === 'off' && !devBypassedFeatures.includes(featureKey)) {
                return (
                  <MaintenanceView
                    isDev={isDev}
                    featureName={activeTab}
                    onContact={() => {
                      // Optional: handle contact or refresh
                    }}
                    onBypass={() => setDevBypassedFeatures(prev => [...prev, featureKey])}
                  />
                );
              }
              return null;
            })() || (
                activeTab === 'dashboard' ? (
                  <DashboardView
                    onNavigateToVehicle={(vehicleId) => {
                      setActiveTab('vehicles');
                      setSelectedVehicleId(vehicleId);
                      setVehicleView('detail');
                    }}
                    isDark={isDark}
                    onNavigateToTickets={() => {
                      setActiveTab('maintenance');
                      setTicketView('list');
                    }}
                    onNavigateToTicketDetail={(ticketId) => {
                      setActiveTab('maintenance');
                      setSelectedTicketId(ticketId.toString());
                      setTicketView('detail');
                    }}
                    onNavigateToTripLogs={() => {
                      setActiveTab('triplogs');
                      setTripLogView('list');
                    }}
                    onCheckInTrip={(tripId) => {
                      setActiveTab('triplogs');
                      setTripLogMode('checkin');
                      setSelectedTripId(tripId);
                      setTripLogView('form');
                    }}
                  />
                ) : activeTab === 'vehicles' ? (
                  (() => {
                    console.log('[AppContent] ✅✅✅ ENTERED vehicles branch!');
                    console.log('[AppContent] ✅ activeTab is vehicles, vehicleView:', vehicleView, 'selectedVehicleId:', selectedVehicleId);

                    // Fix: If vehicleView is 'detail' but no selectedVehicleId, show list instead
                    const effectiveView = (vehicleView === 'detail' && !selectedVehicleId) ? 'list' : vehicleView;

                    if (effectiveView === 'list') {
                      console.log('[AppContent] ✅ Rendering VehiclesView (list)');
                      return (
                        <VehiclesView
                          onViewDetail={(id) => {
                            console.log('[AppContent] onViewDetail called:', id);
                            setSelectedVehicleId(id);
                            setVehicleView('detail');
                          }}
                          onEdit={(id) => {
                            console.log('[AppContent] onEdit called:', id);
                            setSelectedVehicleId(id);
                            setVehicleView('form');
                          }}
                          onCreate={() => {
                            console.log('[AppContent] onCreate called');
                            setSelectedVehicleId(undefined);
                            setVehicleView('form');
                          }}
                        />
                      );
                    } else if (effectiveView === 'detail' && selectedVehicleId) {
                      console.log('[AppContent] ✅ Rendering VehicleDetailView');
                      return (
                        <VehicleDetailView
                          vehicleId={selectedVehicleId}
                          onEdit={(id) => {
                            setSelectedVehicleId(id);
                            setVehicleView('form');
                          }}
                          onBack={() => {
                            setVehicleView('list');
                            setSelectedVehicleId(null);
                          }}
                          onViewTicket={(ticketId) => {
                            // ไปหน้ารายละเอียดตั๋วซ่อมบำรุง
                            setActiveTab('maintenance');
                            setSelectedTicketId(ticketId.toString());
                            setTicketView('detail');
                          }}
                          onViewDeliveryTrip={(deliveryTripId) => {
                            setSelectedDeliveryTripId(deliveryTripId);
                            setDeliveryTripView('detail');
                            setDeliveryTripReturnContext('vehicles');
                            setActiveTab('delivery-trips');
                          }}
                        />
                      );
                    } else if (effectiveView === 'form') {
                      console.log('[AppContent] ✅ Rendering VehicleFormView');
                      return (
                        <VehicleFormView
                          vehicleId={selectedVehicleId || undefined}
                          onSave={() => {
                            setVehicleView('list');
                            setSelectedVehicleId(null);
                          }}
                          onCancel={() => {
                            if (selectedVehicleId) {
                              setVehicleView('detail');
                            } else {
                              setVehicleView('list');
                              setSelectedVehicleId(null);
                            }
                          }}
                        />
                      );
                    }
                    console.log('[AppContent] ⚠️ No matching view - returning null');
                    return null;
                  })()
                ) : activeTab === 'maintenance' ? (
                  (() => {
                    console.log('[AppContent] Maintenance tab - rendering:', {
                      isDriver,
                      ticketView,
                      selectedTicketId,
                      willRenderTicketsView: !isDriver && ticketView === 'list'
                    });

                    // For drivers, show the form by default if they are in list view
                    if (isDriver && ticketView === 'list') {
                      return (
                        <TicketFormView
                          onSave={() => {
                            window.location.reload();
                          }}
                          onCancel={() => {
                            // Do nothing or reset form
                          }}
                        />
                      );
                    } else if (ticketView === 'list') {
                      console.log('[AppContent] Rendering TicketsView');
                      return (
                        <TicketsView
                          onViewDetail={(id) => {
                            setSelectedTicketId(id.toString());
                            setTicketView('detail');
                          }}
                          onCreate={() => {
                            setSelectedTicketId(null);
                            setTicketView('form');
                          }}
                        />
                      );
                    } else if (ticketView === 'detail' && selectedTicketId) {
                      console.log('[AppContent] Rendering TicketDetailView with ticketId:', selectedTicketId);
                      // Convert string to number if needed
                      const ticketIdNum = typeof selectedTicketId === 'string' ? parseInt(selectedTicketId, 10) : selectedTicketId;
                      if (isNaN(ticketIdNum) || ticketIdNum <= 0) {
                        console.error('[AppContent] Invalid ticketId, resetting to list');
                        // Reset state immediately
                        setTimeout(() => {
                          setTicketView('list');
                          setSelectedTicketId(null);
                        }, 0);
                        // Show TicketsView as fallback
                        return (
                          <TicketsView
                            onViewDetail={(id) => {
                              setSelectedTicketId(id.toString());
                              setTicketView('detail');
                            }}
                            onCreate={() => {
                              setSelectedTicketId(null);
                              setTicketView('form');
                            }}
                          />
                        );
                      }
                      return (
                        <TicketDetailView
                          ticketId={ticketIdNum}
                          onBack={() => {
                            setTicketView('list');
                            setSelectedTicketId(null);
                          }}
                          onEdit={(id) => {
                            setSelectedTicketId(id.toString());
                            setTicketView('form');
                          }}
                        />
                      );
                    } else if (ticketView === 'form') {
                      const ticketIdNumForForm = selectedTicketId ? parseInt(selectedTicketId, 10) : NaN;
                      const ticketIdForForm =
                        !isNaN(ticketIdNumForForm) && ticketIdNumForForm > 0
                          ? ticketIdNumForForm
                          : undefined;
                      return (
                        <TicketFormView
                          ticketId={ticketIdForForm}
                          onSave={() => {
                            setTicketView('list');
                            setSelectedTicketId(null);
                          }}
                          onCancel={() => {
                            if (selectedTicketId) {
                              setTicketView('detail');
                            } else {
                              setTicketView('list');
                              setSelectedTicketId(null);
                            }
                          }}
                        />
                      );
                    }

                    // Fallback: Show TicketsView if state is invalid
                    console.warn('[AppContent] Invalid state, resetting and showing TicketsView');
                    // Reset state immediately using setTimeout to avoid state update during render
                    setTimeout(() => {
                      setTicketView('list');
                      setSelectedTicketId(null);
                    }, 0);
                    return (
                      <TicketsView
                        onViewDetail={(id) => {
                          setSelectedTicketId(id.toString());
                          setTicketView('detail');
                        }}
                        onCreate={() => {
                          setSelectedTicketId(null);
                          setTicketView('form');
                        }}
                      />
                    );
                  })()
                ) : activeTab === 'triplogs' ? (
                  // For drivers, always show form, never list
                  isDriver ? (
                    <TripLogFormView
                      vehicleId={selectedVehicleId || undefined}
                      tripId={selectedTripId || undefined}
                      mode={tripLogMode}
                      onSave={() => {
                        // For drivers, stay on form but reset
                        setSelectedTripId(null);
                        setSelectedVehicleId(null);
                        setTripLogMode('checkout');
                        // Optional: Reload to ensure fresh state if needed, but component state reset should be enough
                      }}
                      onCancel={() => {
                        // Drivers can't go back to list, so just reset
                        setSelectedTripId(null);
                        setSelectedVehicleId(null);
                        setTripLogMode('checkout');
                      }}
                    />
                  ) : tripLogView === 'list' ? (
                    <TripLogListView
                      onCreateCheckout={() => {
                        setTripLogMode('checkout');
                        setTripLogView('form');
                        setSelectedTripId(null);
                      }}
                      onCreateCheckin={(tripId) => {
                        setTripLogMode('checkin');
                        setSelectedTripId(tripId);
                        setTripLogView('form');
                      }}
                      onViewDeliveryTrip={(deliveryTripId) => {
                        setSelectedDeliveryTripId(deliveryTripId);
                        setDeliveryTripView('detail');
                        setDeliveryTripReturnContext('triplogs');
                        setActiveTab('delivery-trips');
                      }}
                    />
                  ) : tripLogView === 'form' ? (
                    <TripLogFormView
                      vehicleId={selectedVehicleId || undefined}
                      tripId={selectedTripId || undefined}
                      mode={tripLogMode}
                      onSave={() => {
                        setTripLogView('list');
                        setSelectedTripId(null);
                        setSelectedVehicleId(null);
                      }}
                      onCancel={() => {
                        setTripLogView('list');
                        setSelectedTripId(null);
                        setSelectedVehicleId(null);
                      }}
                    />
                  ) : null
                ) : activeTab === 'fuellogs' ? (
                  fuelLogView === 'list' ? (
                    // Don't show list view for drivers - redirect to form
                    isDriver ? (
                      <FuelLogFormView
                        vehicleId={selectedVehicleId || undefined}
                        onSave={() => {
                          // Stay on form for drivers, don't redirect to list
                          setSelectedVehicleId(null);
                        }}
                        onCancel={() => {
                          // For drivers, cancel goes back to triplogs form
                          setActiveTab('triplogs');
                          setTripLogView('form');
                          setSelectedVehicleId(null);
                        }}
                      />
                    ) : (
                      <FuelLogListView
                        onCreate={() => {
                          setFuelLogView('form');
                        }}
                      />
                    )
                  ) : fuelLogView === 'form' ? (
                    <FuelLogFormView
                      vehicleId={selectedVehicleId || undefined}
                      onSave={() => {
                        // For drivers, stay on form; for others, go to list
                        if (isDriver) {
                          setSelectedVehicleId(null);
                        } else {
                          setFuelLogView('list');
                          setSelectedVehicleId(null);
                        }
                      }}
                      onCancel={() => {
                        // For drivers, cancel goes back to triplogs form; for others, go to list
                        if (isDriver) {
                          setActiveTab('triplogs');
                          setTripLogView('form');
                          setSelectedVehicleId(null);
                        } else {
                          setFuelLogView('list');
                          setSelectedVehicleId(null);
                        }
                      }}
                    />
                  ) : null
                ) : activeTab === 'approvals' ? (
                  // Check permissions - check role directly from profile for reliability
                  (() => {
                    // Show loading only if we truly don't have profile yet
                    if (!profile && authLoading) {
                      return (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                          <CheckSquare size={48} className="mb-4 opacity-50 animate-pulse" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">กำลังตรวจสอบสิทธิ์...</p>
                        </div>
                      );
                    }

                    // Check role directly from profile (more reliable than isManager flags)
                    const hasPermission = can('tab.approvals', 'view');

                    if (hasPermission) {
                      return (
                        <ApprovalBoardView
                          onViewDetail={(ticketId) => {
                            setActiveTab('maintenance');
                            setSelectedTicketId(ticketId.toString());
                            setTicketView('detail');
                          }}
                        />
                      );
                    }

                    // No permission - show error message
                    return (
                      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                        <CheckSquare size={48} className="mb-4 opacity-50" />
                        <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300">ไม่มีสิทธิ์เข้าถึง</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          หน้านี้จำกัดสำหรับผู้ตรวจสอบ, ผู้จัดการ, ผู้บริหาร และผู้ดูแลระบบเท่านั้น
                        </p>
                        <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-left">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">ข้อมูล Debug:</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            บทบาท: {profile?.role || 'ไม่พบข้อมูล'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            isAdmin: {isAdmin ? 'true' : 'false'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            isManager: {isManager ? 'true' : 'false'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            isInspector: {isInspector ? 'true' : 'false'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            isExecutive: {isExecutive ? 'true' : 'false'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Profile ID: {profile?.id || 'ไม่มี'}
                          </p>
                        </div>
                      </div>
                    );
                  })()
                ) : activeTab === 'profile' ? (
                  <ProfileView />
                ) : activeTab === 'role-feature-access' ? (
                  <RoleFeatureAccessSettingsView />
                ) : activeTab === 'daily-summary' ? (
                  <DailySummaryView
                    isDark={isDark}
                    onViewDeliveryTrip={(deliveryTripId) => {
                      setSelectedDeliveryTripId(deliveryTripId);
                      setDeliveryTripView('detail');
                      setDeliveryTripReturnContext('daily-summary');
                      setActiveTab('delivery-trips');
                    }}
                  />
                ) : activeTab === 'reports' ? (
                  storeDetailView === 'detail' && selectedStoreId ? (
                    <StoreDeliveryDetailView
                      storeId={selectedStoreId}
                      onBack={() => {
                        setStoreDetailView('list');
                        setSelectedStoreId(null);
                      }}
                      isDark={isDark}
                    />
                  ) : (
                    <ReportsView
                      key={reportsInitialTab ? `reports-${reportsInitialTab}` : 'reports'}
                      isDark={isDark}
                      initialTab={reportsInitialTab ?? undefined}
                      onNavigateToStoreDetail={(storeId) => {
                        setSelectedStoreId(storeId);
                        setStoreDetailView('detail');
                      }}
                      onNavigateToVehicleDetail={(vehicleId) => {
                        setActiveTab('vehicles');
                        setSelectedVehicleId(vehicleId);
                        setVehicleView('detail');
                      }}
                      onNavigateToTrip={(tripId) => {
                        setDeliveryTripReturnContext('reports');
                        setReportsInitialTab('trip-pnl');
                        setActiveTab('delivery-trips');
                        setSelectedDeliveryTripId(tripId);
                        setDeliveryTripView('detail');
                      }}
                    />
                  )
                ) : activeTab === 'settings' ? (
                  <SettingsView />
                ) : activeTab === 'delivery-trips' ? (
                  (() => {
                    if (deliveryTripView === 'metrics' && selectedDeliveryTripId) {
                      return (
                        <TripMetricsView
                          tripId={selectedDeliveryTripId}
                          onSaved={() => setDeliveryTripView('detail')}
                          onBack={() => setDeliveryTripView('detail')}
                        />
                      );
                    }
                    if (deliveryTripView === 'detail' && selectedDeliveryTripId) {
                      return (
                        <DeliveryTripDetailView
                          tripId={selectedDeliveryTripId}
                          onEdit={(tripId) => {
                            setSelectedDeliveryTripId(tripId);
                            setDeliveryTripView('form');
                          }}
                          onRecordMetrics={() => setDeliveryTripView('metrics')}
                          onBack={() => {
                            // กลับไปหน้าที่เข้ามาล่าสุด
                            if (deliveryTripReturnContext === 'triplogs') {
                              setActiveTab('triplogs');
                            } else if (deliveryTripReturnContext === 'daily-summary') {
                              setActiveTab('daily-summary');
                            } else if (deliveryTripReturnContext === 'vehicles') {
                              setActiveTab('vehicles');
                              setVehicleView('detail');
                            } else if (deliveryTripReturnContext === 'service-staff-usage') {
                              setActiveTab('service-staff');
                              setServiceStaffView('usage');
                            } else if (deliveryTripReturnContext === 'reports') {
                              setActiveTab('reports');
                            } else {
                              // ค่าเริ่มต้น: กลับไปหน้ารายการทริปส่งสินค้า
                              setActiveTab('delivery-trips');
                              setDeliveryTripView('list');
                            }
                            setSelectedDeliveryTripId(null);
                            setDeliveryTripView('list');
                          }}
                        />
                      );
                    } else if (deliveryTripView === 'form') {
                      return (
                        <DeliveryTripFormView
                          tripId={selectedDeliveryTripId || undefined}
                          onSave={() => {
                            setDeliveryTripView('list');
                            setSelectedDeliveryTripId(null);
                          }}
                          onCancel={() => {
                            if (selectedDeliveryTripId) {
                              setDeliveryTripView('detail');
                            } else {
                              setDeliveryTripView('list');
                              setSelectedDeliveryTripId(null);
                            }
                          }}
                        />
                      );
                    } else {
                      return (
                        <DeliveryTripListView
                          onViewDetail={(tripId) => {
                            setSelectedDeliveryTripId(tripId);
                            setDeliveryTripView('detail');
                            setDeliveryTripReturnContext('delivery-list');
                          }}
                          onCreate={() => {
                            setSelectedDeliveryTripId(null);
                            setDeliveryTripView('form');
                          }}
                        />
                      );
                    }
                  })()
                ) : activeTab === 'admin-staff' ? (
                  <AdminStaffManagementView />
                ) : activeTab === 'service-staff' ? (
                  serviceStaffView === 'usage' && selectedServiceStaffId ? (
                    <StaffVehicleUsageView
                      staffId={selectedServiceStaffId}
                      initialState={
                        serviceStaffUsageNavState?.staffId === selectedServiceStaffId
                          ? {
                            from: serviceStaffUsageNavState.from,
                            to: serviceStaffUsageNavState.to,
                            page: serviceStaffUsageNavState.page,
                            scrollY: serviceStaffUsageNavState.scrollY,
                          }
                          : undefined
                      }
                      onViewTrip={(tripId, state) => {
                        setServiceStaffUsageNavState({
                          staffId: selectedServiceStaffId,
                          from: state.from,
                          to: state.to,
                          page: state.page,
                          scrollY: state.scrollY,
                        });
                        setSelectedDeliveryTripId(tripId);
                        setDeliveryTripView('detail');
                        setDeliveryTripReturnContext('service-staff-usage');
                        setActiveTab('delivery-trips');
                      }}
                      onBack={() => {
                        setServiceStaffView('list');
                        setSelectedServiceStaffId(null);
                      }}
                    />
                  ) : (
                    <ServiceStaffManagementView
                      onViewUsage={(staffId: string) => {
                        setSelectedServiceStaffId(staffId);
                        setServiceStaffView('usage');
                        setActiveTab('service-staff');
                      }}
                    />
                  )
                ) : activeTab === 'commission' ? (
                  <CommissionManagementView />
                ) : activeTab === 'commission-rates' ? (
                  <CommissionRatesView />
                ) : activeTab === 'stock-dashboard' ? (
                  <StockDashboardView />
                ) : activeTab === 'products' ? (
                  <ProductsManagementView />
                ) : activeTab === 'warehouses' ? (
                  <WarehouseManagementView />
                ) : activeTab === 'inventory-receipts' ? (
                  <InventoryReceiptsView />
                ) : activeTab === 'purchase-receipts' ? (
                  <PurchaseReceiptsManageView />
                ) : activeTab === 'customer-tiers' ? (
                  <CustomerTiersManagementView />
                ) : activeTab === 'product-pricing' ? (
                  <ProductTierPricingView />
                ) : activeTab === 'excel-import' ? (
                  <ExcelImportView />
                ) : activeTab === 'customer-import' ? (
                  <CustomerImportView />
                ) : activeTab === 'customers' ? (
                  <CustomerManagementView />
                ) : activeTab === 'create-order' ? (
                  <CreateOrderView
                    onNavigateToConfirmOrders={() => setActiveTab('confirm-orders')}
                    onNavigateToPendingSales={() => setActiveTab('pending-sales')}
                  />
                ) : activeTab === 'pending-sales' ? (
                  <PendingSalesView />
                ) : activeTab === 'track-orders' ? (
                  <TrackOrdersView />
                ) : activeTab === 'confirm-orders' ? (
                  <ConfirmOrderView />
                ) : activeTab === 'pending-orders' ? (
                  <PendingOrdersView />
                ) : activeTab === 'trip-planning-board' ? (
                  <TripPlanningBoardView />
                ) : activeTab === 'partial-delivery' ? (
                  <PartialDeliveryOrdersView />
                ) : activeTab === 'packing-simulation' ? (
                  <PackingSimulationView />
                ) : activeTab === 'sales-trips' ? (
                  <SalesTripsView />
                ) : activeTab === 'cleanup-test-orders' ? (
                  <CleanupTestOrdersView />
                ) : activeTab === 'db-explorer' ? (
                  <DatabaseExplorerView />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                    <Wrench size={48} className="mb-4 opacity-50" />
                    <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300">กำลังพัฒนา</h3>
                    <p>โมดูล {activeTab} กำลังอยู่ระหว่างการพัฒนา</p>
                  </div>
                ))}
          </Suspense>
        </div>

      </main>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="ยืนยันการออกจากระบบ"
        message="คุณต้องการออกจากระบบหรือไม่? หลังจากออกจากระบบ คุณจะต้องเข้าสู่ระบบใหม่เพื่อใช้งานระบบ"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        variant="warning"
        onConfirm={async () => {
          try {
            await signOut();
            setShowLogoutConfirm(false);
          } catch (error) {
            console.error('Error signing out:', error);
            setShowLogoutConfirm(false);
          }
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      {/* Debug Tools for Dev role */}
      <DebugTools onTabChange={(tab) => setActiveTab(tab)} />
    </div>
  );
};

// Main App with Authentication
const App = () => {
  return (
    <DebugDataProvider>
      <FeatureAccessProvider>
        <ProtectedRoute>
          <AppContent />
        </ProtectedRoute>
      </FeatureAccessProvider>
    </DebugDataProvider>
  );
};

// Error boundary for rendering - use singleton pattern to prevent multiple root creation
let rootInstance: ReturnType<typeof createRoot> | null = null;

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Check if root already exists, reuse it instead of creating new one
  if (!rootInstance) {
    rootInstance = createRoot(rootElement);
  }

  rootInstance.render(<App />);
} catch (error) {
  console.error('Failed to render app:', error);
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; padding: 20px; text-align: center;">
      <h1 style="color: #ef4444; margin-bottom: 16px;">เกิดข้อผิดพลาดในการโหลดแอป</h1>
      <p style="color: #64748b; margin-bottom: 8px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 16px;">
        กรุณาตรวจสอบ Browser Console (F12) สำหรับรายละเอียดเพิ่มเติม
      </p>
      <button 
        onclick="location.reload()" 
        style="margin-top: 24px; padding: 12px 24px; background: #0ea5e9; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;"
      >
        โหลดใหม่
      </button>
    </div>
  `;
}
