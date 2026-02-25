import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageLayout } from '../components/ui/PageLayout';
import { ToastContainer } from '../components/ui/Toast';
import { useCreateTripWizard } from '../hooks/useCreateTripWizard';
import { useToast } from '../hooks/useToast';
import { splitKey } from '../types/createTripWizard';
import { OrderSelectionStep } from '../components/trip/OrderSelectionStep';
import { VehicleSelectionStep } from '../components/trip/VehicleSelectionStep';
import { CrewAssignmentStep } from '../components/trip/CrewAssignmentStep';
import { TripConfirmationStep } from '../components/trip/TripConfirmationStep';

interface CreateTripFromOrdersViewProps {
  selectedOrders: any[];
  onBack: () => void;
  onSuccess: () => void;
}

export function CreateTripFromOrdersView({ selectedOrders, onBack, onSuccess }: CreateTripFromOrdersViewProps) {
  const { toasts, dismissToast } = useToast();
  const wizard = useCreateTripWizard({ selectedOrders, onSuccess });

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout
        title="สร้างทริปจากออเดอร์"
        actions={
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ย้อนกลับ
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <VehicleSelectionStep
              splitIntoTwoTrips={wizard.splitIntoTwoTrips}
              aiRecommendations={wizard.aiRecommendations}
              aiLoading={wizard.aiLoading}
              aiError={wizard.aiError}
              aiHasFetched={wizard.aiHasFetched}
              fetchRecommendations={wizard.fetchRecommendations}
              handleAiSelectVehicle={wizard.handleAiSelectVehicle}
              selectedVehicleId={wizard.selectedVehicleId}
              handleRequestAI={wizard.handleRequestAI}
              aiExtraLoading={wizard.aiExtraLoading}
              aiExtraResult={wizard.aiExtraResult}
              aiCooldownRemaining={wizard.aiCooldownRemaining}
              selectedBranch={wizard.selectedBranch}
              setSelectedBranch={wizard.setSelectedBranch}
              vehicleSearch={wizard.vehicleSearch}
              setVehicleSearch={wizard.setVehicleSearch}
              branches={wizard.branches}
              vehiclesLoading={wizard.vehiclesLoading}
              filteredVehicles={wizard.filteredVehicles}
              setSelectedVehicleId={wizard.setSelectedVehicleId}
            />
            <CrewAssignmentStep
              splitIntoTwoTrips={wizard.splitIntoTwoTrips}
              setSplitIntoTwoTripsWithExpanded={wizard.setSplitIntoTwoTripsWithExpanded}
              driversLoading={wizard.driversLoading}
              selectedBranch={wizard.selectedBranch}
              filteredDrivers={wizard.filteredDrivers}
              selectedDriverId={wizard.selectedDriverId}
              setSelectedDriverId={wizard.setSelectedDriverId}
              vehiclesLoading={wizard.vehiclesLoading}
              filteredVehicles={wizard.filteredVehicles}
              selectedVehicleId={wizard.selectedVehicleId}
              setSelectedVehicleId={wizard.setSelectedVehicleId}
              selectedVehicleId2={wizard.selectedVehicleId2}
              setSelectedVehicleId2={wizard.setSelectedVehicleId2}
              selectedDriverId2={wizard.selectedDriverId2}
              setSelectedDriverId2={wizard.setSelectedDriverId2}
              tripDate={wizard.tripDate}
              setTripDate={wizard.setTripDate}
              notes={wizard.notes}
              setNotes={wizard.setNotes}
              skipStockDeduction={wizard.skipStockDeduction}
              setSkipStockDeduction={wizard.setSkipStockDeduction}
            />
            <OrderSelectionStep
              storeDeliveries={wizard.storeDeliveries}
              orderItemsMap={wizard.orderItemsMap}
              expandedStores={wizard.expandedStores}
              toggleExpandedStore={wizard.toggleExpandedStore}
              splitKey={splitKey}
              getRemaining={wizard.getRemaining}
              splitIntoTwoTrips={wizard.splitIntoTwoTrips}
              itemSplitMap={wizard.itemSplitMap}
              handleSplitQtyChange={wizard.handleSplitQtyChange}
              quantityInThisTripMap={wizard.quantityInThisTripMap}
              setQuantityInThisTripMapForKey={wizard.setQuantityInThisTripMapForKey}
              setAllQuantityInThisTripForDelivery={wizard.setAllQuantityInThisTripForDelivery}
              setAllSplitForDelivery={wizard.setAllSplitForDelivery}
              splitValidationErrors={wizard.splitValidationErrors}
              draggedIndex={wizard.draggedIndex}
              handleDragStart={wizard.handleDragStart}
              handleDragOver={wizard.handleDragOver}
              handleDragEnd={wizard.handleDragEnd}
              handleRemoveDelivery={wizard.handleRemoveDelivery}
            />
          </div>

          <TripConfirmationStep
            totals={wizard.totals}
            selectedOrders={wizard.selectedOrders}
            storeDeliveries={wizard.storeDeliveries}
            orderItemsMap={wizard.orderItemsMap}
            splitIntoTwoTrips={wizard.splitIntoTwoTrips}
            selectedVehicleId={wizard.selectedVehicleId}
            selectedVehicleId2={wizard.selectedVehicleId2}
            selectedDriverId={wizard.selectedDriverId}
            selectedDriverId2={wizard.selectedDriverId2}
            splitValidationErrors={wizard.splitValidationErrors}
            getItemsForVehicle={wizard.getItemsForVehicle}
            isSubmitting={wizard.isSubmitting}
            handleSubmit={wizard.handleSubmit}
            capacitySummary={wizard.capacitySummary}
            capacitySummary2={wizard.capacitySummary2}
            palletPackingResult={wizard.palletPackingResult}
          />
        </div>
      </PageLayout>
    </>
  );
}
