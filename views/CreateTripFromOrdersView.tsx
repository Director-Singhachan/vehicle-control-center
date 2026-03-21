import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageLayout } from '../components/ui/PageLayout';
import { ToastContainer } from '../components/ui/Toast';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useCreateTripWizard } from '../hooks/useCreateTripWizard';
import { useToast } from '../hooks/useToast';
import { useTripContributionEstimate } from '../hooks/useTripContributionEstimate';
import { splitKey } from '../types/createTripWizard';
import { OrderSelectionStep } from '../components/trip/OrderSelectionStep';
import { VehicleSelectionStep } from '../components/trip/VehicleSelectionStep';
import { CrewAssignmentStep } from '../components/trip/CrewAssignmentStep';
import { TripConfirmationStep } from '../components/trip/TripConfirmationStep';
import { TripContributionEstimateCard } from '../components/trip/TripContributionEstimateCard';
import { serviceStaffService } from '../services/serviceStaffService';

interface CreateTripFromOrdersViewProps {
  selectedOrders: any[];
  onBack: () => void;
  onSuccess: () => void;
}

export function CreateTripFromOrdersView({ selectedOrders, onBack, onSuccess }: CreateTripFromOrdersViewProps) {
  const { toasts, dismissToast } = useToast();
  const wizard = useCreateTripWizard({ selectedOrders, onSuccess });

  const [estimatedFuelBaht, setEstimatedFuelBaht] = useState('');
  const [staffId1, setStaffId1] = useState<string | null>(null);
  const [staffId2, setStaffId2] = useState<string | null>(null);
  const [staffId3, setStaffId3] = useState<string | null>(null);

  useEffect(() => {
    if (!wizard.selectedDriverId) {
      setStaffId1(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(wizard.selectedDriverId).then((s) => setStaffId1(s?.id ?? null));
  }, [wizard.selectedDriverId]);

  useEffect(() => {
    if (!wizard.selectedDriverId2) {
      setStaffId2(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(wizard.selectedDriverId2).then((s) => setStaffId2(s?.id ?? null));
  }, [wizard.selectedDriverId2]);

  useEffect(() => {
    if (!wizard.selectedDriverId3) {
      setStaffId3(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(wizard.selectedDriverId3).then((s) => setStaffId3(s?.id ?? null));
  }, [wizard.selectedDriverId3]);

  const tripDenominator = wizard.splitIntoThreeTrips ? 3 : wizard.splitIntoTwoTrips ? 2 : 1;

  const crewStaffIdsTrip1 = useMemo(
    () => [...new Set([staffId1, ...wizard.helperStaffIds1].filter(Boolean))] as string[],
    [staffId1, wizard.helperStaffIds1]
  );
  const crewStaffIdsTrip2 = useMemo(
    () => [...new Set([staffId2, ...wizard.helperStaffIds2].filter(Boolean))] as string[],
    [staffId2, wizard.helperStaffIds2]
  );
  const crewStaffIdsTrip3 = useMemo(
    () => [...new Set([staffId3, ...wizard.helperStaffIds3].filter(Boolean))] as string[],
    [staffId3, wizard.helperStaffIds3]
  );

  const revenuePerTripStr = useMemo(() => {
    const v = wizard.totals.totalAmount / tripDenominator;
    return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0';
  }, [wizard.totals.totalAmount, tripDenominator]);

  const fuelPerTripStr = useMemo(() => {
    const f = parseFloat(estimatedFuelBaht) || 0;
    const p = tripDenominator > 0 ? f / tripDenominator : 0;
    return String(Math.round(p * 100) / 100);
  }, [estimatedFuelBaht, tripDenominator]);

  const branchForVehicle = useCallback(
    (vehicleId: string) => {
      const b = wizard.selectedBranch || wizard.vehicles.find((v: { id: string; branch?: string | null }) => v.id === vehicleId)?.branch;
      return b || null;
    },
    [wizard.selectedBranch, wizard.vehicles]
  );

  const showSplitFuel = wizard.splitIntoTwoTrips || wizard.splitIntoThreeTrips;

  /** จำนวนชิ้นต่อเที่ยว — สอดคล้องกับ payload สร้างทริป (รวมถึงคอลัมน์นำไปส่งในทริปนี้) */
  const qtyTrip1 = useMemo(() => {
    if (wizard.splitIntoTwoTrips || wizard.splitIntoThreeTrips) {
      return wizard.getItemsForVehicle(1).reduce((s, i) => s + Number(i.quantity), 0);
    }
    let sum = 0;
    for (const delivery of wizard.storeDeliveries) {
      const orderItems = wizard.orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        const remaining = wizard.getRemaining(item);
        const key = splitKey(delivery.order_id, item.id);
        const qtyInTrip = wizard.quantityInThisTripMap[key] ?? remaining;
        sum += Math.max(0, Math.min(remaining, qtyInTrip));
      }
    }
    return sum;
  }, [
    wizard.splitIntoTwoTrips,
    wizard.splitIntoThreeTrips,
    wizard.storeDeliveries,
    wizard.orderItemsMap,
    wizard.quantityInThisTripMap,
    wizard.getItemsForVehicle,
    wizard.getRemaining,
  ]);

  const qtyTrip2 = useMemo(
    () => wizard.getItemsForVehicle(2).reduce((s, i) => s + Number(i.quantity), 0),
    [wizard.storeDeliveries, wizard.orderItemsMap, wizard.itemSplitMap, wizard.splitMode]
  );

  const qtyTrip3 = useMemo(
    () => wizard.getItemsForVehicle(3).reduce((s, i) => s + Number(i.quantity), 0),
    [wizard.storeDeliveries, wizard.orderItemsMap, wizard.itemSplitMap, wizard.splitMode]
  );

  const trip1Estimate = useTripContributionEstimate({
    enabled: Boolean(wizard.selectedVehicleId) && !wizard.vehiclesLoading,
    vehicleId: wizard.selectedVehicleId,
    branch: branchForVehicle(wizard.selectedVehicleId),
    plannedDate: wizard.tripDate,
    tripStartDate: '',
    tripEndDate: '',
    crewStaffIds: crewStaffIdsTrip1,
    tripRevenueStr: revenuePerTripStr,
    estimatedFuelStr: fuelPerTripStr,
    totalItemQuantity: qtyTrip1,
    excludeTripId: undefined,
  });

  const trip2Estimate = useTripContributionEstimate({
    enabled:
      Boolean(wizard.selectedVehicleId2) &&
      (wizard.splitIntoTwoTrips || wizard.splitIntoThreeTrips) &&
      !wizard.vehiclesLoading,
    vehicleId: wizard.selectedVehicleId2,
    branch: branchForVehicle(wizard.selectedVehicleId2),
    plannedDate: wizard.tripDate,
    tripStartDate: '',
    tripEndDate: '',
    crewStaffIds: crewStaffIdsTrip2,
    tripRevenueStr: revenuePerTripStr,
    estimatedFuelStr: fuelPerTripStr,
    totalItemQuantity: qtyTrip2,
    excludeTripId: undefined,
  });

  const trip3Estimate = useTripContributionEstimate({
    enabled: Boolean(wizard.selectedVehicleId3) && wizard.splitIntoThreeTrips && !wizard.vehiclesLoading,
    vehicleId: wizard.selectedVehicleId3,
    branch: branchForVehicle(wizard.selectedVehicleId3),
    plannedDate: wizard.tripDate,
    tripStartDate: '',
    tripEndDate: '',
    crewStaffIds: crewStaffIdsTrip3,
    tripRevenueStr: revenuePerTripStr,
    estimatedFuelStr: fuelPerTripStr,
    totalItemQuantity: qtyTrip3,
    excludeTripId: undefined,
  });

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
              splitIntoThreeTrips={wizard.splitIntoThreeTrips}
              setSplitIntoTwoTripsWithExpanded={wizard.setSplitIntoTwoTripsWithExpanded}
              setSplitModeWithExpanded={wizard.setSplitModeWithExpanded}
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
              selectedVehicleId3={wizard.selectedVehicleId3}
              setSelectedVehicleId3={wizard.setSelectedVehicleId3}
              selectedDriverId3={wizard.selectedDriverId3}
              setSelectedDriverId3={wizard.setSelectedDriverId3}
              tripDate={wizard.tripDate}
              setTripDate={wizard.setTripDate}
              notes={wizard.notes}
              setNotes={wizard.setNotes}
              skipStockDeduction={wizard.skipStockDeduction}
              setSkipStockDeduction={wizard.setSkipStockDeduction}
              nextTripSequence1={wizard.nextTripSequence1}
              nextTripSequence2={wizard.nextTripSequence2}
              nextTripSequence3={wizard.nextTripSequence3}
              helperStaffIds1={wizard.helperStaffIds1}
              setHelperStaffIds1={wizard.setHelperStaffIds1}
              helperStaffIds2={wizard.helperStaffIds2}
              setHelperStaffIds2={wizard.setHelperStaffIds2}
              helperStaffIds3={wizard.helperStaffIds3}
              setHelperStaffIds3={wizard.setHelperStaffIds3}
            />

            {wizard.selectedVehicleId && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  รายได้ใช้ยอดรวมออเดอร์ในรายการ (total_amount)
                  {tripDenominator > 1 ? ` — หาร ${tripDenominator} เที่ยวเพื่อประมาณการต่อเที่ยว` : ''}
                </p>
                {showSplitFuel && (
                  <Card>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      น้ำมันรวมโดยประมาณ (แบ่งเท่าๆ ต่อเที่ยว)
                    </p>
                    <Input
                      type="number"
                      value={estimatedFuelBaht}
                      onChange={(e) => setEstimatedFuelBaht(e.target.value)}
                      placeholder="0"
                      min={0}
                      step={1}
                      className="dark:bg-charcoal-900 dark:border-slate-600 dark:text-white"
                    />
                  </Card>
                )}

                {!wizard.splitIntoTwoTrips && !wizard.splitIntoThreeTrips && (
                  <TripContributionEstimateCard
                    estimatedFuelStr={estimatedFuelBaht}
                    onEstimatedFuelChange={setEstimatedFuelBaht}
                    data={trip1Estimate.data}
                    loading={trip1Estimate.loading}
                    error={trip1Estimate.error}
                    branchCode={branchForVehicle(wizard.selectedVehicleId)}
                  />
                )}

                {wizard.splitIntoTwoTrips && (
                  <>
                    <TripContributionEstimateCard
                      title="ประมาณการ — คันที่ 1"
                      showFuelInput={false}
                      estimatedFuelStr=""
                      onEstimatedFuelChange={() => {}}
                      data={trip1Estimate.data}
                      loading={trip1Estimate.loading}
                      error={trip1Estimate.error}
                      branchCode={branchForVehicle(wizard.selectedVehicleId)}
                    />
                    <TripContributionEstimateCard
                      title="ประมาณการ — คันที่ 2"
                      showFuelInput={false}
                      estimatedFuelStr=""
                      onEstimatedFuelChange={() => {}}
                      data={trip2Estimate.data}
                      loading={trip2Estimate.loading}
                      error={trip2Estimate.error}
                      branchCode={branchForVehicle(wizard.selectedVehicleId2)}
                    />
                  </>
                )}

                {wizard.splitIntoThreeTrips && (
                  <>
                    <TripContributionEstimateCard
                      title="ประมาณการ — เที่ยวที่ 1"
                      showFuelInput={false}
                      estimatedFuelStr=""
                      onEstimatedFuelChange={() => {}}
                      data={trip1Estimate.data}
                      loading={trip1Estimate.loading}
                      error={trip1Estimate.error}
                      branchCode={branchForVehicle(wizard.selectedVehicleId)}
                    />
                    <TripContributionEstimateCard
                      title="ประมาณการ — เที่ยวที่ 2"
                      showFuelInput={false}
                      estimatedFuelStr=""
                      onEstimatedFuelChange={() => {}}
                      data={trip2Estimate.data}
                      loading={trip2Estimate.loading}
                      error={trip2Estimate.error}
                      branchCode={branchForVehicle(wizard.selectedVehicleId2)}
                    />
                    <TripContributionEstimateCard
                      title="ประมาณการ — เที่ยวที่ 3"
                      showFuelInput={false}
                      estimatedFuelStr=""
                      onEstimatedFuelChange={() => {}}
                      data={trip3Estimate.data}
                      loading={trip3Estimate.loading}
                      error={trip3Estimate.error}
                      branchCode={branchForVehicle(wizard.selectedVehicleId3)}
                    />
                  </>
                )}
              </div>
            )}

            <OrderSelectionStep
              storeDeliveries={wizard.storeDeliveries}
              orderItemsMap={wizard.orderItemsMap}
              expandedStores={wizard.expandedStores}
              toggleExpandedStore={wizard.toggleExpandedStore}
              splitKey={splitKey}
              getRemaining={wizard.getRemaining}
              splitIntoTwoTrips={wizard.splitIntoTwoTrips}
              splitIntoThreeTrips={wizard.splitIntoThreeTrips}
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
            splitIntoThreeTrips={wizard.splitIntoThreeTrips}
            selectedVehicleId={wizard.selectedVehicleId}
            selectedVehicleId2={wizard.selectedVehicleId2}
            selectedVehicleId3={wizard.selectedVehicleId3}
            selectedDriverId={wizard.selectedDriverId}
            selectedDriverId2={wizard.selectedDriverId2}
            selectedDriverId3={wizard.selectedDriverId3}
            splitValidationErrors={wizard.splitValidationErrors}
            getItemsForVehicle={wizard.getItemsForVehicle}
            isSubmitting={wizard.isSubmitting}
            handleSubmit={wizard.handleSubmit}
            capacitySummary={wizard.capacitySummary}
            capacitySummary2={wizard.capacitySummary2}
            capacitySummary3={wizard.capacitySummary3}
            palletPackingResult={wizard.palletPackingResult}
            helperCount1={wizard.helperStaffIds1.length}
            helperCount2={wizard.helperStaffIds2.length}
            helperCount3={wizard.helperStaffIds3.length}
          />
        </div>
      </PageLayout>
    </>
  );
}
