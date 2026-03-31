import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDebugStore } from '../../stores/debugStore';
import { useDebugDataContext } from '../../context/DebugDataContext';
import { AppRole } from '../../types/database';
import { TAB_TO_PRIMARY_FEATURE, FeatureKey } from '../../types/featureAccess';
import { 
  Shield, User, Truck, Briefcase, CheckSquare, DollarSign, 
  Users, Award, Terminal, Package, Landmark, UserCircle,
  RefreshCcw, ChevronRight, X, Bug, Database, Zap, 
  Navigation, ToggleRight, Settings2, Trash2, Search,
  Eye, CornerDownRight, ExternalLink
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

export const DebugTools: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const { isDev, overriddenRole, setOverriddenRole, profile } = useAuth();
  const { featureFlags, toggleFlag, resetFlags, panelTab, setPanelTab } = useDebugStore();
  const { dataMap, clearDebugData } = useDebugDataContext();
  
  const [isOpen, setIsOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const [inspectKey, setInspectKey] = useState<string | null>(null);

  if (!isDev) return null;

  const currentRole = overriddenRole || (profile?.role as AppRole) || 'dev';
  const roleInfo = ROLE_CONFIG[currentRole] || ROLE_CONFIG.dev;
  
  const handleClearCache = () => {
    if (confirm('ยืนยันหน้าการถอย? ระบบจะล้างข้อมูล LocalStorage และรีโหลดหน้าใหม่')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const jumpOptions = useMemo(() => {
    return Object.keys(TAB_TO_PRIMARY_FEATURE)
      .filter(tab => tab.toLowerCase().includes(jumpQuery.toLowerCase()))
      .sort();
  }, [jumpQuery]);

  const handleJump = (tab: string) => {
    onTabChange?.(tab);
    setIsOpen(false);
  };

  const renderRoleTab = () => (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      <div className="px-2 py-1 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
        <span>Select Identity</span>
        <button 
          onClick={() => { setOverriddenRole(null); window.location.reload(); }}
          className="text-enterprise-600 hover:underline"
        >
          Reset
        </button>
      </div>
      {(Object.entries(ROLE_CONFIG) as [AppRole, typeof roleInfo][]).map(([role, info]) => {
        const Icon = info.icon;
        const isActive = currentRole === role;
        return (
          <button
            key={role}
            onClick={() => { setOverriddenRole(role); window.location.reload(); }}
            className={`w-full flex items-center p-2 rounded-xl transition-all duration-200 ${
              isActive ? 'bg-enterprise-50 dark:bg-enterprise-900/30 text-enterprise-700 dark:text-enterprise-400 border border-enterprise-100 dark:border-enterprise-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-2 ${isActive ? info.color : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Icon size={16} />
            </div>
            <span className="text-xs font-medium">{info.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderInspectorTab = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      <div className="flex justify-between items-center px-2 py-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Data Points</span>
        <button onClick={clearDebugData} className="text-[10px] text-rose-500 hover:bg-rose-50 p-1 rounded">Clear</button>
      </div>
      {Object.keys(dataMap).length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs italic">No data registered via useDebugData</div>
      ) : (
        Object.entries(dataMap).map(([key, data]) => (
          <div key={key} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
            <button 
              onClick={() => setInspectKey(inspectKey === key ? null : key)}
              className="w-full flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Database size={14} className="text-enterprise-500" />
                <span className="text-xs font-mono font-bold truncate max-w-[120px]">{key}</span>
              </div>
              <ChevronRight size={14} className={`transform transition-transform ${inspectKey === key ? 'rotate-90' : ''}`} />
            </button>
            {inspectKey === key && (
              <div className="p-2 bg-slate-900 overflow-x-auto">
                <pre className="text-[10px] text-emerald-400 font-mono leading-tight whitespace-pre-wrap break-all">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderJumpTab = () => (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          autoFocus
          type="text" 
          value={jumpQuery}
          onChange={(e) => setJumpQuery(e.target.value)}
          placeholder="Search tabs..."
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-enterprise-500"
        />
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {jumpOptions.map(tab => (
          <button 
            key={tab}
            onClick={() => handleJump(tab)}
            className="w-full text-left p-2 rounded-lg hover:bg-enterprise-50 dark:hover:bg-enterprise-900/20 text-xs flex items-center justify-between group"
          >
            <span className="text-slate-600 dark:text-slate-300 group-hover:text-enterprise-600 font-medium">{tab}</span>
            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-enterprise-500" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderFlagsTab = () => (
    <div className="space-y-3 p-1">
      <div className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
        <span>Dev Flags</span>
        <button onClick={resetFlags} className="text-enterprise-500">Reset</button>
      </div>
      {Object.entries(featureFlags).map(([key, value]) => (
        <button 
          key={key} 
          onClick={() => toggleFlag(key as any)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${value ? 'bg-enterprise-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${value ? 'left-4.5' : 'left-0.5'}`} />
          </div>
        </button>
      ))}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
        <div className="flex items-start">
          <Zap size={14} className="text-amber-600 mt-0.5 mr-2" />
          <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-normal">Flags here are meant for testing UI variants without full deployments.</p>
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-2 p-1">
      <div className="px-1 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Actions</div>
      <button 
        onClick={handleClearCache}
        className="w-full flex items-center p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all font-bold text-xs"
      >
        <Trash2 size={16} className="mr-3" />
        Clear Cache & Reload App
      </button>

      <div className="mt-2 space-y-1">
        <div className="p-2 text-[10px] text-slate-400 text-center font-mono bg-slate-50 dark:bg-slate-800/50 rounded">
          v1.0.0-dev | {profile?.email}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 ring-4 ring-black/5">
          {/* Header */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-enterprise-500 rounded-lg shadow-lg shadow-enterprise-500/30">
                <Terminal size={14} className="text-white" />
              </div>
              <span className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-white">Debug Central</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
            >
              <X size={16} />
            </button>
          </div>

          {/* Sub Header Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 mx-4 mt-4 rounded-xl">
            {(['role', 'jump', 'inspector', 'flags', 'system'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${
                  panelTab === tab 
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-enterprise-600 dark:text-white' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={tab.toUpperCase()}
              >
                {tab === 'role' && <UserCircle size={16} />}
                {tab === 'inspector' && <Search size={16} />}
                {tab === 'jump' && <Navigation size={16} />}
                {tab === 'flags' && <ToggleRight size={16} />}
                {tab === 'system' && <Settings2 size={16} />}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {panelTab === 'role' && renderRoleTab()}
            {panelTab === 'inspector' && renderInspectorTab()}
            {panelTab === 'jump' && renderJumpTab()}
            {panelTab === 'flags' && renderFlagsTab()}
            {panelTab === 'system' && renderSystemTab()}
          </div>
          
          <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Powered by DeepMind</span>
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] text-slate-400">Dev Mode Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group relative flex items-center justify-center p-3 rounded-2xl shadow-xl transition-all duration-300 overflow-hidden ${
          isOpen 
            ? 'bg-enterprise-600 shadow-enterprise-500/40 text-white w-12 h-12' 
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-12 h-12 hover:w-32'
        }`}
      >
        <div className={`absolute inset-0 bg-gradient-to-tr from-enterprise-500 to-blue-600 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} />
        
        <div className="flex items-center justify-center relative z-10">
          {isOpen ? <X size={20} /> : <Bug size={20} className={roleInfo.color.split(' ')[0]} />}
          
          {!isOpen && (
            <div className="ml-3 overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
              <span className="text-xs font-bold uppercase tracking-wider">Debugger</span>
            </div>
          )}
        </div>
        
        {!isOpen && (
          <div className="absolute top-0 right-0 p-1">
            <div className={`w-2 h-2 rounded-full border border-white dark:border-slate-900 ${roleInfo.color.split(' ')[0].replace('text-', 'bg-')}`}></div>
          </div>
        )}
      </button>
    </div>
  );
};
