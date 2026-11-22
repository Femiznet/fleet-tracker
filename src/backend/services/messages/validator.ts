import { z } from 'zod';
import { ALLOWED_MESSAGE_LISTS } from './config';

const ACCEPTED_MESSAGE_TYPES = new Set([
  'textMessage',
  'extendedTextMessage',
  'quotedMessage',
  'editedMessage',
  'deletedMessage',
]);

const GreenApiSenderDataSchema = z.object({
  chatId: z.string(),
  sender: z.string(),
  senderName: z.string(),
  senderContactName: z.string().optional(),
  chatName: z.string().optional(),
});

// Stage 1 Schema: Validates outer webhook; idMessage is optional because edits/deletes omit it
const GreenApiBaseWebhookSchema = z.object({
  typeWebhook: z.literal('incomingMessageReceived'),
  idMessage: z.string().optional(),
  senderData: GreenApiSenderDataSchema,
  messageData: z
    .object({
      typeMessage: z.string(),
    })
    .loose(),
});

const GreenApiOutgoingWebhookSchema = z.object({
  typeWebhook: z.literal('outgoingMessageReceived'),
  idMessage: z.string().min(1),
  timestamp: z.number().int().positive(),
  senderData: z.object({
    chatId: z.string().min(1),
  }),
  messageData: z.discriminatedUnion('typeMessage', [
    z.object({
      typeMessage: z.literal('textMessage'),
      textMessageData: z.object({ textMessage: z.string() }),
    }),
    z.object({
      typeMessage: z.literal('extendedTextMessage'),
      extendedTextMessageData: z.object({ text: z.string() }),
    }),
  ]),
});

const GreenApiExtendedTextDataSchema = z.object({
  text: z.string(),
});

// Handles both plain text edits and extended/quoted text edits
const GreenApiEditedMessageDataSchema = z.union([
  z.object({
    stanzaId: z.string(),
    textMessage: z.string(),
    typeMessage: z.string().optional(),
  }),
  z.object({
    stanzaId: z.string(),
    extendedTextMessageData: GreenApiExtendedTextDataSchema,
    typeMessage: z.string().optional(),
  }),
]);

// Stage 2 Schema: Strictly parses all 5 accepted message structures
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
  z.object({
    typeMessage: z.literal('editedMessage'),
    editedMessageData: GreenApiEditedMessageDataSchema,
  }),
  z.object({
    typeMessage: z.literal('deletedMessage'),
    deletedMessageData: z.object({
      stanzaId: z.string(),
    }),
  }),
]);

export type GreenApiSenderData = z.infer<typeof GreenApiSenderDataSchema>;
export type BaseWebhook = z.infer<typeof GreenApiBaseWebhookSchema>;
export type GreenApiOutgoingWebhook = z.infer<typeof GreenApiOutgoingWebhookSchema>;
type MessageData = z.infer<typeof GreenApiMessageDataSchema>;

type BaseTreeError = ReturnType<typeof z.treeifyError<BaseWebhook>>;
type MessageDataTreeError = ReturnType<typeof z.treeifyError<MessageData>>;

export type FailureReason =
  'CHAT_NOT_ALLOWED' | 'UNSUPPORTED_MESSAGE_TYPE' | 'CUSTOMER_NOT_FOUND' | 'ZOD_PARSER_FAILED';

export type GreenApiParsedMessage = {
  action: 'create' | 'edit' | 'delete';
  messageId: string;
  geofenceName: string;
  textMessage: string | null;
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

export function parseGreenApiOutgoingMessage(payload: unknown) {
  const parsed = GreenApiOutgoingWebhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  return {
    messageId: parsed.data.idMessage,
    chatId: parsed.data.senderData.chatId,
    sentAt: new Date(parsed.data.timestamp * 1000),
    text:
      parsed.data.messageData.typeMessage === 'textMessage'
        ? parsed.data.messageData.textMessageData.textMessage
        : parsed.data.messageData.extendedTextMessageData.text,
  };
}

export function parseGreenApiMessage(payload: unknown): GreenApiMessageResult {
  // 1. Validate outer webhook shape
  const baseResult = GreenApiBaseWebhookSchema.safeParse(payload);

  if (!baseResult.success) {
    return {
      status: 'invalid',
      reason: 'ZOD_PARSER_FAILED',
      data: null,
      error: z.treeifyError(baseResult.error),
    };
  }

  const { idMessage, senderData, messageData } = baseResult.data;

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

  const data = parsedMessage.data;
  const geofenceName = ALLOWED_MESSAGE_LISTS[senderData.chatId];

  // 5. Normalize action, target messageId, and textMessage
  if (data.typeMessage === 'deletedMessage') {
    return {
      status: 'parsed',
      data: {
        action: 'delete',
        messageId: data.deletedMessageData.stanzaId,
        geofenceName,
        textMessage: null,
        senderData,
      },
      error: null,
    };
  }

  if (data.typeMessage === 'editedMessage') {
    const edited = data.editedMessageData;
    const editedText =
      'textMessage' in edited ? edited.textMessage : edited.extendedTextMessageData.text;

    return {
      status: 'parsed',
      data: {
        action: 'edit',
        messageId: edited.stanzaId,
        geofenceName,
        textMessage: editedText,
        senderData,
      },
      error: null,
    };
  }

  // For new messages (textMessage, extendedTextMessage, quotedMessage), root idMessage is required
  if (!idMessage) {
    return {
      status: 'invalid',
      reason: 'ZOD_PARSER_FAILED',
      data: null,
      error: null,
    };
  }

  const textMessage =
    data.typeMessage === 'textMessage'
      ? data.textMessageData.textMessage
      : data.extendedTextMessageData.text;

  return {
    status: 'parsed',
    data: {
      action: 'create',
      messageId: idMessage,
      geofenceName,
      textMessage,
      senderData,
    },
    error: null,
  };
}
