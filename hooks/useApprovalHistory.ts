// Hook for fetching approval history
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
import type { Database } from '../types/database';

type Approval = Database['public']['Tables']['ticket_approvals']['Row'];

export const useApprovalHistory = (ticketId: number | null) => {
  const cache = useDataCacheStore();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setApprovals([]);
      return;
    }

    const cacheKey = createCacheKey('approval-history', ticketId);
    const cached = cache.get<Approval[]>(cacheKey);

    if (cached) {
      setApprovals(cached);
      setLoading(false);
    }

    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('ticket_approvals')
          .select(`
            *,
            approver:profiles!ticket_approvals_approved_by_fkey(full_name, avatar_url)
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (fetchError) {
          console.error('Error fetching approvals:', fetchError);
          throw fetchError;
        }

        // Sort by level if it exists, then by created_at
        const sortedData = (data || []).sort((a: any, b: any) => {
          if (a.level !== undefined && b.level !== undefined) {
            if (a.level !== b.level) {
              return a.level - b.level;
            }
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        setApprovals(sortedData);
        // Cache for 1 minute
        cache.set(cacheKey, sortedData, 60 * 1000);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch approval history'));
      } finally {
        setLoading(false);
      }
    };

    if (!cached) {
      fetchApprovals();
    } else {
      // Background refresh
      fetchApprovals();
    }
  }, [ticketId]);

  return {
    approvals,
    loading,
    error,
    refetch: async () => {
      if (!ticketId) return;
      const cacheKey = createCacheKey('approval-history', ticketId);
      cache.invalidate(cacheKey);
      const { data, error: fetchError } = await supabase
        .from('ticket_approvals')
        .select(`
          *,
          approver:profiles!ticket_approvals_approved_by_fkey(full_name, avatar_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Sort by level if it exists, then by created_at
      const sortedData = (data || []).sort((a: any, b: any) => {
        if (a.level !== undefined && b.level !== undefined) {
          if (a.level !== b.level) {
            return a.level - b.level;
          }
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setApprovals(sortedData);
      cache.set(cacheKey, sortedData, 60 * 1000);
    },
  };
};

