import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRunoutStreet,
  applyAction,
  createInitialTable,
  getLegalActions,
  startNewHand,
} from './engine';
import { createCard } from './evaluator';
import { calculateSidePots, resolveAndDistributePots } from './pots';
import { Player } from './types';

function makeDeterministicRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('heads-up rules: Dealer is Small Blind and acts first preflop, BB acts first postflop', () => {
  const state = createInitialTable(
    { playerCount: 2, startingChips: 1000, smallBlind: 10, bigBlind: 20 },
    makeDeterministicRng(1)
  );

  assert.equal(state.dealerIndex, state.sbIndex);
  assert.notEqual(state.dealerIndex, state.bbIndex);
  assert.equal(state.actingPlayerIndex, state.sbIndex);

  // SB calls, BB checks -> flop starts with BB acting first
  let next = applyAction(state, state.sbIndex, { type: 'call' });
  assert.equal(next.actingPlayerIndex, state.bbIndex);
  next = applyAction(next, state.bbIndex, { type: 'check' });

  assert.equal(next.street, 'flop');
  assert.equal(next.communityCards.length, 3);
  assert.equal(next.actingPlayerIndex, state.bbIndex);
});

test('multi-way side pots and odd chips are distributed accurately', () => {
  const players: Player[] = [
    {
      id: 'p0',
      seatIndex: 0,
      name: 'P0',
      isHuman: true,
      chips: 0,
      betThisRound: 0,
      totalContributed: 100,
      holeCards: [createCard(14, 'spades'), createCard(14, 'hearts')], // Trips A (strongest)
      status: 'allin',
      hasActedSinceFullRaise: true,
    },
    {
      id: 'p1',
      seatIndex: 1,
      name: 'P1',
      isHuman: false,
      chips: 0,
      betThisRound: 0,
      totalContributed: 300,
      holeCards: [createCard(13, 'spades'), createCard(13, 'hearts')], // Trips K
      status: 'allin',
      hasActedSinceFullRaise: true,
    },
    {
      id: 'p2',
      seatIndex: 2,
      name: 'P2',
      isHuman: false,
      chips: 700,
      betThisRound: 0,
      totalContributed: 300,
      holeCards: [createCard(7, 'clubs'), createCard(2, 'diamonds')], // Weak
      status: 'active',
      hasActedSinceFullRaise: true,
    },
    {
      id: 'p3',
      seatIndex: 3,
      name: 'P3',
      isHuman: false,
      chips: 950,
      betThisRound: 0,
      totalContributed: 50, // Folded after contributing 50
      holeCards: [createCard(3, 'clubs'), createCard(4, 'clubs')],
      status: 'folded',
      hasActedSinceFullRaise: true,
    },
  ];

  const community = [
    createCard(14, 'diamonds'),
    createCard(13, 'diamonds'),
    createCard(9, 'spades'),
    createCard(5, 'clubs'),
    createCard(8, 'hearts'),
  ];

  const pots = calculateSidePots(players);
  assert.equal(pots.length, 2);
  // Main pot: 100 + 100 + 100 + 50 (dead money) = 350
  assert.equal(pots[0].amount, 350);
  assert.deepEqual(pots[0].eligiblePlayerIds, ['p0', 'p1', 'p2']);
  // Side pot: (300-100)*2 = 400
  assert.equal(pots[1].amount, 400);
  assert.deepEqual(pots[1].eligiblePlayerIds, ['p1', 'p2']);

  resolveAndDistributePots(pots, players, community, 0);
  assert.equal(players[0].chips, 350);
  assert.equal(players[1].chips, 400);
  assert.equal(players[2].chips, 700);
});

test('incomplete all-in raise does not reopen betting for players who already acted', () => {
  const rng = makeDeterministicRng(99);
  let state = createInitialTable(
    { playerCount: 3, startingChips: 1000, smallBlind: 10, bigBlind: 20 },
    rng
  );
  // Give seat 1 (SB) only 35 total chips remaining (already posted 10 -> 25 chips left, max bet 35)
  state.players[state.sbIndex].chips = 25;

  // Seat 0 (Dealer/BTN) calls 20 preflop
  const firstActor = state.actingPlayerIndex!;
  state = applyAction(state, firstActor, { type: 'call' });

  // Seat 1 (SB) goes all-in to 35 (raise increment is 15 < bigBlind 20 -> incomplete raise!)
  assert.equal(state.actingPlayerIndex, state.sbIndex);
  state = applyAction(state, state.sbIndex, { type: 'allin' });
  assert.equal(state.currentBet, 35);

  // BB has NOT acted yet at this level -> BB CAN raise
  assert.equal(state.actingPlayerIndex, state.bbIndex);
  const bbLegal = getLegalActions(state, state.bbIndex);
  assert.equal(bbLegal.canRaise, true);
  // BB just calls 35
  state = applyAction(state, state.bbIndex, { type: 'call' });

  // Back to firstActor who already called 20: can call 15 or fold, CANNOT raise!
  assert.equal(state.actingPlayerIndex, firstActor);
  const btnLegal = getLegalActions(state, firstActor);
  assert.equal(btnLegal.canCall, true);
  assert.equal(btnLegal.callAmount, 15);
  assert.equal(btnLegal.canRaise, false);
});

test('chip conservation holds across full hand to showdown and next hand start', () => {
  const rng = makeDeterministicRng(7);
  let state = createInitialTable(
    { playerCount: 4, startingChips: 1000, smallBlind: 10, bigBlind: 20 },
    rng
  );
  const initialTotalChips = 4000;

  let guard = 0;
  while (!state.isHandComplete && guard < 100) {
    guard++;
    if (state.isAllInRunout) {
      state = advanceRunoutStreet(state);
      continue;
    }
    const actor = state.actingPlayerIndex!;
    const legal = getLegalActions(state, actor);
    if (legal.canCheck) {
      state = applyAction(state, actor, { type: 'check' });
    } else if (legal.canCall) {
      state = applyAction(state, actor, { type: 'call' });
    } else {
      state = applyAction(state, actor, { type: 'fold' });
    }
  }

  assert.equal(state.isHandComplete, true);
  const totalAfter = state.players.reduce((s, p) => s + p.chips, 0);
  assert.equal(totalAfter, initialTotalChips);

  const hand2 = startNewHand(state, rng);
  assert.equal(hand2.handNumber, 2);
});
