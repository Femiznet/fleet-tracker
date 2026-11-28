import type {
  PlantFleetSnapshot,
  PlantStatusMetrics,
} from '@fleet/database/schema';

export function formatPlantStatusMessage(
  officersOnDuty: string,
  metrics: PlantStatusMetrics,
  snapshot: PlantFleetSnapshot,
): string {
  const bay = metrics.landingGearBox?.loadingAndWashingBay ?? 0;
  const workshop = metrics.landingGearBox?.workshop ?? 0;
  const wooden = metrics.landingGearBox?.wooden ?? 0;
  const baseTotal = bay + workshop;
  const grandTotal = baseTotal + wooden;

  const compressorLines = metrics.compressors
    ? Object.entries(metrics.compressors)
        .map(([name, state]) => `*[${name}]*: ${state}`)
        .join('\n')
    : '';

  const extraLines = metrics.extraFields
    ? Object.entries(metrics.extraFields)
        .map(([key, val]) => `*${key.toUpperCase()}*: ${val}`)
        .join('\n')
    : '';

  return [
    '`PLANT STATUS`',
    '',
    `*INLET PRESSURE*: ${metrics.inletPressureBar ?? '-'} bar`,
    '',
    `\`SKIDS LOADING AT\` ${metrics.loadingPressureBar ?? 190} BAR`,
    '',
    '*[Customer Skid]*:',
    snapshot.skidsLoading.customer.join(', '),
    '',
    '*[Gastech Skid]*:',
    snapshot.skidsLoading.gastech.join(', '),
    '',
    '*[On Hold]*:',
    snapshot.skidsOnHold.join(', '),
    '',
    '`SKIDS LOADED`',
    '',
    '*[Customer Skid]*:',
    snapshot.skidsLoaded.customer.join(', '),
    '',
    '*[Gastech Skid]*:',
    snapshot.skidsLoaded.gastech.join(', '),
    '',
    '`SKIDS EMPTY`',
    '',
    '*[Customer Skid]*:',
    snapshot.skidsEmpty.customer.join(', '),
    '',
    '*[Gastech skid]*:',
    snapshot.skidsEmpty.gastech.join(', '),
    '',
    '`NEW LOADED SKIDS`',
    snapshot.newLoadedSkids.join(', '),
    '',
    '`TRUCKS ON GROUND`',
    snapshot.trucksOnGround.join(', '),
    '',
    '`STANDBY TRUCKS (NO DRIVERS)`',
    snapshot.standbyTrucks.join(', '),
    '',
    '`TRUCKS IN TRANSIT`',
    snapshot.trucksInTransit
      .map((truck) => `${truck.truckNum}(${truck.customer})`)
      .join('\n'),
    '',
    '`RETURNING TRUCKS`',
    snapshot.returningTrucks
      .map((truck) => `${truck.truckNum}(${truck.customer})`)
      .join('\n'),
    '',
    '`MAINTENANCE`',
    '',
    '*[SKIDS]*:',
    snapshot.maintenance.skids.join(', '),
    '',
    '*[TRUCKS]*:',
    snapshot.maintenance.trucks.join(', '),
    '',
    '`SKIDS FOR WASHING`',
    snapshot.skidsForWashing
      .map((skid, index) => `${index + 1}. ${skid.skidNum}(${skid.state})`)
      .join('\n'),
    '',
    '`LANDING GEAR BOX`',
    '',
    `*[LANDING GEARBOX AT LOADING BAY & WASHING BAY]*: ${bay}`,
    '',
    `*[LANDING GEARBOX AT WORKSHOP]*: ${workshop}pcs`,
    '',
    `*[Total landing gearbox]*: ${baseTotal} + (${wooden}) wooden. Grand total = ${grandTotal}`,
    '',
    `*Total new chassis in plant*: ${metrics.newChassisInPlant ?? 0}`,
    '',
    '`WORKING COMPRESSORS`',
    '',
    compressorLines,
    extraLines ? `\n${extraLines}` : '',
    '',
    '*LOGISTICS OFFICER ON DUTY*:',
    `\`${officersOnDuty.toUpperCase()}\``,
  ]
    .join('\n')
    .trim();
}
