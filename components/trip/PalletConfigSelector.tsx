import React from 'react';
import { Package } from 'lucide-react';

interface PalletConfig {
    id: string;
    pallet_id: string;
    layers: number;
    units_per_layer: number;
    total_units: number;
    total_weight_kg?: number;
    is_default: boolean;
}

interface PalletConfigSelectorProps {
    productId: string;
    productName: string;
    quantity: number;
    configs: PalletConfig[];
    selectedConfigId?: string;
    onChange: (configId: string | undefined) => void;
    disabled?: boolean;
}

export const PalletConfigSelector: React.FC<PalletConfigSelectorProps> = ({
    productName,
    quantity,
    configs,
    selectedConfigId,
    onChange,
    disabled = false,
}) => {
    if (!configs || configs.length === 0) {
        return null; // ไม่แสดงอะไรถ้าไม่มี config
    }

    // หา config ที่เลือก หรือใช้ default
    const selectedConfig = selectedConfigId
        ? configs.find(c => c.id === selectedConfigId)
        : configs.find(c => c.is_default) || configs[0];

    // คำนวณจำนวนพาเลทที่ต้องใช้
    const palletsNeeded = selectedConfig
        ? Math.ceil(quantity / selectedConfig.total_units)
        : 0;

    const remainingUnits = selectedConfig
        ? quantity % selectedConfig.total_units
        : 0;

    const spaceFree = selectedConfig && remainingUnits > 0
        ? selectedConfig.total_units - remainingUnits
        : 0;

    return (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        รูปแบบการจัดพาเลท
                    </label>

                    <select
                        value={selectedConfigId || ''}
                        onChange={(e) => onChange(e.target.value || undefined)}
                        disabled={disabled}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50"
                    >
                        {/* Option: ใช้ default config */}
                        <option value="">ใช้ค่าเริ่มต้น{configs.find(c => c.is_default) ? ` (${configs.find(c => c.is_default)!.total_units} ${productName.includes('ลัง') ? 'ลัง' : 'หน่วย'}/พาเลท)` : ''}</option>

                        {/* Options: แต่ละ config */}
                        {configs.map((config) => (
                            <option key={config.id} value={config.id}>
                                {config.layers} ชั้น × {config.units_per_layer} หน่วย = {config.total_units} {productName.includes('ลัง') ? 'ลัง' : 'หน่วย'}/พาเลท
                                {config.is_default && ' (ค่าเริ่มต้น)'}
                                {config.total_weight_kg && ` • ${config.total_weight_kg} กก.`}
                            </option>
                        ))}
                    </select>

                    {/* แสดงผลการคำนวณ */}
                    {selectedConfig && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div className="flex items-center justify-between">
                                <span>จำนวนพาเลท:</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {palletsNeeded} พาเลท
                                </span>
                            </div>

                            {spaceFree > 0 && (
                                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                                    <span>เหลือที่ว่างในพาเลทสุดท้าย:</span>
                                    <span className="font-semibold">
                                        {spaceFree} {productName.includes('ลัง') ? 'ลัง' : 'หน่วย'}
                                    </span>
                                </div>
                            )}

                            {remainingUnits > 0 && (
                                <div className="text-gray-500 dark:text-gray-500 text-xs">
                                    ({quantity} ÷ {selectedConfig.total_units} = {palletsNeeded} พาเลท, จัดได้ {remainingUnits} {productName.includes('ลัง') ? 'ลัง' : 'หน่วย'} ในพาเลทสุดท้าย)
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
