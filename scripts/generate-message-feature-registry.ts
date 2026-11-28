import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(root, 'src', 'generated', 'messages-feature.ts');

const sharedExports = `export type IncomingMessageResult =
  | { status: 'invalid'; reason: string; error: unknown }
  | { status: 'failed'; message: string }
  | { status: 'processed' }
  | { status: 'unavailable' };

`;

const featureAvailable = isFeatureAvailable('messages');

const featureExports = featureAvailable
  ? `import { findCustomerByGeofenceName } from './customers-feature';
import {
  handleIncomingMessage as handleInstalledMessages,
  processPendingMessages as processInstalledMessages,
} from '../../packages/features/messages/index';

export const messagesFeatureAvailable: boolean = true;

export async function handleIncomingMessage(
  payload: unknown
): Promise<IncomingMessageResult> {
  return handleInstalledMessages(payload, findCustomerByGeofenceName);
}

export function processPendingMessages() {
  return processInstalledMessages();
}
`
  : `export const messagesFeatureAvailable: boolean = false;

export async function handleIncomingMessage(
  _payload: unknown
): Promise<IncomingMessageResult> {
  return { status: 'unavailable' };
}

export async function processPendingMessages(): Promise<never> {
  throw new Error('The messages feature is not installed');
}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${sharedExports}${featureExports}`);
