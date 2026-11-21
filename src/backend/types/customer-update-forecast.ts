export type ForecastStatus = 'estimated' | 'needs_review' | 'unavailable';

export interface PrmsSkidForecast {
  prmsId: number;
  skidNumbers: string[];
  pressureBar: number | null;
  flowRateScmPerHour: number | null;
  estimatedHoursRemaining: number | null;
  estimatedTimeRemaining: string | null;
  status: ForecastStatus;
  warnings: string[];
}

export interface CustomerUpdateForecast {
  messageId: string;
  receivedAt: Date | null;
  reportedAt: string | null;
  parseStatus: 'ok' | 'needs_review' | 'failed';
  warnings: string[];
  prmsForecasts: PrmsSkidForecast[];
}
