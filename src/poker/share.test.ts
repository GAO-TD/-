import test from 'node:test';
import assert from 'node:assert/strict';
import { createCard } from './evaluator.ts';
import {
  decodeSharedHand,
  encodeSharedHand,
  formatHandSummaryText,
} from './share.ts';

test('encodes and decodes a shared hand snapshot losslessly', () => {
  const payload = {
    handNumber: 7,
    smallBlind: 20,
    bigBlind: 40,
    potTotal: 640,
    heroNet: 320,
    winningSummary: '阿豪 · 同花 · A高',
    heroHoleCards: [createCard(14, 'spades'), createCard(10, 'spades')],
    communityCards: [
      createCard(13, 'spades'),
      createCard(7, 'spades'),
      createCard(2, 'spades'),
      createCard(9, 'hearts'),
      createCard(4, 'clubs'),
    ],
    playerCount: 6,
    sharedBy: '阿豪',
  };

  const token = encodeSharedHand(payload);
  assert.ok(token.length > 10);
  assert.ok(!token.includes('=') && !token.includes('+') && !token.includes('/'));

  const decoded = decodeSharedHand(token);
  assert.ok(decoded);
  assert.equal(decoded.handNumber, 7);
  assert.equal(decoded.potTotal, 640);
  assert.equal(decoded.heroNet, 320);
  assert.equal(decoded.winningSummary, '阿豪 · 同花 · A高');
  assert.equal(decoded.heroHoleCards.length, 2);
  assert.equal(decoded.heroHoleCards[0].id, 'As');
  assert.equal(decoded.communityCards.length, 5);
  assert.equal(decoded.sharedBy, '阿豪');

  const text = formatHandSummaryText(decoded, 'https://example.com/?hand=' + token);
  assert.ok(text.includes('♠A'));
  assert.ok(text.includes('+¥320'));
});
