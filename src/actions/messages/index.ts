import { db } from "@/db";
import { customers } from "@/db/schema";
import { deleteGreenApiMessage, editGreenApiMessage, ProcessGreenApiMessageResult, saveGreenApiMessage } from "@/services/messages/queries";
import { GreenApiParsedMessage } from "@/services/messages/validator";
import { eq } from "drizzle-orm";


// 4. Thin entry point called by your webhook route
export async function processGreenApiMessage(
  parsed: GreenApiParsedMessage
): Promise<ProcessGreenApiMessageResult> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.geofenceName, parsed.geofenceName))
    .limit(1);

  if (!customer) {
    return {
      success: false,
      message: `CUSTOMER_NOT_FOUND: ${parsed.geofenceName}`,
    };
  }

  const baseParams = {
    customerId: customer.id,
    messageId: parsed.messageId,
    senderData: parsed.senderData,
  };

  if (parsed.textMessage) {
    if (parsed.action === 'create') {
      return saveGreenApiMessage({
        ...baseParams,
        textMessage: parsed.textMessage,
      });
    }
  
    if (parsed.action === 'edit') {
      return editGreenApiMessage({
        ...baseParams,
        textMessage: parsed.textMessage,
      });
    }
  }

  return deleteGreenApiMessage(baseParams);
}
