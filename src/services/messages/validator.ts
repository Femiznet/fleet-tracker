import { z } from 'zod';
import { ALLOWED_MESSAGE_LISTS } from './config';

const ACCEPTED_MESSAGE_TYPES = new Set([
  'textMessage',
  'extendedTextMessage',
  'quotedMessage',
]);

const GreenApiSenderDataSchema = z.object({
  chatId: z.string(),
  sender: z.string(),
  senderName: z.string(),
  senderContactName: z.string().optional(),
  chatName: z.string().optional(),
});

// Stage 1 Schema: Validates the outer webhook and captures any typeMessage
const GreenApiBaseWebhookSchema = z.object({
  typeWebhook: z.literal('incomingMessageReceived'),
  senderData: GreenApiSenderDataSchema,
  messageData: z
    .object({
      typeMessage: z.string(),
    })
    .passthrough(),
});

const GreenApiExtendedTextDataSchema = z.object({
  text: z.string(),
});

// Stage 2 Schema: Strictly parses only accepted text/quoted message structures
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

export type GreenApiSenderData = z.infer<typeof GreenApiSenderDataSchema>;

export type BaseWebhook = z.infer<typeof GreenApiBaseWebhookSchema>;
type MessageData = z.infer<typeof GreenApiMessageDataSchema>;

type BaseTreeError = ReturnType<typeof z.treeifyError<BaseWebhook>>;
type MessageDataTreeError = ReturnType<typeof z.treeifyError<MessageData>>;

export type FailureReason =
  | 'CHAT_NOT_ALLOWED'
  | 'UNSUPPORTED_MESSAGE_TYPE'
  | 'CUSTOMER_NOT_FOUND'
  | 'ZOD_PARSER_FAILED';

export type GreenApiParsedMessage = {
  geofenceName: string;
  textMessage: string;
  senderData: GreenApiSenderData;
};

export type GreenApiMessageResult =
  | { status: 'parsed'; data: GreenApiParsedMessage; error: null }
  | {
      status: 'invalid';
      reason: FailureReason;
      data: null;
      error: BaseTreeError | MessageDataTreeError | null;
    };

export function parseGreenApiMessage(payload: unknown): GreenApiMessageResult {
  // 1. Validate outer webhook shape (typeWebhook, senderData, and loose messageData)
  const baseResult = GreenApiBaseWebhookSchema.safeParse(payload);

  if (!baseResult.success) {
    return {
      status: 'invalid',
      reason: 'ZOD_PARSER_FAILED',
      data: null,
      error: z.treeifyError(baseResult.error),
    };
  }

  const { senderData, messageData } = baseResult.data;

  // 2. Check chat allowlist
  if (!Object.hasOwn(ALLOWED_MESSAGE_LISTS, senderData.chatId)) {
    return {
      status: 'invalid',
      reason: 'CHAT_NOT_ALLOWED',
      data: null,
      error: null,
    };
  }

  // 3. Check message type allowlist before running strict messageData parser
  if (!ACCEPTED_MESSAGE_TYPES.has(messageData.typeMessage)) {
    return {
      status: 'invalid',
      reason: 'UNSUPPORTED_MESSAGE_TYPE',
      data: null,
      error: null,
    };
  }

  // 4. Apply strict discriminatedUnion parser to accepted messageData
  const parsedMessage = GreenApiMessageDataSchema.safeParse(messageData);

  if (!parsedMessage.success) {
    return {
      status: 'invalid',
      reason: 'ZOD_PARSER_FAILED',
      data: null,
      error: z.treeifyError(parsedMessage.error),
    };
  }

  const textMessage =
    parsedMessage.data.typeMessage === 'textMessage'
      ? parsedMessage.data.textMessageData.textMessage
      : parsedMessage.data.extendedTextMessageData.text;

  return {
    status: 'parsed',
    data: {
      geofenceName: ALLOWED_MESSAGE_LISTS[senderData.chatId],
      textMessage,
      senderData,
    },
    error: null,
  };
}
