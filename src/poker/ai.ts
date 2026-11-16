import { getLegalActions, getTotalPotAmount } from './engine.ts';
import { estimatePreFlopStrength, evaluateBestHand } from './evaluator.ts';
import { HandCategory } from './types.ts';
import type { AIPersonality, Card, GameTableState, PlayerAction } from './types.ts';

interface PersonalityWeights {
  vpip: number; // Willingness to enter pots
  aggression: number; // Raise/bet tendency
  bluffRate: number; // Bluff frequency
  foldResistance: number; // Resistance to folding marginal hands
}

const PERSONALITY_CONFIG: Record<AIPersonality, PersonalityWeights> = {
  tight: { vpip: 0.28, aggression: 0.55, bluffRate: 0.06, foldResistance: 0.2 },
  aggressive: { vpip: 0.52, aggression: 0.78, bluffRate: 0.22, foldResistance: 0.35 },
  balanced: { vpip: 0.42, aggression: 0.6, bluffRate: 0.12, foldResistance: 0.3 },
  loose: { vpip: 0.65, aggression: 0.65, bluffRate: 0.18, foldResistance: 0.45 },
  calling_station: { vpip: 0.72, aggression: 0.2, bluffRate: 0.04, foldResistance: 0.68 },
};

function hasFlushDraw(cards: Card[]): boolean {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    counts[c.suit] = (counts[c.suit] ?? 0) + 1;
    if (counts[c.suit] === 4) return true;
  }
  return false;
}

function hasOpenEndedStraightDraw(cards: Card[]): boolean {
  const ranks = Array.from(new Set(cards.map((c) => c.rank))).sort((a, b) => a - b);
  if (ranks.includes(14)) ranks.unshift(1 as never);
  let consecutive = 1;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] === ranks[i - 1] + 1) {
      consecutive++;
      if (consecutive >= 4) return true;
    } else {
      consecutive = 1;
    }
  }
  return false;
}

function evaluatePostFlopStrength(holeCards: Card[], communityCards: Card[]): number {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return 0.3;

  const evaluated = evaluateBestHand(all);
  let base = 0.2;

  switch (evaluated.category) {
    case HandCategory.RoyalFlush:
    case HandCategory.StraightFlush:
      base = 0.99;
      break;
    case HandCategory.FourOfAKind:
      base = 0.96;
      break;
    case HandCategory.FullHouse:
      base = 0.91;
      break;
    case HandCategory.Flush:
      base = 0.82;
      break;
    case HandCategory.Straight:
      base = 0.76;
      break;
    case HandCategory.ThreeOfAKind:
      base = 0.68;
      break;
    case HandCategory.TwoPair:
      base = 0.56;
      break;
    case HandCategory.OnePair: {
      // Top pair / overpair check
      const boardMax = Math.max(...communityCards.map((c) => c.rank));
      const holeHigh = Math.max(...holeCards.map((c) => c.rank));
      const isPocketPair = holeCards[0].rank === holeCards[1].rank;
      const hitBoard = holeCards.some((h) => communityCards.some((b) => b.rank === h.rank));
      if (isPocketPair && holeHigh > boardMax) base = 0.52;
      else if (hitBoard && holeHigh >= boardMax) base = 0.48;
      else if (hitBoard) base = 0.38;
      else base = 0.28; // Board pair only
      break;
    }
    case HandCategory.HighCard:
      base = Math.max(holeCards[0].rank, holeCards[1].rank) >= 13 ? 0.22 : 0.12;
      break;
  }

  // Add equity bonus on flop/turn for draws
  if (communityCards.length < 5) {
    if (hasFlushDraw(all)) base = Math.min(0.85, base + 0.18);
    if (hasOpenEndedStraightDraw(all)) base = Math.min(0.82, base + 0.14);
  }

  return base;
}

export function chooseAIAction(
  state: GameTableState,
  playerIndex: number,
  rng: () => number = Math.random
): PlayerAction {
  const player = state.players[playerIndex];
  const legal = getLegalActions(state, playerIndex);

  if (!player || state.actingPlayerIndex !== playerIndex) {
    return { type: 'check' };
  }

  const weights = PERSONALITY_CONFIG[player.personality ?? 'balanced'];
  const potTotal = Math.max(state.bigBlind * 2, getTotalPotAmount(state));
  const potOdds = legal.callAmount > 0 ? legal.callAmount / (potTotal + legal.callAmount) : 0;

  const strength =
    state.street === 'preflop'
      ? estimatePreFlopStrength(player.holeCards[0], player.holeCards[1])
      : evaluatePostFlopStrength(player.holeCards, state.communityCards);

  const noise = (rng() - 0.5) * 0.14;
  const effectiveStrength = Math.max(0, Math.min(1, strength + noise));

  // Decide sizing helper
  const pickRaiseTo = (multiplier: number): number => {
    const potBased =
      state.currentBet === 0
        ? Math.round(potTotal * multiplier)
        : Math.round(state.currentBet + (potTotal + legal.callAmount) * multiplier);
    const rounded = Math.round(potBased / Math.max(5, state.smallBlind)) * Math.max(5, state.smallBlind);
    const clamped = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, rounded));
    return clamped;
  };

  // Preflop threshold scaled by personality VPIP
  const preflopThreshold = 0.72 - weights.vpip * 0.55;

  if (!legal.canCall && legal.canCheck) {
    // Facing no bet (can check or bet/raise)
    const shouldBet =
      legal.canRaise &&
      (effectiveStrength > 0.56 - weights.aggression * 0.14 ||
        rng() < weights.bluffRate);

    if (shouldBet) {
      const sizeMult = effectiveStrength > 0.8 ? 0.75 : 0.55;
      const raiseTo = pickRaiseTo(sizeMult);
      if (raiseTo >= legal.maxRaiseTo) {
        return { type: 'allin' };
      }
      return { type: 'raise', raiseTo };
    }
    return { type: 'check' };
  }

  // Facing a bet/raise (callAmount > 0)
  const requiredStrength =
    state.street === 'preflop'
      ? Math.max(preflopThreshold, potOdds + 0.08)
      : Math.max(0.24, potOdds + 0.12 - weights.foldResistance * 0.12);

  // Strong hand: raise or jam
  if (
    legal.canRaise &&
    (effectiveStrength > 0.76 - weights.aggression * 0.12 ||
      (rng() < weights.bluffRate * 0.5 && legal.callAmount < player.chips * 0.35))
  ) {
    // Avoid infinite raise wars with mediocre hands
    if (state.currentBet <= state.bigBlind * 8 || effectiveStrength > 0.82) {
      const raiseTo = pickRaiseTo(effectiveStrength > 0.85 ? 0.85 : 0.6);
      if (raiseTo >= legal.maxRaiseTo || raiseTo > player.chips * 0.8) {
        return { type: 'allin' };
      }
      return { type: 'raise', raiseTo };
    }
  }

  // Call if hand justifies pot odds or short-stack committed
  if (
    effectiveStrength >= requiredStrength ||
    legal.callAmount <= state.bigBlind * 0.5 ||
    (player.betThisRound > potTotal * 0.35 && effectiveStrength > 0.32)
  ) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
