import type { DispatchDetails } from '@/backend/services/messages/utils/dispatchParser';

export const DISPATCH_NOTIFICATION_TEMPLATE = [
  '*Truck/Skid Dispatch Details*',
  '*Truck Number*: {{truckNumber}}',
  '*Skid Number*: {{skidNumber}}',
  '*Customer*: {{customerName}}',
  '*Driver Name:* {{driverName}}',
  '*Driver Contact*: {{driverContact}}',
  '*Date Out*: {{dateOut}}',
  '*Time Out*: {{timeOut}}',
].join('\n');

export function createDispatchFingerprint(
  customerId: string,
  details: DispatchDetails
): string | null {
  if (!details.truckNumber || !details.skidNumber || !details.dateOut) {
    return null;
  }

  return [
    customerId,
    details.truckNumber.replace(/\s+/g, '').toUpperCase(),
    details.skidNumber.replace(/\s+/g, '').toUpperCase(),
    details.dateOut,
  ].join(':');
}

export function formatDispatchNotification(details: DispatchDetails): string {
  return DISPATCH_NOTIFICATION_TEMPLATE.replaceAll('{{truckNumber}}', details.truckNumber ?? '')
    .replaceAll('{{skidNumber}}', details.skidNumber ?? '')
    .replaceAll('{{customerName}}', details.customerName ?? '')
    .replaceAll('{{driverName}}', details.driverName ?? '')
    .replaceAll('{{driverContact}}', details.driverContact ?? '')
    .replaceAll('{{dateOut}}', details.dateOut ?? '')
    .replaceAll('{{timeOut}}', details.timeOut ?? '')
    .split('\n')
    .filter((line) => {
      if (line.startsWith('*Customer*:')) return Boolean(details.customerName?.trim());
      if (line.startsWith('*Driver Name:*')) return Boolean(details.driverName?.trim());
      if (line.startsWith('*Driver Contact*:')) return Boolean(details.driverContact?.trim());
      return true;
    })
    .join('\n');
}

export function matchesDispatchNotification(text: string, details: DispatchDetails): boolean {
  if (!details.truckNumber || !details.skidNumber) return false;

  const normalized = text.normalize('NFKC').replace(/\*/g, '').replace(/\s+/g, ' ').toLowerCase();

  return (
    normalized.includes(`truck number: ${details.truckNumber.toLowerCase()}`) &&
    normalized.includes(`skid number: ${details.skidNumber.toLowerCase()}`)
  );
}
