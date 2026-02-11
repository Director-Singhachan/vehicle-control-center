// AI Vehicle Recommendation Panel - Shows top-ranked vehicle suggestions
import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Truck, TrendingUp, Weight, Box, Shield, MapPin, CheckCircle, AlertTriangle, Info, RefreshCw, Bot, Package } from 'lucide-react';
import type { VehicleRecommendation } from '../../services/vehicleRecommendationService';

export interface AIRecommendationResult {
  suggested_vehicle_id: string | null;
  reasoning: string | null;
  packing_tips: string | null;
  error?: string;
}

interface VehicleRecommendationPanelProps {
  recommendations: VehicleRecommendation[];
  loading: boolean;
  error: Error | null;
  hasFetched: boolean;
  onSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId?: string;
  onRefresh?: () => void;
  /** ใช้ AI (Edge Function) แนะนำรถ + คำแนะนำการจัดเรียง */
  onRequestAI?: () => void;
  aiLoading?: boolean;
  aiResult?: AIRecommendationResult | null;
  /** วินาทีที่เหลือก่อนกดใช้ AI ได้อีก (ลดการเกินโควต้า) */
  aiCooldownRemaining?: number;
}

const CONFIDENCE_CONFIG = {
  high: { label: 'ความมั่นใจสูง', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: Shield },
  medium: { label: 'ความมั่นใจปานกลาง', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Info },
  low: { label: 'ความมั่นใจต่ำ (ข้อมูลน้อย)', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: AlertTriangle },
};

const SCORE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  capacity_fit: { label: 'ขนาดรถ', icon: Truck },
  historical_success: { label: 'ประวัติใช้งาน', icon: TrendingUp },
  availability: { label: 'ว่างใช้งาน', icon: CheckCircle },
  branch_match: { label: 'ตรงสาขา', icon: MapPin },
  store_familiarity: { label: 'คุ้นเคยร้าน', icon: MapPin },
};

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  let color = 'bg-red-400';
  if (pct >= 80) color = 'bg-green-500';
  else if (pct >= 60) color = 'bg-blue-500';
  else if (pct >= 40) color = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

interface RecommendationCardProps {
  rec: VehicleRecommendation;
  isSelected: boolean;
  onSelect: () => void;
  key?: React.Key; // allow React key without type error
}

function RecommendationCard({
  rec,
  isSelected,
  onSelect,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_CONFIG[rec.confidence];
  const ConfIcon = conf.icon;

  return (
    <div
      className={`
        border rounded-lg transition-all duration-200
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
          : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800'
        }
      `}
    >
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        {/* Rank badge */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
          ${rec.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' : 
            rec.rank === 2 ? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300' :
            'bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-gray-400'}
        `}>
          #{rec.rank}
        </div>

        {/* Vehicle info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {rec.vehicle_plate}
            </span>
            {rec.vehicle_make && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {rec.vehicle_make} {rec.vehicle_model || ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {rec.reasoning}
          </p>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center flex-shrink-0">
          <span className={`
            text-lg font-bold
            ${rec.overall_score >= 80 ? 'text-green-600 dark:text-green-400' :
              rec.overall_score >= 60 ? 'text-blue-600 dark:text-blue-400' :
              rec.overall_score >= 40 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-500 dark:text-red-400'}
          `}>
            {rec.overall_score}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">คะแนน</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onSelect}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
              ${isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
              }
            `}
          >
            {isSelected ? 'เลือกแล้ว' : 'เลือก'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
          {/* Score breakdown */}
          <div className="space-y-1.5">
            <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400">คะแนนรายด้าน</h5>
            {Object.entries(rec.scores).map(([key, value]) => {
              const config = SCORE_LABELS[key];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{config.label}</span>
                  <ScoreBar value={value} />
                </div>
              );
            })}
          </div>

          {/* Capacity info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 bg-gray-50 dark:bg-slate-900/40 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Weight className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">น้ำหนัก</span>
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-white">
                {rec.capacity_info.estimated_weight_kg.toFixed(1)} กก.
                {rec.capacity_info.max_weight_kg && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {' '}/ {rec.capacity_info.max_weight_kg} กก.
                  </span>
                )}
              </div>
              {rec.capacity_info.weight_utilization_pct !== null && (
                <div className="mt-1">
                  <ScoreBar value={rec.capacity_info.weight_utilization_pct} />
                </div>
              )}
            </div>
            <div className="p-2 bg-gray-50 dark:bg-slate-900/40 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Box className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">ปริมาตร</span>
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-white">
                {rec.capacity_info.estimated_volume_liter.toFixed(1)} ลิตร
                {rec.capacity_info.max_volume_liter && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {' '}/ {rec.capacity_info.max_volume_liter} ลิตร
                  </span>
                )}
              </div>
              {rec.capacity_info.volume_utilization_pct !== null && (
                <div className="mt-1">
                  <ScoreBar value={rec.capacity_info.volume_utilization_pct} />
                </div>
              )}
            </div>
          </div>

          {/* Historical stats + Confidence */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              {rec.historical_stats.similar_trips_count > 0 && (
                <span>ทริปที่ผ่านมา: {rec.historical_stats.similar_trips_count} ทริป</span>
              )}
              {rec.historical_stats.avg_utilization !== null && (
                <span>เฉลี่ยใช้งาน: {rec.historical_stats.avg_utilization}%</span>
              )}
              {rec.historical_stats.success_rate !== null && (
                <span>สำเร็จ: {rec.historical_stats.success_rate}%</span>
              )}
            </div>
            <div className={`flex items-center gap-1 ${conf.color}`}>
              <ConfIcon className="w-3 h-3" />
              <span className="text-[10px]">{conf.label}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VehicleRecommendationPanel({
  recommendations,
  loading,
  error,
  hasFetched,
  onSelectVehicle,
  selectedVehicleId,
  onRefresh,
  onRequestAI,
  aiLoading = false,
  aiResult = null,
  aiCooldownRemaining = 0,
}: VehicleRecommendationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Show top 3 by default
  const displayRecs = useMemo(() => recommendations.slice(0, 3), [recommendations]);

  // Don't render if no data and not loading
  if (!hasFetched && !loading) return null;

  return (
    <div className="border border-purple-200 dark:border-purple-800/60 rounded-lg bg-gradient-to-br from-purple-50/50 to-blue-50/30 dark:from-purple-950/20 dark:to-blue-950/10 overflow-hidden">
      {/* Panel Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsCollapsed(!isCollapsed)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }
        }}
        className="w-full flex items-center justify-between p-3 hover:bg-purple-100/30 dark:hover:bg-purple-900/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
            AI แนะนำรถ
          </span>
          {loading && (
            <span className="text-xs text-purple-500 dark:text-purple-400 animate-pulse">
              กำลังวิเคราะห์...
            </span>
          )}
          {!loading && hasFetched && recommendations.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({recommendations.length} ตัวเลือก)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && !loading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
              title="รีเฟรชการแนะนำ"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Panel Body */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-2">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-1" />
                      <div className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded w-48" />
                    </div>
                    <div className="h-8 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              ไม่สามารถวิเคราะห์ได้: {error.message}
            </div>
          )}

          {/* No results */}
          {!loading && !error && hasFetched && recommendations.length === 0 && (
            <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4 inline mr-1" />
              ไม่พบรถที่เหมาะสม กรุณาเลือกรถด้วยตนเอง
            </div>
          )}

          {/* Recommendations list */}
          {!loading && displayRecs.map((rec) => (
            <RecommendationCard
              key={rec.vehicle_id}
              rec={rec}
              isSelected={selectedVehicleId === rec.vehicle_id}
              onSelect={() => onSelectVehicle(rec.vehicle_id)}
            />
          ))}

          {/* ปุ่มใช้ AI แนะนำ (เรียก Edge Function) + cooldown เพื่อไม่เกินโควต้า */}
          {onRequestAI && !loading && displayRecs.length > 0 && (
            <div className="pt-2 border-t border-purple-200/60 dark:border-purple-700/40">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (aiCooldownRemaining > 0) return;
                  onRequestAI();
                }}
                disabled={aiLoading || aiCooldownRemaining > 0}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-800/50 text-purple-800 dark:text-purple-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังถาม AI...
                  </>
                ) : aiCooldownRemaining > 0 ? (
                  <>
                    <Bot className="w-4 h-4" />
                    ลองใหม่ใน {aiCooldownRemaining} วินาที
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    ใช้ AI แนะนำ
                  </>
                )}
              </button>
            </div>
          )}

          {/* ข้อความ error จาก AI (เมื่อ Edge Function คืน 200 แต่มี error ใน body) */}
          {aiResult?.error && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              {aiResult.error}
            </div>
          )}

          {/* ผลจาก AI (reasoning + packing_tips) */}
          {aiResult && !aiResult.error && (aiResult.reasoning || aiResult.packing_tips) && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
              {aiResult.reasoning && (
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                  {aiResult.reasoning}
                </p>
              )}
              {aiResult.packing_tips && (
                <div className="text-xs">
                  <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium mb-1">
                    <Package className="w-3.5 h-3.5" />
                    คำแนะนำการจัดเรียง
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{aiResult.packing_tips}</p>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          {!loading && displayRecs.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center pt-1">
              AI แนะนำจากข้อมูลความจุรถ ประวัติทริป และความพร้อมใช้งาน (Phase 1: Rule-Based)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
