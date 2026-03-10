import { supabase } from '../../lib/supabase';

const getEarliestCrewStartAt = async (tripId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('delivery_trip_crews')
    .select('start_at')
    .eq('delivery_trip_id', tripId)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[crewCommissionUtils] Failed to load earliest crew start time:', {
      tripId,
      error,
    });
    return null;
  }

  return data?.start_at ?? null;
};

const getTripCheckoutTime = async (tripId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('trip_logs')
    .select('checkout_time')
    .eq('delivery_trip_id', tripId)
    .not('checkout_time', 'is', null)
    .order('checkout_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[crewCommissionUtils] Failed to load trip checkout time:', {
      tripId,
      error,
    });
    return null;
  }

  return data?.checkout_time ?? null;
};

export const resolveCrewAssignmentStartAt = async (
  tripId: string,
  tripStatus: string
): Promise<string> => {
  if (tripStatus !== 'completed') {
    return new Date().toISOString();
  }

  const earliestCrewStartAt = await getEarliestCrewStartAt(tripId);
  if (earliestCrewStartAt) {
    return earliestCrewStartAt;
  }

  const tripCheckoutTime = await getTripCheckoutTime(tripId);
  if (tripCheckoutTime) {
    return tripCheckoutTime;
  }

  return new Date().toISOString();
};

export const recalculateCompletedTripCommission = async (
  tripId: string,
  source: string,
  tripStatus?: string
): Promise<void> => {
  let effectiveTripStatus = tripStatus;

  if (!effectiveTripStatus) {
    const { data: trip, error } = await supabase
      .from('delivery_trips')
      .select('status')
      .eq('id', tripId)
      .maybeSingle();

    if (error) {
      console.warn('[crewCommissionUtils] Failed to load trip status before commission recalculation:', {
        tripId,
        error,
      });
      return;
    }

    effectiveTripStatus = trip?.status;
  }

  if (effectiveTripStatus !== 'completed') {
    return;
  }

  try {
    await supabase.functions.invoke('auto-commission-worker', {
      body: {
        source,
        trip_id: tripId,
      },
    });
  } catch (error) {
    console.warn('[crewCommissionUtils] Failed to invoke auto-commission-worker:', {
      tripId,
      source,
      error,
    });
  }
};
