// Delivery Trip Service - Re-export hub (all delivery trip domains)
import { tripCrudService } from './deliveryTrip/tripCrudService';
import { tripStatusService } from './deliveryTrip/tripStatusService';
import { tripHistoryAggregatesService } from './deliveryTrip/tripHistoryAggregatesService';

export type {
  DeliveryTripStoreWithDetails,
  DeliveryTripItemWithProduct,
  DeliveryTripCrewWithDetails,
  DeliveryTripWithRelations,
  DeliveryTripItemChangeWithDetails,
  CreateDeliveryTripData,
  UpdateDeliveryTripData,
} from './deliveryTrip/types';

export const deliveryTripService = {
  ...tripCrudService,
  ...tripStatusService,
  ...tripHistoryAggregatesService,
};
