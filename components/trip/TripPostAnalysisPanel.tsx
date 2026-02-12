import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tripMetricsService, type PostTripAnalysisEntry } from '../../services/tripMetricsService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface TripPostAnalysisPanelProps {
    tripId: string;
    tripStatus?: string;
}

export const TripPostAnalysisPanel: React.FC<TripPostAnalysisPanelProps> = ({ tripId, tripStatus }) => {
    const [analyses, setAnalyses] = useState<PostTripAnalysisEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const fetchAnalyses = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await tripMetricsService.getPostTripAnalysisForTrip(tripId);
            setAnalyses(data);
            // Expand first analysis by default
            if (data.length > 0 && expandedIds.size === 0) {
                setExpandedIds(new Set([data[0].id]));
            }
        } catch (err) {
            console.error('Error fetching analyses:', err);
            setError(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลการวิเคราะห์ได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tripId) {
            fetchAnalyses();
        }
    }, [tripId]);

    const handleAnalyze = async () => {
        try {
            setAnalyzing(true);
            setError(null);

            // Call Edge Function
            const { data, error: fnError } = await supabase.functions.invoke('post-trip-analysis', {
                body: { delivery_trip_id: tripId },
            });

            if (fnError) {
                throw new Error(fnError.message);
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            // Refresh analyses
            await fetchAnalyses();
        } catch (err) {
            console.error('Error analyzing trip:', err);
            setError(err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ทริปได้');
        } finally {
            setAnalyzing(false);
        }
    };

    const toggleExpanded = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const isCompleted = tripStatus === 'completed';
    const hasAnalyses = analyses.length > 0;

    const formatSummary = (summary: string) => {
        const lines = summary.split('\n');
        return lines.map((line, index) => {
            const trimmed = line.trim();

            // Bold headings (lines starting with **)
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                return (
                    <div key={index} className="font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1 first:mt-0">
                        {trimmed.replace(/\*\*/g, '')}
                    </div>
                );
            }

            // Bullet points
            if (trimmed.startsWith('-')) {
                return (
                    <div key={index} className="text-sm text-slate-700 dark:text-slate-300 ml-4 mb-1">
                        • {trimmed.substring(1).trim()}
                    </div>
                );
            }

            // Regular text
            if (trimmed) {
                return (
                    <div key={index} className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                        {trimmed}
                    </div>
                );
            }

            return null;
        });
    };

    const getAnalysisTypeLabel = (type: string) => {
        switch (type) {
            case 'utilization':
                return 'การใช้พื้นที่';
            case 'packing_issue':
                return 'ปัญหาการจัดเรียง';
            case 'unload_efficiency':
                return 'ประสิทธิภาพการขนของ';
            case 'overall':
                return 'ภาพรวม';
            default:
                return type;
        }
    };

    const getAnalysisTypeColor = (type: string) => {
        switch (type) {
            case 'utilization':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'packing_issue':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'unload_efficiency':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'overall':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            default:
                return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
        }
    };

    return (
        <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-enterprise-600 dark:text-enterprise-400" size={20} />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        AI Trip Analysis
                    </h3>
                    {hasAnalyses && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle size={12} />
                            {analyses.length} การวิเคราะห์
                        </span>
                    )}
                </div>

                {isCompleted && (
                    <Button
                        variant="primary"
                        onClick={handleAnalyze}
                        disabled={analyzing || loading}
                        className="flex items-center gap-2"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                กำลังวิเคราะห์...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                {hasAnalyses ? 'วิเคราะห์อีกครั้ง' : 'วิเคราะห์ทริปนี้'}
                            </>
                        )}
                    </Button>
                )}
            </div>

            {!isCompleted && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        การวิเคราะห์ทริปด้วย AI จะพร้อมใช้งานเมื่อทริปเสร็จสิ้นแล้ว (status = completed)
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200 mt-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-slate-400" />
                </div>
            ) : hasAnalyses ? (
                <div className="mt-4 space-y-3">
                    {analyses.map((analysis) => {
                        const isExpanded = expandedIds.has(analysis.id);
                        return (
                            <div
                                key={analysis.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleExpanded(analysis.id)}
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${getAnalysisTypeColor(
                                                analysis.analysis_type
                                            )}`}
                                        >
                                            {getAnalysisTypeLabel(analysis.analysis_type)}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {new Date(analysis.created_at).toLocaleString('th-TH', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp size={18} className="text-slate-400" />
                                    ) : (
                                        <ChevronDown size={18} className="text-slate-400" />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="p-4 bg-white dark:bg-slate-900">
                                        {formatSummary(analysis.ai_summary)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : isCompleted ? (
                <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 mt-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        ยังไม่มีการวิเคราะห์สำหรับทริปนี้ กดปุ่ม "วิเคราะห์ทริปนี้" เพื่อให้ AI วิเคราะห์ประสิทธิภาพของทริป
                    </div>
                </div>
            ) : null}
        </Card>
    );
};
