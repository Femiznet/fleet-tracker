import { z } from 'zod';
import { ALLOWED_MESSAGE_LISTS } from './config';

const GreenApiSenderDataSchema = z.object({
  chatId: z.string(),
  sender: z.string(),
  senderName: z.string(),
  senderContactName: z.string().optional(),
  chatName: z.string().optional(),
});

const GreenApiExtendedTextDataSchema = z.object({
  text: z.string(),
});

// Covers plain text, extended text (links/formatting), and quoted replies
const GreenApiMessageDataSchema = z.discriminatedUnion('typeMessage', [
  z.object({
    typeMessage: z.literal('textMessage'),
    textMessageData: z.object({
      textMessage: z.string(),
    }),
  }),
  z.object({
    typeMessage: z.literal('extendedTextMessage'),
    extendedTextMessageData: GreenApiExtendedTextDataSchema,
  }),
  z.object({
    typeMessage: z.literal('quotedMessage'),
    extendedTextMessageData: GreenApiExtendedTextDataSchema,
    quotedMessage: z.record(z.string(), z.unknown()).optional(),
  }),
]);

// EXPORTS 
export const GreenApiIncomingWebhookSchema = z.object({
  typeWebhook: z.literal('incomingMessageReceived'),
  senderData: GreenApiSenderDataSchema,
  messageData: GreenApiMessageDataSchema,
});

export type GreenApiSenderData = z.infer<typeof GreenApiSenderDataSchema>;
export type GreenApiIncomingWebhook = z.infer<typeof GreenApiIncomingWebhookSchema>;



// HELPER FUNCTIONS

type GreenApiParsedMessage = {
  from: string;
  textMessage: string;
  senderData: GreenApiSenderData;
};

// Infer the exact treeified error type directly from Zod
type GreenApiTreeError = ReturnType<typeof z.treeifyError<GreenApiIncomingWebhook>>;

export type GreenApiMessageResult =
  | { status: 'parsed'; data: GreenApiParsedMessage; error: null }
  | { status: 'ignored'; reason: 'CHAT_NOT_ALLOWED' | 'UNSUPPORTED_WEBHOOK'; chatId: string; data: null; error: null }
  | { status: 'invalid'; data: null; error: GreenApiTreeError };

export function parseGreenApiMessage(payload: unknown): GreenApiMessageResult {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'typeWebhook' in payload &&
    payload.typeWebhook !== 'incomingMessageReceived'
  ) {
    return {
      status: 'ignored',
      reason: 'UNSUPPORTED_WEBHOOK', // Add to your `reason` union if needed
      chatId: '',
      data: null,
      error: null,
    };
  }
  
  const result = GreenApiIncomingWebhookSchema.safeParse(payload);

  if (!result.success) {
    return {
      status: 'invalid',
      data: null,
      error: z.treeifyError(result.error),
    };
  }


  const { senderData, messageData } = result.data;

  if (!Object.hasOwn(ALLOWED_MESSAGE_LISTS, senderData.chatId)) {
    return {
      status: 'ignored',
      reason: 'CHAT_NOT_ALLOWED',
      chatId: senderData.chatId,
      data: null,
      error: null,
    };
  }
  
  // Optional: You can now grab the configured label for that chatId
  const configChatLabel = ALLOWED_MESSAGE_LISTS[senderData.chatId];

  const textMessage =
    messageData.typeMessage === 'textMessage'
      ? messageData.textMessageData.textMessage
      : messageData.extendedTextMessageData.text;

  return {
    status: 'parsed',
    data: {
      from: configChatLabel,
      textMessage,
      senderData,
    },
    error: null,
  };
}

