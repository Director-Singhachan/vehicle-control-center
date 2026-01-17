import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { staff_id, period_month, period_year } = await req.json();

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employee_details')
      .select('salary')
      .eq('id', staff_id)
      .single();

    if (employeeError) throw employeeError;

    // Get commission for the period
    const { data: commissions, error: commissionError } = await supabase
      .from('commission_logs')
      .select('actual_commission')
      .eq('staff_id', staff_id);

    if (commissionError) throw commissionError;

    const commissionAmount = commissions?.reduce(
      (sum, log) => sum + (log.actual_commission || 0),
      0
    ) || 0;

    // Get allowances
    const { data: allowances, error: allowancesError } = await supabase
      .from('allowances')
      .select('amount')
      .eq('staff_id', staff_id)
      .eq('is_active', true);

    if (allowancesError) throw allowancesError;

    const allowanceAmount = allowances?.reduce(
      (sum, allowance) => sum + (allowance.amount || 0),
      0
    ) || 0;

    // Check if payroll already exists
    const { data: existingPayroll } = await supabase
      .from('payroll_records')
      .select('id')
      .eq('staff_id', staff_id)
      .eq('period_month', period_month)
      .eq('period_year', period_year)
      .single();

    if (existingPayroll) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payroll already exists for this period',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create payroll record
    const { data: payroll, error: payrollError } = await supabase
      .from('payroll_records')
      .insert([
        {
          staff_id,
          period_month,
          period_year,
          base_salary: employee?.salary || 0,
          commission_amount: commissionAmount,
          bonus: 0,
          deductions: 0,
          status: 'draft',
        },
      ])
      .select()
      .single();

    if (payrollError) throw payrollError;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          payroll_id: payroll.id,
          base_salary: employee?.salary || 0,
          commission_amount: commissionAmount,
          allowance_amount: allowanceAmount,
          total: (employee?.salary || 0) + commissionAmount + allowanceAmount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
