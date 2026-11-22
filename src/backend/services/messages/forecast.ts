import type {
  CustomerUpdateForecast,
  PrmsSkidForecast,
} from '@/backend/types/customer-update-forecast';
import type { CustomerUpdateMessage } from '@/backend/services/messages/utils/updateParser';

const SKID_VOLUME_CONVERSION = 28;

export function formatForecastDuration(hours: number | null): string | null {
  if (hours === null) return null;

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return `${wholeHours}h:${String(remainingMinutes).padStart(2, '0')}mins`;
}

function skidNumbers(value: string | string[] | null): string[] {
  if (value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function calculateCustomerUpdateForecast(input: {
  messageId: string;
  receivedAt: Date | null;
  parseStatus: CustomerUpdateForecast['parseStatus'];
  warnings: string[];
  data: CustomerUpdateMessage | null;
}): CustomerUpdateForecast {
  const prmsForecasts: PrmsSkidForecast[] = (input.data?.PRMS ?? []).map((prms) => {
    const skidNumbersInUse = skidNumbers(prms.skidinuse);
    const warnings: string[] = [];

    let estimatedHoursRemaining: number | null = null;
    if (prms.pressure === null) {
      warnings.push('missing_pressure');
    } else if (prms.flowrate === null) {
      warnings.push('missing_flowrate');
    } else if (prms.flowrate <= 0) {
      warnings.push('flowrate_must_be_positive');
    } else {
      estimatedHoursRemaining = (prms.pressure * SKID_VOLUME_CONVERSION) / prms.flowrate;
    }

    if (skidNumbersInUse.length === 0) {
      warnings.push('missing_skid_in_use');
    } else if (skidNumbersInUse.length > 1) {
      warnings.push('multiple_skids_in_use');
    }

    const status =
      estimatedHoursRemaining === null
        ? 'unavailable'
        : input.parseStatus !== 'ok' || input.warnings.length > 0 || warnings.length > 0
          ? 'needs_review'
          : 'estimated';

    return {
      prmsId: prms.id,
      skidNumbers: skidNumbersInUse,
      pressureBar: prms.pressure,
      flowRateScmPerHour: prms.flowrate,
      estimatedHoursRemaining,
      estimatedTimeRemaining: formatForecastDuration(estimatedHoursRemaining),
      status,
      warnings,
    };
  });

  return {
    messageId: input.messageId,
    receivedAt: input.receivedAt,
    reportedAt: input.data?.reportedAt ?? null,
    parseStatus: input.parseStatus,
    warnings: input.warnings,
    prmsForecasts,
  };
}
