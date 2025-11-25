import React, { useState, useEffect } from 'react';
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
  Search,
  LogOut,
  User,
  Shield,
  CheckSquare,
  Route
} from 'lucide-react';
import { DashboardView } from './views/DashboardView';
import { ProfileView } from './views/ProfileView';
import { RLSTestView } from './views/RLSTestView';
import { VehiclesView } from './views/VehiclesView';
import { VehicleDetailView } from './views/VehicleDetailView';
import { VehicleFormView } from './views/VehicleFormView';
import { TicketsView } from './views/TicketsView';
import { TicketDetailView } from './views/TicketDetailView';
import { TicketFormView } from './views/TicketFormView';
import { ApprovalBoardView } from './views/ApprovalBoardView';
import { TripLogFormView } from './views/TripLogFormView';
import { TripLogListView } from './views/TripLogListView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth, usePendingTickets } from './hooks';
import { prefetchService } from './services/prefetchService';

const SidebarItem = ({ icon: Icon, label, active, onClick, onMouseEnter, isCollapsed }: any) => (
  <button
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg transition-colors duration-200 ${active
      ? 'bg-enterprise-50 text-enterprise-600 dark:bg-enterprise-900/30 dark:text-enterprise-400 font-medium'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
      }`}
  >
    <Icon size={isCollapsed ? 24 : 20} />
    {!isCollapsed && <span>{label}</span>}
  </button>
);

// Main App Content (wrapped in ProtectedRoute)
const AppContent = () => {
  const { user, profile, signOut, isAdmin, isManager, isInspector, isExecutive, isDriver, loading: authLoading, refreshProfile } = useAuth();

  // Don't wait for profile - show UI immediately if user exists
  // Profile will load in background and update when ready
  const { count: pendingCount } = usePendingTickets();
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


  // Redirect drivers to trip log form page when they login (like maintenance form)
  // Drivers can access: triplogs, maintenance, profile, settings
  useEffect(() => {
    if (isDriver) {
      // If driver tries to access restricted areas, redirect to triplogs form
      if (activeTab !== 'triplogs' && activeTab !== 'maintenance' && activeTab !== 'profile' && activeTab !== 'settings') {
        setActiveTab('triplogs');
        setTripLogView('form');
        setTripLogMode('checkout');
      }
      // If driver is on dashboard or other restricted pages, redirect to triplogs form
      else if (activeTab === 'dashboard' || activeTab === 'vehicles' || activeTab === 'approvals' || activeTab === 'reports') {
        setActiveTab('triplogs');
        setTripLogView('form');
        setTripLogMode('checkout');
      }
    }
  }, [isDriver, activeTab]);

  // Set initial tab for drivers when profile loads - go directly to form
  useEffect(() => {
    if (isDriver && activeTab === 'dashboard') {
      setActiveTab('triplogs');
      setTripLogView('form');
      setTripLogMode('checkout');
    }
  }, [isDriver, profile]);

  // Force refresh profile on mount to ensure role is up to date
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

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
  const [vehicleView, setVehicleView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [ticketView, setTicketView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tripLogView, setTripLogView] = useState<'list' | 'form'>('list');
  const [tripLogMode, setTripLogMode] = useState<'checkout' | 'checkin'>('checkout');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

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

  // Prefetch common data on mount for faster navigation
  useEffect(() => {
    // Prefetch dashboard and vehicles immediately (most common pages)
    prefetchService.prefetchDashboard();
    prefetchService.prefetchVehicles();

    // Prefetch tickets after a short delay (less critical)
    setTimeout(() => {
      prefetchService.prefetchTicketsWithRelations();
    }, 500);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-charcoal-950 flex font-sans selection:bg-enterprise-500 selection:text-white">

      {/* Sidebar */}
      <aside
        className={`${sidebarWidthClass} ${sidebarTransformClass} bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-md border-r border-slate-200 dark:border-slate-800/50 flex flex-col transition-all duration-300 fixed h-full z-30 ${isMobile ? 'shadow-2xl' : ''}`}
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

        <div className="flex-1 px-3 space-y-1 mt-4">
          {!isDriver && (
            <SidebarItem
              icon={LayoutDashboard}
              label={isSidebarOpen ? "แดชบอร์ด" : ""}
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              onMouseEnter={() => prefetchService.prefetchDashboard()}
              isCollapsed={!isSidebarOpen}
            />
          )}
          {!isDriver && (
            <SidebarItem
              icon={Truck}
              label={isSidebarOpen ? "ยานพาหนะ" : ""}
              active={activeTab === 'vehicles'}
              onClick={() => setActiveTab('vehicles')}
              onMouseEnter={() => prefetchService.prefetchVehicles()}
              isCollapsed={!isSidebarOpen}
            />
          )}
          <SidebarItem
            icon={Wrench}
            label={isSidebarOpen ? "การซ่อมบำรุง" : ""}
            active={activeTab === 'maintenance'}
            onClick={() => setActiveTab('maintenance')}
            onMouseEnter={() => prefetchService.prefetchTicketsWithRelations()}
            isCollapsed={!isSidebarOpen}
          />
          <SidebarItem
            icon={Route}
            label={isSidebarOpen ? "บันทึกการใช้งานรถ" : ""}
            active={activeTab === 'triplogs'}
            onClick={() => {
              setActiveTab('triplogs');
              setTripLogView('list');
            }}
            isCollapsed={!isSidebarOpen}
          />
          {/* Show approval board menu - check role directly for reliability */}
          {(() => {
            const userRole = profile?.role?.toLowerCase();
            const hasPermission = userRole === 'admin' ||
              userRole === 'manager' ||
              userRole === 'inspector' ||
              userRole === 'executive' ||
              isAdmin || isInspector || isManager || isExecutive || authLoading;

            return hasPermission ? (
              <SidebarItem
                icon={CheckSquare}
                label={isSidebarOpen ? "ภาพรวมการอนุมัติ" : ""}
                active={activeTab === 'approvals'}
                onClick={() => setActiveTab('approvals')}
                onMouseEnter={() => prefetchService.prefetchTicketsWithRelations()}
                isCollapsed={!isSidebarOpen}
              />
            ) : null;
          })()}
          {!isDriver && (
            <SidebarItem
              icon={FileText}
              label={isSidebarOpen ? "รายงาน" : ""}
              active={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
              isCollapsed={!isSidebarOpen}
            />
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 space-y-1">
          <SidebarItem icon={User} label={isSidebarOpen ? "โปรไฟล์" : ""} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} isCollapsed={!isSidebarOpen} />
          {(isAdmin || isManager) && (
            <SidebarItem icon={Shield} label={isSidebarOpen ? "ทดสอบ RLS" : ""} active={activeTab === 'rls-test'} onClick={() => setActiveTab('rls-test')} isCollapsed={!isSidebarOpen} />
          )}
          <SidebarItem icon={Settings} label={isSidebarOpen ? "ตั้งค่า" : ""} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isCollapsed={!isSidebarOpen} />
          <SidebarItem icon={LogOut} label={isSidebarOpen ? "ออกจากระบบ" : ""} onClick={async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            }
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
      <main className={`flex-1 flex flex-col transition-all duration-300 ${contentMarginClass}`}>

        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Menu size={20} />
            </button>
            <div className="ml-4 hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-1.5 border border-transparent focus-within:border-enterprise-500 dark:focus-within:border-neon-blue transition-colors">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหายานพาหนะ..."
                className="bg-transparent border-none outline-none text-sm ml-2 w-64 text-slate-700 dark:text-slate-200 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-yellow-400 transition-colors">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 relative"
              title={pendingCount > 0 ? `${pendingCount} ตั๋วรออนุมัติ` : 'การแจ้งเตือน'}
            >
              <Bell size={20} />
              {pendingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white dark:border-charcoal-900 flex items-center justify-center text-xs text-white font-semibold px-1">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
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
                    // If we have profile, show role
                    if (profile?.role) {
                      return profile.role === 'admin' ? 'ผู้ดูแลระบบ' :
                        profile.role === 'manager' ? 'ผู้จัดการ' :
                          profile.role === 'inspector' ? 'ผู้ตรวจสอบ' :
                            profile.role === 'executive' ? 'ผู้บริหาร' :
                              profile.role === 'driver' ? 'พนักงานขับรถ' :
                                'ผู้ใช้';
                    }
                    // If we have user but no profile AND not loading anymore, show default
                    if (user && !profile && !authLoading) {
                      return 'ผู้ใช้';
                    }
                    // Default fallback
                    return 'ผู้ใช้';
                    return 'ผู้ใช้';
                  })()}
                  {/* Debug Role */}
                  <span className="block text-[10px] text-slate-300 opacity-50">
                    ({profile?.role || 'no-role'})
                  </span>
                </p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-enterprise-500 to-neon-blue rounded-full shadow-md"></div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="p-6">
          {activeTab === 'dashboard' ? (
            <DashboardView
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
            vehicleView === 'list' ? (
              <VehiclesView
                onViewDetail={(id) => {
                  setSelectedVehicleId(id);
                  setVehicleView('detail');
                }}
                onEdit={(id) => {
                  setSelectedVehicleId(id);
                  setVehicleView('form');
                }}
                onCreate={() => {
                  setSelectedVehicleId(undefined);
                  setVehicleView('form');
                }}
              />
            ) : vehicleView === 'detail' && selectedVehicleId ? (
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
              />
            ) : vehicleView === 'form' ? (
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
            ) : null
          ) : activeTab === 'maintenance' ? (
            // For drivers, show the form by default if they are in list view
            isDriver && ticketView === 'list' ? (
              <TicketFormView
                onSave={() => {
                  // After save, maybe show success or reset?
                  // For now, let's keep them on the form but clear it (handled by component)
                  // Or we could show a "History" list if we wanted.
                  // But user said "only form". 
                  // Let's reload the page or reset the view to ensure fresh state
                  window.location.reload();
                }}
                onCancel={() => {
                  // Do nothing or reset form
                }}
              />
            ) : ticketView === 'list' ? (
              <TicketsView
                onViewDetail={(id) => {
                  setSelectedTicketId(id);
                  setTicketView('detail');
                }}
                onCreate={() => {
                  setSelectedTicketId(null);
                  setTicketView('form');
                }}
              />
            ) : ticketView === 'detail' && selectedTicketId ? (
              <TicketDetailView
                ticketId={selectedTicketId}
                onBack={() => {
                  setTicketView('list');
                  setSelectedTicketId(null);
                }}
                onEdit={(id) => {
                  setSelectedTicketId(id);
                  setTicketView('form');
                }}
              />
            ) : ticketView === 'form' ? (
              <TicketFormView
                ticketId={selectedTicketId || undefined}
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
            ) : null
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
              const userRole = profile?.role?.toLowerCase();
              const hasPermission = userRole === 'admin' ||
                userRole === 'manager' ||
                userRole === 'inspector' ||
                userRole === 'executive' ||
                isAdmin || isInspector || isManager || isExecutive; // Fallback to flags

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
          ) : activeTab === 'rls-test' ? (
            <RLSTestView />
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
              <Wrench size={48} className="mb-4 opacity-50" />
              <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300">กำลังพัฒนา</h3>
              <p>โมดูล {activeTab === 'reports' ? 'รายงาน' : activeTab === 'settings' ? 'ตั้งค่า' : activeTab} กำลังอยู่ระหว่างการพัฒนา</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

// Main App with Authentication
const App = () => {
  return (
    <ProtectedRoute>
      <AppContent />
    </ProtectedRoute>
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
