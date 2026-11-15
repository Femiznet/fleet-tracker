import { DbTransaction, dbtx } from '@/db'; // Adjust path to your Drizzle db instance
import { messages, type Message } from '@/db/schema/messages';
import { GreenApiSenderData } from './validator';

type SaveGreenApiMessageInput = {
    tx?: DbTransaction;
  customerId: string;
  textMessage: string;
  senderData: GreenApiSenderData;
};

export async function saveGreenApiMessage({
  customerId,
  textMessage,
    senderData,
  tx,
}: SaveGreenApiMessageInput): Promise<Message> {
  const [insertedMessage] = await dbtx(tx)
    .insert(messages)
    .values({
      customerId,
      text: textMessage,
      metadata: senderData,
    })
    .returning();

  return insertedMessage;
}
