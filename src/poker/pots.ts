import { evaluateBestHand } from './evaluator.ts';
import type { Card, EvaluatedHand, Player, PotPayout, SidePot } from './types.ts';

/**
 * Computes side pots from players' totalContributed across the hand.
 * Any dead money from folded players is folded into the appropriate pot tier.
 * Consecutive pots with identical eligiblePlayerIds are merged.
 */
export function calculateSidePots(players: Player[]): SidePot[] {
  const nonFoldedLevels = Array.from(
    new Set(
      players
        .filter((p) => p.status !== 'folded' && p.totalContributed > 0)
        .map((p) => p.totalContributed)
    )
  ).sort((a, b) => a - b);

  if (nonFoldedLevels.length === 0) {
    return [];
  }

  const rawPots: SidePot[] = [];
  let prevLevel = 0;

  for (const level of nonFoldedLevels) {
    let tierAmount = 0;
    for (const p of players) {
      if (p.totalContributed > prevLevel) {
        tierAmount += Math.min(p.totalContributed, level) - prevLevel;
      }
    }

    const eligiblePlayerIds = players
      .filter((p) => p.status !== 'folded' && p.totalContributed >= level)
      .map((p) => p.id);

    if (tierAmount > 0 && eligiblePlayerIds.length > 0) {
      const prevPot = rawPots[rawPots.length - 1];
      if (
        prevPot &&
        prevPot.eligiblePlayerIds.length === eligiblePlayerIds.length &&
        prevPot.eligiblePlayerIds.every((id, idx) => id === eligiblePlayerIds[idx])
      ) {
        prevPot.amount += tierAmount;
      } else {
        rawPots.push({
          amount: tierAmount,
          eligiblePlayerIds,
        });
      }
    }

    prevLevel = level;
  }

  // Handle any rare edge case where a folded player contributed more than the max non-folded level
  const maxNonFolded = nonFoldedLevels[nonFoldedLevels.length - 1];
  let extraDeadMoney = 0;
  for (const p of players) {
    if (p.status === 'folded' && p.totalContributed > maxNonFolded) {
      extraDeadMoney += p.totalContributed - maxNonFolded;
    }
  }
  if (extraDeadMoney > 0 && rawPots.length > 0) {
    rawPots[rawPots.length - 1].amount += extraDeadMoney;
  }

  return rawPots;
}

/**
 * Returns uncalled excess chips from the highest contributor during a street
 * when no other player matched that bet level.
 */
export function refundUncalledStreetBet(players: Player[]): {
  refundedPlayerId: string | null;
  refundAmount: number;
} {
  const bets = players.map((p) => p.betThisRound);
  const maxBet = Math.max(...bets);
  if (maxBet <= 0) {
    return { refundedPlayerId: null, refundAmount: 0 };
  }

  const playersAtMax = players.filter((p) => p.betThisRound === maxBet);
  if (playersAtMax.length > 1) {
    return { refundedPlayerId: null, refundAmount: 0 };
  }

  const soleMaxPlayer = playersAtMax[0];
  const secondHighest = Math.max(
    0,
    ...players.filter((p) => p.id !== soleMaxPlayer.id).map((p) => p.betThisRound)
  );

  const excess = maxBet - secondHighest;
  if (excess <= 0) {
    return { refundedPlayerId: null, refundAmount: 0 };
  }

  soleMaxPlayer.chips += excess;
  soleMaxPlayer.betThisRound -= excess;
  soleMaxPlayer.totalContributed -= excess;

  return {
    refundedPlayerId: soleMaxPlayer.id,
    refundAmount: excess,
  };
}

/**
 * Distributes all side pots to winners.
 * Odd chips go clockwise starting left of the dealer button (standard casino rule).
 */
export function resolveAndDistributePots(
  pots: SidePot[],
  players: Player[],
  communityCards: Card[],
  dealerIndex: number
): {
  payouts: PotPayout[];
  evaluatedByPlayerId: Map<string, EvaluatedHand>;
} {
  const evaluatedByPlayerId = new Map<string, EvaluatedHand>();
  const nonFolded = players.filter((p) => p.status !== 'folded' && p.status !== 'out');

  const isShowdown = nonFolded.length > 1 && communityCards.length === 5;
  if (isShowdown) {
    for (const p of nonFolded) {
      evaluatedByPlayerId.set(p.id, evaluateBestHand([...p.holeCards, ...communityCards]));
    }
  }

  // Order player IDs clockwise starting from left of dealer for odd-chip assignment
  const clockwiseIdsFromLeftOfDealer: string[] = [];
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (dealerIndex + offset) % n;
    clockwiseIdsFromLeftOfDealer.push(players[idx].id);
  }

  const payouts: PotPayout[] = [];

  pots.forEach((pot, potIndex) => {
    const eligible = pot.eligiblePlayerIds
      .map((id) => players.find((p) => p.id === id)!)
      .filter(Boolean);

    if (eligible.length === 0 || pot.amount <= 0) return;

    let winners: Player[] = [];
    let winningHand: EvaluatedHand | undefined;
    let winReasonZh = '';

    if (eligible.length === 1 || !isShowdown) {
      winners = [eligible[0]];
      winReasonZh = eligible.length === 1 && nonFolded.length === 1
        ? '其他玩家弃牌'
        : '无竞争底池';
    } else {
      let bestScore = -1;
      for (const p of eligible) {
        const hand = evaluatedByPlayerId.get(p.id)!;
        if (hand.score > bestScore) {
          bestScore = hand.score;
          winners = [p];
          winningHand = hand;
        } else if (hand.score === bestScore) {
          winners.push(p);
        }
      }
      winReasonZh = winningHand ? winningHand.descriptionZh : '摊牌胜出';
    }

    const baseShare = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    // Sort winners clockwise from left of dealer to award odd chips fairly
    const orderedWinners = [...winners].sort(
      (a, b) =>
        clockwiseIdsFromLeftOfDealer.indexOf(a.id) -
        clockwiseIdsFromLeftOfDealer.indexOf(b.id)
    );

    orderedWinners.forEach((w, idx) => {
      const extra = idx < remainder ? 1 : 0;
      w.chips += baseShare + extra;
    });

    payouts.push({
      potIndex,
      potAmount: pot.amount,
      winnerIds: orderedWinners.map((w) => w.id),
      amountPerWinner: baseShare,
      oddChips: remainder,
      winningHand,
      winReasonZh,
    });
  });

  return { payouts, evaluatedByPlayerId };
}
