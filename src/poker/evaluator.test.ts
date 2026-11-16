import test from 'node:test';
import assert from 'node:assert/strict';
import { compareHands, createCard, evaluateBestHand, evaluateFiveCards } from './evaluator';
import { HandCategory } from './types';

test('evaluates all 10 Texas Holdem hand categories in strict order', () => {
  const royal = evaluateFiveCards([
    createCard(14, 'spades'),
    createCard(13, 'spades'),
    createCard(12, 'spades'),
    createCard(11, 'spades'),
    createCard(10, 'spades'),
  ]);
  const straightFlush = evaluateFiveCards([
    createCard(9, 'hearts'),
    createCard(8, 'hearts'),
    createCard(7, 'hearts'),
    createCard(6, 'hearts'),
    createCard(5, 'hearts'),
  ]);
  const quads = evaluateFiveCards([
    createCard(14, 'spades'),
    createCard(14, 'hearts'),
    createCard(14, 'diamonds'),
    createCard(14, 'clubs'),
    createCard(2, 'spades'),
  ]);
  const fullHouse = evaluateFiveCards([
    createCard(13, 'spades'),
    createCard(13, 'hearts'),
    createCard(13, 'diamonds'),
    createCard(9, 'clubs'),
    createCard(9, 'spades'),
  ]);
  const flush = evaluateFiveCards([
    createCard(14, 'diamonds'),
    createCard(11, 'diamonds'),
    createCard(8, 'diamonds'),
    createCard(4, 'diamonds'),
    createCard(2, 'diamonds'),
  ]);
  const straight = evaluateFiveCards([
    createCard(10, 'spades'),
    createCard(9, 'hearts'),
    createCard(8, 'clubs'),
    createCard(7, 'diamonds'),
    createCard(6, 'spades'),
  ]);
  const trips = evaluateFiveCards([
    createCard(7, 'spades'),
    createCard(7, 'hearts'),
    createCard(7, 'diamonds'),
    createCard(14, 'clubs'),
    createCard(3, 'spades'),
  ]);
  const twoPair = evaluateFiveCards([
    createCard(12, 'spades'),
    createCard(12, 'hearts'),
    createCard(5, 'diamonds'),
    createCard(5, 'clubs'),
    createCard(14, 'spades'),
  ]);
  const onePair = evaluateFiveCards([
    createCard(10, 'spades'),
    createCard(10, 'hearts'),
    createCard(14, 'diamonds'),
    createCard(8, 'clubs'),
    createCard(2, 'spades'),
  ]);
  const highCard = evaluateFiveCards([
    createCard(14, 'spades'),
    createCard(12, 'hearts'),
    createCard(9, 'diamonds'),
    createCard(5, 'clubs'),
    createCard(2, 'spades'),
  ]);

  const ordered = [
    royal,
    straightFlush,
    quads,
    fullHouse,
    flush,
    straight,
    trips,
    twoPair,
    onePair,
    highCard,
  ];
  const expectedCategories = [
    HandCategory.RoyalFlush,
    HandCategory.StraightFlush,
    HandCategory.FourOfAKind,
    HandCategory.FullHouse,
    HandCategory.Flush,
    HandCategory.Straight,
    HandCategory.ThreeOfAKind,
    HandCategory.TwoPair,
    HandCategory.OnePair,
    HandCategory.HighCard,
  ];

  ordered.forEach((hand, i) => {
    assert.equal(hand.category, expectedCategories[i]);
    if (i > 0) {
      assert.ok(compareHands(ordered[i - 1], hand) > 0);
    }
  });
});

test('recognizes Ace-low wheel straight (A-2-3-4-5) and ranks it below 6-high straight', () => {
  const wheel = evaluateFiveCards([
    createCard(14, 'spades'),
    createCard(2, 'hearts'),
    createCard(3, 'diamonds'),
    createCard(4, 'clubs'),
    createCard(5, 'spades'),
  ]);
  const sixHigh = evaluateFiveCards([
    createCard(6, 'spades'),
    createCard(2, 'hearts'),
    createCard(3, 'diamonds'),
    createCard(4, 'clubs'),
    createCard(5, 'hearts'),
  ]);

  assert.equal(wheel.category, HandCategory.Straight);
  assert.equal(sixHigh.category, HandCategory.Straight);
  assert.ok(compareHands(sixHigh, wheel) > 0);
});

test('selects best 5-card hand from 7 cards and resolves kickers accurately', () => {
  const community = [
    createCard(14, 'spades'),
    createCard(14, 'hearts'),
    createCard(9, 'clubs'),
    createCard(4, 'diamonds'),
    createCard(2, 'spades'),
  ];
  const playerAK = evaluateBestHand([
    createCard(14, 'diamonds'),
    createCard(13, 'spades'),
    ...community,
  ]);
  const playerAQ = evaluateBestHand([
    createCard(14, 'clubs'),
    createCard(12, 'hearts'),
    ...community,
  ]);

  assert.equal(playerAK.category, HandCategory.ThreeOfAKind);
  assert.equal(playerAQ.category, HandCategory.ThreeOfAKind);
  assert.ok(compareHands(playerAK, playerAQ) > 0);
});
