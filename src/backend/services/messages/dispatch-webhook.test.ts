import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseGreenApiMessage,
  parseGreenApiOutgoingMessage,
} from './validator';

const dispatchText = [
  '*Truck/Skid Dispatch Details*',
  '*Truck Number*: TRUCK-12',
  '*Skid Number*: SKID123',
  '*Driver Name:* Ada Driver',
  '*Date Out*: 21/11/2026',
  '*Time Out*: 2:30 PM',
].join('\n');

test('accepts a colleague dispatch notice received in an allowed customer group', () => {
  const result = parseGreenApiMessage({
    typeWebhook: 'incomingMessageReceived',
    idMessage: 'incoming-notice-1',
    senderData: {
      chatId: '120363421659927804@g.us',
      sender: '2348000000000@c.us',
      senderName: 'Colleague',
    },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: dispatchText },
    },
  });

  assert.equal(result.status, 'parsed');
  if (result.status === 'parsed') {
    assert.equal(result.data.textMessage, dispatchText);
    assert.equal(result.data.senderData.chatId, '120363421659927804@g.us');
  }
});

test('parses a dispatch notice sent manually from the GreenAPI phone', () => {
  const result = parseGreenApiOutgoingMessage({
    typeWebhook: 'outgoingMessageReceived',
    idMessage: 'outgoing-notice-1',
    timestamp: 1795285840,
    senderData: {
      chatId: '120363421659927804@g.us',
    },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: dispatchText },
    },
  });

  assert.deepEqual(result, {
    messageId: 'outgoing-notice-1',
    chatId: '120363421659927804@g.us',
    sentAt: new Date(1795285840 * 1000),
    text: dispatchText,
  });
});
