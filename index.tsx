import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
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
  LogOut
} from 'lucide-react';
import { DashboardView } from './views/DashboardView';

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
      active 
      ? 'bg-enterprise-50 text-enterprise-600 dark:bg-slate-800 dark:text-neon-blue font-medium' 
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const App = () => {
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-charcoal-950 flex font-sans selection:bg-enterprise-500 selection:text-white">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-charcoal-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 fixed h-full z-20`}>
        <div className="p-6 flex items-center justify-center">
          <div className="w-10 h-10 bg-enterprise-600 dark:bg-neon-blue rounded-lg flex items-center justify-center shadow-lg shadow-enterprise-500/30">
             <Truck className="text-white" size={24} />
          </div>
          {isSidebarOpen && (
             <div className="ml-3">
               <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">กอง<span className="text-enterprise-600 dark:text-neon-blue">ยาน</span></h1>
             </div>
          )}
        </div>

        <div className="flex-1 px-3 space-y-1 mt-4">
          <SidebarItem icon={LayoutDashboard} label={isSidebarOpen ? "แดชบอร์ด" : ""} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Truck} label={isSidebarOpen ? "ยานพาหนะ" : ""} active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
          <SidebarItem icon={Wrench} label={isSidebarOpen ? "การซ่อมบำรุง" : ""} active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
          <SidebarItem icon={FileText} label={isSidebarOpen ? "รายงาน" : ""} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <SidebarItem icon={Settings} label={isSidebarOpen ? "ตั้งค่า" : ""} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <SidebarItem icon={LogOut} label={isSidebarOpen ? "ออกจากระบบ" : ""} onClick={() => console.log('logout')} />
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        
        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
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
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-charcoal-900"></span>
            </button>
            <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-700 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">ผู้ดูแลระบบ</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">ผู้จัดการกองยาน</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-enterprise-500 to-neon-blue rounded-full shadow-md"></div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="p-6">
          {activeTab === 'dashboard' ? (
            <DashboardView isDark={isDark} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
              <Wrench size={48} className="mb-4 opacity-50" />
              <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300">กำลังพัฒนา</h3>
              <p>โมดูล {activeTab === 'vehicles' ? 'ยานพาหนะ' : activeTab === 'maintenance' ? 'การซ่อมบำรุง' : activeTab === 'reports' ? 'รายงาน' : activeTab === 'settings' ? 'ตั้งค่า' : activeTab} กำลังอยู่ระหว่างการพัฒนา</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
