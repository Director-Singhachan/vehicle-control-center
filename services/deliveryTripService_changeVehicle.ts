// Helper module specifically for the change-vehicle use case
// NOTE:
// - This file simply re-exports the strongly-typed `changeVehicle` method
//   from `deliveryTripService`.
// - It exists mainly to support imports like `@services/deliveryTripService_changeVehicle`
//   without duplicating business logic.

import { deliveryTripService } from './deliveryTripService';
import type { DeliveryTripWithRelations } from './deliveryTripService';

/**
 * Change vehicle for a given delivery trip.
 *
 * This is a thin wrapper around `deliveryTripService.changeVehicle` so that
 * components can import it directly from `@services/deliveryTripService_changeVehicle`
 * if desired.
 */
export const changeVehicle = async (
  tripId: string,
  newVehicleId: string,
  reason: string,
): Promise<DeliveryTripWithRelations> => {
  return deliveryTripService.changeVehicle(tripId, newVehicleId, reason);
};


