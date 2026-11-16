import { HandCategory } from './types.ts';
import type { Card, EvaluatedHand, Rank, Suit } from './types.ts';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const SUIT_CHAR: Record<Suit, string> = {
  spades: 's',
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
};

export function rankToShort(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    case 10:
      return '10';
    default:
      return String(rank);
  }
}

export function rankToIdChar(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    case 10:
      return 'T';
    default:
      return String(rank);
  }
}

export function createCard(rank: Rank, suit: Suit): Card {
  return {
    id: `${rankToIdChar(rank)}${SUIT_CHAR[suit]}`,
    suit,
    rank,
  };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

const CATEGORY_META: Record<HandCategory, { zh: string; en: string }> = {
  [HandCategory.HighCard]: { zh: '高牌', en: 'High Card' },
  [HandCategory.OnePair]: { zh: '一对', en: 'One Pair' },
  [HandCategory.TwoPair]: { zh: '两对', en: 'Two Pair' },
  [HandCategory.ThreeOfAKind]: { zh: '三条', en: 'Three of a Kind' },
  [HandCategory.Straight]: { zh: '顺子', en: 'Straight' },
  [HandCategory.Flush]: { zh: '同花', en: 'Flush' },
  [HandCategory.FullHouse]: { zh: '葫芦', en: 'Full House' },
  [HandCategory.FourOfAKind]: { zh: '四条', en: 'Four of a Kind' },
  [HandCategory.StraightFlush]: { zh: '同花顺', en: 'Straight Flush' },
  [HandCategory.RoyalFlush]: { zh: '皇家同花顺', en: 'Royal Flush' },
};

function encodeScore(category: HandCategory, tiebreakers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (tiebreakers[i] ?? 0);
  }
  return score;
}

/** Evaluates an exact 5-card poker hand. */
export function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error(`evaluateFiveCards requires exactly 5 cards, got ${cards.length}`);
  }

  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);

  // Check flush
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);

  // Check straight (including A-2-3-4-5 wheel)
  const uniqueRanks = Array.from(new Set(ranks));
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // 5-high wheel straight
    }
  }

  // Group counts by rank
  const countMap = new Map<Rank, number>();
  for (const r of ranks) {
    countMap.set(r, (countMap.get(r) ?? 0) + 1);
  }

  // Sort groups by (count desc, rank desc)
  const groups = Array.from(countMap.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        category: HandCategory.RoyalFlush,
        categoryNameZh: CATEGORY_META[HandCategory.RoyalFlush].zh,
        categoryNameEn: CATEGORY_META[HandCategory.RoyalFlush].en,
        score: encodeScore(HandCategory.RoyalFlush, [14]),
        bestFive: sorted,
        descriptionZh: '皇家同花顺',
      };
    }
    // Order wheel nicely if 5-high
    const orderedFive =
      straightHigh === 5
        ? [...sorted.slice(1), sorted[0]]
        : sorted;
    return {
      category: HandCategory.StraightFlush,
      categoryNameZh: CATEGORY_META[HandCategory.StraightFlush].zh,
      categoryNameEn: CATEGORY_META[HandCategory.StraightFlush].en,
      score: encodeScore(HandCategory.StraightFlush, [straightHigh]),
      bestFive: orderedFive,
      descriptionZh: `同花顺 · ${rankToShort(straightHigh as Rank)}高`,
    };
  }

  if (groups[0][1] === 4) {
    const quadRank = groups[0][0];
    const kicker = groups[1][0];
    return {
      category: HandCategory.FourOfAKind,
      categoryNameZh: CATEGORY_META[HandCategory.FourOfAKind].zh,
      categoryNameEn: CATEGORY_META[HandCategory.FourOfAKind].en,
      score: encodeScore(HandCategory.FourOfAKind, [quadRank, kicker]),
      bestFive: sorted,
      descriptionZh: `四条 · ${rankToShort(quadRank)}`,
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const tripsRank = groups[0][0];
    const pairRank = groups[1][0];
    return {
      category: HandCategory.FullHouse,
      categoryNameZh: CATEGORY_META[HandCategory.FullHouse].zh,
      categoryNameEn: CATEGORY_META[HandCategory.FullHouse].en,
      score: encodeScore(HandCategory.FullHouse, [tripsRank, pairRank]),
      bestFive: sorted,
      descriptionZh: `葫芦 · ${rankToShort(tripsRank)}带${rankToShort(pairRank)}`,
    };
  }

  if (isFlush) {
    return {
      category: HandCategory.Flush,
      categoryNameZh: CATEGORY_META[HandCategory.Flush].zh,
      categoryNameEn: CATEGORY_META[HandCategory.Flush].en,
      score: encodeScore(HandCategory.Flush, ranks),
      bestFive: sorted,
      descriptionZh: `同花 · ${rankToShort(ranks[0])}高`,
    };
  }

  if (isStraight) {
    const orderedFive =
      straightHigh === 5
        ? [...sorted.slice(1), sorted[0]]
        : sorted;
    return {
      category: HandCategory.Straight,
      categoryNameZh: CATEGORY_META[HandCategory.Straight].zh,
      categoryNameEn: CATEGORY_META[HandCategory.Straight].en,
      score: encodeScore(HandCategory.Straight, [straightHigh]),
      bestFive: orderedFive,
      descriptionZh: `顺子 · ${rankToShort(straightHigh as Rank)}高`,
    };
  }

  if (groups[0][1] === 3) {
    const tripsRank = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      category: HandCategory.ThreeOfAKind,
      categoryNameZh: CATEGORY_META[HandCategory.ThreeOfAKind].zh,
      categoryNameEn: CATEGORY_META[HandCategory.ThreeOfAKind].en,
      score: encodeScore(HandCategory.ThreeOfAKind, [tripsRank, ...kickers]),
      bestFive: sorted,
      descriptionZh: `三条 · ${rankToShort(tripsRank)}`,
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = groups[0][0];
    const lowPair = groups[1][0];
    const kicker = groups[2][0];
    return {
      category: HandCategory.TwoPair,
      categoryNameZh: CATEGORY_META[HandCategory.TwoPair].zh,
      categoryNameEn: CATEGORY_META[HandCategory.TwoPair].en,
      score: encodeScore(HandCategory.TwoPair, [highPair, lowPair, kicker]),
      bestFive: sorted,
      descriptionZh: `两对 · ${rankToShort(highPair)}和${rankToShort(lowPair)}`,
    };
  }

  if (groups[0][1] === 2) {
    const pairRank = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      category: HandCategory.OnePair,
      categoryNameZh: CATEGORY_META[HandCategory.OnePair].zh,
      categoryNameEn: CATEGORY_META[HandCategory.OnePair].en,
      score: encodeScore(HandCategory.OnePair, [pairRank, ...kickers]),
      bestFive: sorted,
      descriptionZh: `一对 · ${rankToShort(pairRank)}`,
    };
  }

  return {
    category: HandCategory.HighCard,
    categoryNameZh: CATEGORY_META[HandCategory.HighCard].zh,
    categoryNameEn: CATEGORY_META[HandCategory.HighCard].en,
    score: encodeScore(HandCategory.HighCard, ranks),
    bestFive: sorted,
    descriptionZh: `高牌 · ${rankToShort(ranks[0])}`,
  };
}

/** Finds the best 5-card Texas Hold'em hand from 5 to 7 cards. */
export function evaluateBestHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards to evaluate hand, got ${cards.length}`);
  }
  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  let best: EvaluatedHand | null = null;
  const n = cards.length;

  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const candidate = evaluateFiveCards([
              cards[i],
              cards[j],
              cards[k],
              cards[l],
              cards[m],
            ]);
            if (!best || candidate.score > best.score) {
              best = candidate;
            }
          }
        }
      }
    }
  }

  return best!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return a.score - b.score;
}

/**
 * Provides a human-readable hint of the player's current hand strength
 * both preflop (2 cards) and postflop (5-7 cards).
 */
export function describePlayerHand(holeCards: Card[], communityCards: Card[]): string {
  if (holeCards.length < 2) return '';
  const all = [...holeCards, ...communityCards];
  if (all.length >= 5) {
    return evaluateBestHand(all).descriptionZh;
  }

  // Preflop 2-card summary
  const [c1, c2] = [...holeCards].sort((a, b) => b.rank - a.rank);
  const suited = c1.suit === c2.suit;
  if (c1.rank === c2.rank) {
    return `口袋对 · ${rankToShort(c1.rank)}`;
  }
  const suffix = suited ? '同花' : '杂色';
  return `${rankToShort(c1.rank)}${rankToShort(c2.rank)} ${suffix}`;
}

/**
 * Chen-inspired normalized preflop strength [0..1] for AI evaluation.
 */
export function estimatePreFlopStrength(c1: Card, c2: Card): number {
  const high = Math.max(c1.rank, c2.rank);
  const low = Math.min(c1.rank, c2.rank);
  const isPair = high === low;
  const isSuited = c1.suit === c2.suit;
  const gap = high - low;

  const baseScores: Record<number, number> = {
    14: 10,
    13: 8,
    12: 7,
    11: 6,
  };
  let score = baseScores[high] ?? high / 2;

  if (isPair) {
    score = Math.max(5, score * 2);
  } else {
    if (isSuited) score += 2;
    if (gap === 1) score += 1;
    else if (gap === 2) score -= 1;
    else if (gap === 3) score -= 2;
    else if (gap === 4) score -= 4;
    else if (gap >= 5) score -= 5;

    if (gap <= 2 && high < 12) score += 1;
  }

  // Max Chen score is 20 (AA), min around -1
  return Math.max(0.05, Math.min(1, (score + 1) / 21));
}
