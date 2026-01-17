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
    const { invoice_id, payment_amount } = await req.json();

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, total_amount, paid_amount')
      .eq('id', invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    // Calculate new paid amount
    const newPaidAmount = (invoice.paid_amount || 0) + payment_amount;
    const totalAmount = invoice.total_amount || 0;

    // Determine new status
    let newStatus = 'unpaid';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
      })
      .eq('id', invoice_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create journal entry for payment
    const { data: journalEntry, error: journalError } = await supabase
      .from('journal_entries')
      .insert([
        {
          entry_date: new Date().toISOString().split('T')[0],
          reference_no: `INV-${invoice_id.slice(0, 8)}`,
          description: `Payment for invoice ${invoice_id}`,
          status: 'posted',
        },
      ])
      .select()
      .single();

    if (journalError) throw journalError;

    // Add journal items (debit cash, credit AR)
    // Assuming account IDs for Cash (110100) and AR (120100)
    const { error: itemsError } = await supabase
      .from('journal_items')
      .insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: '110100', // Cash account
          debit: payment_amount,
          credit: 0,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: '120100', // AR account
          debit: 0,
          credit: payment_amount,
        },
      ]);

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invoice_id,
          new_status: newStatus,
          paid_amount: newPaidAmount,
          remaining_amount: Math.max(0, totalAmount - newPaidAmount),
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
