// Reports Service - Analytics and reporting
import { supabase } from '../lib/supabase';

export interface Financials {
  todayCost: number;
  costTrend: number; // percent
}

export interface MaintenanceTrends {
  labels: string[];
  costs: number[];
  incidents: number[];
}

export const reportsService = {

  // Get financials (costs only - no revenue)
  getFinancials: async (): Promise<Financials> => {
    try {
      console.log('[reportsService] Fetching financials...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      // Use Promise.all for parallel execution
      const [todayResult, yesterdayResult] = await Promise.all([
        // Today's costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', today.toISOString()),

        // Yesterday's costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', yesterdayEnd.toISOString())
      ]);

      if (todayResult.error) {
        console.error('[reportsService] Error fetching today costs:', todayResult.error);
        throw todayResult.error;
      }

      if (yesterdayResult.error) {
        console.error('[reportsService] Error fetching yesterday costs:', yesterdayResult.error);
        throw yesterdayResult.error;
      }

      const todayCosts = todayResult.data;
      const yesterdayCosts = yesterdayResult.data;

      console.log('[reportsService] Costs count:', { today: todayCosts?.length, yesterday: yesterdayCosts?.length });

      const todayCost = todayCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const yesterdayCost = yesterdayCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

      // Calculate trend
      const costTrend = yesterdayCost > 0
        ? ((todayCost - yesterdayCost) / yesterdayCost) * 100
        : 0;

      return {
        todayCost: todayCost,
        costTrend: costTrend,
      };
    } catch (error) {
      console.error('[reportsService] getFinancials error:', error);
      throw error;
    }
  },

  // Get maintenance trends (monthly)
  getMaintenanceTrends: async (months: number = 6): Promise<MaintenanceTrends> => {
    // Get last N months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Optimize: Fetch only necessary columns
    const [costsResult, incidentsResult] = await Promise.all([
      // Monthly costs
      supabase
        .from('ticket_costs')
        .select(`
          cost,
          ticket:tickets!inner(created_at)
        `)
        .gte('tickets.created_at', startDate.toISOString()),

      // Monthly incidents - only need created_at
      supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
    ]);

    if (costsResult.error) throw costsResult.error;
    if (incidentsResult.error) throw incidentsResult.error;

    const costsData = costsResult.data;
    const incidentsData = incidentsResult.data;

    // Group by month
    const monthMap = new Map<string, { costs: number; incidents: number }>();

    // Process costs
    costsData?.forEach(item => {
      const ticket = item.ticket as { created_at: string } | null;
      if (!ticket) return;

      const date = new Date(ticket.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { costs: 0, incidents: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.costs += item.cost || 0;
    });

    // Process incidents
    incidentsData?.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { costs: 0, incidents: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.incidents += 1;
    });

    // Convert to arrays
    const sortedMonths = Array.from(monthMap.entries()).sort();
    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('th-TH', { month: 'short' });
    });
    const costs = sortedMonths.map(([, data]) => data.costs);
    const incidents = sortedMonths.map(([, data]) => data.incidents);

    return {
      labels,
      costs,
      incidents,
    };
  },
};

