import { db } from "@/backend/db";
import { customers } from "@/backend/db/schema";
import { deleteGreenApiMessage, editGreenApiMessage, ProcessGreenApiMessageResult, saveGreenApiMessage } from "@/backend/services/messages/queries";
import { isDispatchDetails } from "@/backend/services/messages/utils/dispatchParser";
import { isUpdate } from "@/backend/services/messages/utils/updateParser";
import { GreenApiParsedMessage } from "@/backend/services/messages/validator";
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
    const type = isUpdate(parsed.textMessage) ? 'update'
      : isDispatchDetails(parsed.textMessage) ? 'dispatch' : null;
    
    if (!type) return { success: false, message: 'Not an update or dispatch' };

    if (parsed.action === 'create') {
      return saveGreenApiMessage({
        ...baseParams,
        textMessage: parsed.textMessage,
        messageType : type
      });
    }
  
    if (parsed.action === 'edit') {
      return editGreenApiMessage({
        ...baseParams,
        textMessage: parsed.textMessage,
        messageType: type
      });
    }
  }

  return deleteGreenApiMessage(baseParams);
}
