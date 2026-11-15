import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema/customers';
import { messages, type Message } from '@/db/schema/messages';
import type { GreenApiParsedMessage } from '@/services/messages/validator';

type ProcessGreenApiMessageResult =
  | { success: true; data: Message }
  | { success: false; message: string };

export async function processAndSaveGreenApiMessage({
  geofenceName,
  textMessage,
  senderData,
}: GreenApiParsedMessage): Promise<ProcessGreenApiMessageResult> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.geofenceName, geofenceName))
    .limit(1);

  if (!customer) {
    return {
      success: false,
      message: `CUSTOMER_NOT_FOUND: ${geofenceName}`,
    };
  }

  const [savedMessage] = await db
    .insert(messages)
    .values({
      customerId: customer.id,
      text: textMessage,
      metadata: senderData,
    })
    .returning();

  return {
    success: true,
    data: savedMessage,
  };
}
