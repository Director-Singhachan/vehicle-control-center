import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDebugStore, OverrideState } from '../../stores/debugStore';
import { useDebugDataContext } from '../../context/DebugDataContext';
import { AppRole } from '../../types/database';
import { TAB_TO_PRIMARY_FEATURE, FEATURE_KEYS } from '../../types/featureAccess';
import { FEATURE_LABELS, ROLE_LABELS_TH } from '../settings/roleFeatureAccessMatrixConfig';
import { 
  Shield, User, Truck, Briefcase, CheckSquare, DollarSign, 
  Users, Award, Terminal, Package, Landmark, UserCircle,
  RefreshCcw, ChevronRight, X, Bug, Database, Zap, 
  Navigation, ToggleRight, Settings2, Trash2, Search,
  Eye, CornerDownRight, ExternalLink, Activity
} from 'lucide-react';

const ROLE_ICONS: Record<AppRole, any> = {
  admin: Shield,
  manager: Briefcase,
  inspector: CheckSquare,
  executive: Award,
  driver: Truck,
  sales: DollarSign,
  service_staff: Users,
  hr: UserCircle,
  accounting: Landmark,
  warehouse: Package,
  user: User,
  dev: Terminal,
};

export const DebugTools: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const { isDev, overriddenRole, setOverriddenRole, profile } = useAuth();
  const { featureOverrides, setFeatureOverride, resetOverrides, panelTab, setPanelTab } = useDebugStore();
  const { dataMap, clearDebugData } = useDebugDataContext();
  
  const [isOpen, setIsOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const [featureQuery, setFeatureQuery] = useState('');
  const [inspectKey, setInspectKey] = useState<string | null>(null);

  if (!isDev) return null;

  const currentRole = overriddenRole || (profile?.role as AppRole) || 'dev';
  
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

  const filteredFeatures = useMemo(() => {
    return FEATURE_KEYS.filter(k => 
      k.toLowerCase().includes(featureQuery.toLowerCase()) || 
      (FEATURE_LABELS[k] || '').toLowerCase().includes(featureQuery.toLowerCase())
    );
  }, [featureQuery]);

  const handleJump = (tab: string) => {
    onTabChange?.(tab);
    setIsOpen(false);
  };

  const renderRoleTab = () => (
    <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
      <div className="px-2 py-1 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
        <span>เลือกตัวตนที่ต้องการทดสอบ</span>
        <button 
          onClick={() => { setOverriddenRole(null); window.location.reload(); }}
          className="text-enterprise-600 hover:underline"
        >
          ล้างค่า
        </button>
      </div>
      {(Object.entries(ROLE_LABELS_TH) as [AppRole, string][]).map(([role, label]) => {
        const Icon = ROLE_ICONS[role] || Terminal;
        const isActive = currentRole === role;
        return (
          <button
            key={role}
            onClick={() => { setOverriddenRole(role); window.location.reload(); }}
            className={`w-full flex items-center p-2 rounded-xl transition-all duration-200 ${
              isActive ? 'bg-enterprise-50 dark:bg-enterprise-900/30 text-enterprise-700 dark:text-enterprise-400 border border-enterprise-100 dark:border-enterprise-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-2 ${isActive ? 'bg-enterprise-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <Icon size={16} />
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderInspectorTab = () => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      <div className="flex justify-between items-center px-2 py-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ข้อมูล JSON ในหน้านี้</span>
        <button onClick={clearDebugData} className="text-[10px] text-rose-500 hover:bg-rose-50 p-1 rounded">ล้างค่า</button>
      </div>
      {Object.keys(dataMap).length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs italic">ไม่มีข้อมูลที่ถูกส่งมา (Raw Data)</div>
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
          placeholder="ค้นหาหน้า..."
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-enterprise-500"
        />
      </div>
      <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
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
    <div className="space-y-3">
      <div className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
        <span>จัดการสิทธิ์ (Overrides)</span>
        <button onClick={resetOverrides} className="text-enterprise-500 hover:underline">รีเซ็ตทั้งหมด</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text" 
          value={featureQuery}
          onChange={(e) => setFeatureQuery(e.target.value)}
          placeholder="ค้นหาฟีเจอร์..."
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-enterprise-500"
        />
      </div>

      <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
        {filteredFeatures.map(key => {
          const override = featureOverrides[key] || 'default';
          return (
            <div key={key} className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
              <div className="flex flex-col mb-2">
                <span className="text-[10px] font-mono text-slate-400">{key}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{FEATURE_LABELS[key] || key}</span>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg">
                {[
                  { id: 'default', label: 'ปกติ' },
                  { id: 'on', label: 'เปิดใช้งาน', color: 'bg-emerald-500 text-white' },
                  { id: 'off', label: 'ปิดกั้น', color: 'bg-rose-500 text-white' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setFeatureOverride(key, opt.id as OverrideState)}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
                      override === opt.id 
                        ? (opt.color || 'bg-white dark:bg-slate-700 shadow-sm text-enterprise-600') 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-2 p-1">
      <div className="px-1 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">การจัดการระบบ</div>
      <button 
        onClick={handleClearCache}
        className="w-full flex items-center p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all font-bold text-xs"
      >
        <Trash2 size={16} className="mr-3" />
        ล้าง Cache และรีโหลดแอป
      </button>

      <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-lg">
            <Activity size={16} className="text-enterprise-600" />
          </div>
          <span className="text-xs font-bold">ข้อมูลเซสชัน</span>
        </div>
        <div className="space-y-1 text-[10px] font-mono text-slate-500">
          <div className="flex justify-between"><span>User:</span> <span className="text-slate-700 dark:text-slate-300">{profile?.email}</span></div>
          <div className="flex justify-between"><span>Real Role:</span> <span className="text-slate-700 dark:text-slate-300">{profile?.role}</span></div>
          <div className="flex justify-between"><span>Active Role:</span> <span className="text-enterprise-600 font-bold">{currentRole}</span></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
      {isOpen && (
        <div className="mb-4 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 ring-4 ring-black/5">
          {/* Header */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-enterprise-500 rounded-lg shadow-lg shadow-enterprise-500/30">
                <Terminal size={14} className="text-white" />
              </div>
              <span className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-white">เครื่องมือสำหรับ Dev</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
            >
              <X size={16} />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="grid grid-cols-5 p-1 bg-slate-100 dark:bg-slate-800/50 mx-4 mt-4 rounded-xl">
            {[
              { id: 'role', icon: UserCircle, label: 'ตัวตน' },
              { id: 'jump', icon: Navigation, label: 'ไปที่หน้า' },
              { id: 'flags', icon: ToggleRight, label: 'สิทธิ์' },
              { id: 'inspector', icon: Search, label: 'แจส' },
              { id: 'system', icon: Settings2, label: 'ระบบ' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPanelTab(tab.id as any)}
                className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                  panelTab === tab.id 
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-enterprise-600 dark:text-white' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title={tab.label}
              >
                <tab.icon size={16} />
                <span className="text-[8px] mt-1 font-bold">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 overflow-y-auto">
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
              <span className="text-[9px] text-slate-400">ระบบทดสอบกำลังทำงาน</span>
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
          {isOpen ? <X size={20} /> : <Bug size={20} className="text-enterprise-500" />}
          
          {!isOpen && (
            <div className="ml-3 overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
              <span className="text-xs font-bold uppercase tracking-wider">ดีบักเกอร์</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};
