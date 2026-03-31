import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AppRole } from '../../types/database';
import { 
  Shield, 
  User, 
  Truck, 
  Briefcase, 
  CheckSquare, 
  DollarSign, 
  Users, 
  Award, 
  Terminal,
  Package,
  Landmark,
  UserCircle,
  RefreshCcw,
  ChevronRight
} from 'lucide-react';

const ROLE_CONFIG: Record<AppRole, { label: string; icon: any; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-rose-500 bg-rose-50' },
  manager: { label: 'Manager', icon: Briefcase, color: 'text-amber-500 bg-amber-50' },
  inspector: { label: 'Inspector', icon: CheckSquare, color: 'text-emerald-500 bg-emerald-50' },
  executive: { label: 'Executive', icon: Award, color: 'text-purple-500 bg-purple-50' },
  driver: { label: 'Driver', icon: Truck, color: 'text-blue-500 bg-blue-50' },
  sales: { label: 'Sales', icon: DollarSign, color: 'text-green-500 bg-green-50' },
  service_staff: { label: 'Service Staff', icon: Users, color: 'text-indigo-500 bg-indigo-50' },
  hr: { label: 'HR', icon: UserCircle, color: 'text-pink-500 bg-pink-50' },
  accounting: { label: 'Accounting', icon: Landmark, color: 'text-cyan-500 bg-cyan-50' },
  warehouse: { label: 'Warehouse', icon: Package, color: 'text-orange-500 bg-orange-50' },
  user: { label: 'User (ReadOnly)', icon: User, color: 'text-slate-500 bg-slate-50' },
  dev: { label: 'Developer', icon: Terminal, color: 'text-violet-600 bg-violet-50' },
};

export const RoleSwitcher: React.FC = () => {
  const { isDev, overriddenRole, setOverriddenRole, profile } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isDev) return null;

  const currentRole = overriddenRole || (profile?.role as AppRole) || 'dev';
  const roleInfo = ROLE_CONFIG[currentRole] || ROLE_CONFIG.dev;
  const RoleIcon = roleInfo.icon;

  const handleRoleChange = (role: AppRole | null) => {
    setOverriddenRole(role);
    setIsOpen(false);
    // Optional: add a toast message here if available
    window.location.reload(); // Reload to ensure all role-based layout logic re-mounts clean
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 border-bottom border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Switch Role</span>
            <button 
              onClick={() => handleRoleChange(null)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-enterprise-600"
              title="Reset to Real Role"
            >
              <RefreshCcw size={14} />
            </button>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto p-2">
            {(Object.entries(ROLE_CONFIG) as [AppRole, typeof roleInfo][]).map(([role, info]) => {
              const Icon = info.icon;
              const isActive = currentRole === role;
              
              return (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`w-full flex items-center p-2.5 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-enterprise-50 dark:bg-enterprise-900/20 text-enterprise-700 dark:text-enterprise-400 font-medium border border-enterprise-100 dark:border-enterprise-800/50' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg mr-3 transition-colors ${
                    isActive ? info.color : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 text-slate-500'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <span className="flex-1 text-left text-sm">{info.label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-enterprise-500 shadow-[0_0_8px_rgba(37,99,235,0.5)]"></div>}
                </button>
              );
            })}
          </div>
          
          <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-center text-slate-400">
              Dev Mode Active • Real Role: <span className="font-bold text-slate-500">{profile?.role}</span>
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-3 p-1 pr-4 rounded-full shadow-lg transition-all duration-300 border-2 ${
          isOpen 
            ? 'bg-enterprise-600 border-enterprise-500 text-white translate-y-[-4px]' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:shadow-xl hover:translate-y-[-4px]'
        }`}
      >
        <div className={`p-2 rounded-full ${isOpen ? 'bg-white/20' : roleInfo.color + ' shadow-sm'}`}>
          {isOpen ? <ChevronRight className="rotate-90 transform" size={20} /> : <RoleIcon size={20} />}
        </div>
        {!isOpen && (
          <div className="flex flex-col items-start leading-none pointer-events-none">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Impersonating</span>
            <span className="text-sm font-bold">{roleInfo.label}</span>
          </div>
        )}
        {isOpen && <span className="font-bold">Close Panel</span>}
      </button>
    </div>
  );
};
