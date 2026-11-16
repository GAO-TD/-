import { createDeck, shuffleDeck } from './evaluator.ts';
import { calculateSidePots, refundUncalledStreetBet, resolveAndDistributePots } from './pots.ts';
import type {
  AIPersonality,
  GameConfig,
  GameTableState,
  LegalActions,
  Player,
  PlayerAction,
  Street,
} from './types.ts';

interface AIProfile {
  name: string;
  personality: AIPersonality;
  personalityLabel: string;
}

const AI_ROSTER: AIProfile[] = [
  { name: '林墨', personality: 'tight', personalityLabel: '稳健紧凶' },
  { name: '苏菲', personality: 'aggressive', personalityLabel: '激进施压' },
  { name: '陈远', personality: 'balanced', personalityLabel: '平衡策略' },
  { name: '陆川', personality: 'loose', personalityLabel: '松凶变化' },
  { name: '白露', personality: 'calling_station', personalityLabel: '跟注防守' },
];

export function createDefaultConfig(overrides?: Partial<GameConfig>): GameConfig {
  const startingChips = overrides?.startingChips ?? 2000;
  const smallBlind = overrides?.smallBlind ?? Math.max(5, Math.round(startingChips / 200 / 5) * 5);
  const bigBlind = overrides?.bigBlind ?? smallBlind * 2;
  return {
    playerCount: overrides?.playerCount ?? 6,
    startingChips,
    smallBlind,
    bigBlind,
    blindEscalation: overrides?.blindEscalation ?? true,
    handsPerBlindLevel: overrides?.handsPerBlindLevel ?? 8,
  };
}

function cloneState(state: GameTableState): GameTableState {
  return {
    ...state,
    config: { ...state.config },
    deck: state.deck.map((c) => ({ ...c })),
    communityCards: state.communityCards.map((c) => ({ ...c })),
    players: state.players.map((p) => ({
      ...p,
      holeCards: p.holeCards.map((c) => ({ ...c })),
    })),
    pots: state.pots.map((pot) => ({
      ...pot,
      eligiblePlayerIds: [...pot.eligiblePlayerIds],
    })),
    payouts: state.payouts.map((p) => ({
      ...p,
      winnerIds: [...p.winnerIds],
    })),
    history: [...state.history],
  };
}

function findNextIndex(
  players: Player[],
  fromIndex: number,
  predicate: (p: Player) => boolean
): number | null {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (predicate(players[idx])) {
      return idx;
    }
  }
  return null;
}

function postBlind(player: Player, amount: number, label: '小盲' | '大盲', type: 'sb' | 'bb'): number {
  const posted = Math.min(player.chips, amount);
  player.chips -= posted;
  player.betThisRound += posted;
  player.totalContributed += posted;
  player.lastAction = `${label} ${posted}`;
  player.lastActionType = type;
  if (player.chips === 0) {
    player.status = 'allin';
    player.lastAction = `${label}全下 ${posted}`;
  }
  return posted;
}

export interface SeatSpec {
  id: string;
  name: string;
  isHuman: boolean;
  isAI?: boolean;
  personality?: AIPersonality;
  personalityLabel?: string;
}

export function createCustomTable(
  roster: SeatSpec[],
  configInput?: Partial<GameConfig>,
  rng: () => number = Math.random
): GameTableState {
  const count = Math.max(2, Math.min(6, roster.length));
  const config = createDefaultConfig({ ...configInput, playerCount: count });

  const players: Player[] = roster.slice(0, 6).map((seat, idx) => ({
    id: seat.id,
    seatIndex: idx,
    name: seat.name,
    isHuman: seat.isHuman,
    isAI: seat.isAI ?? !seat.isHuman,
    connected: true,
    personality: seat.personality,
    personalityLabel: seat.personalityLabel,
    chips: config.startingChips,
    betThisRound: 0,
    totalContributed: 0,
    holeCards: [],
    status: 'active',
    hasActedSinceFullRaise: false,
  }));

  const initialState: GameTableState = {
    config: { ...config, playerCount: players.length },
    handNumber: 0,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    dealerIndex: players.length - 1,
    sbIndex: 0,
    bbIndex: 1,
    street: 'preflop',
    deck: [],
    communityCards: [],
    players,
    pots: [],
    collectedPotTotal: 0,
    currentBet: 0,
    lastFullRaiseSize: config.bigBlind,
    actingPlayerIndex: null,
    isAllInRunout: false,
    isHandComplete: false,
    isMatchOver: false,
    matchWinnerId: null,
    payouts: [],
    actionMessage: '准备开局',
    history: [],
  };

  return startNewHand(initialState, rng);
}

export function createInitialTable(
  configInput?: Partial<GameConfig>,
  rng: () => number = Math.random
): GameTableState {
  const config = createDefaultConfig(configInput);
  const count = Math.max(2, Math.min(6, config.playerCount));

  const roster: SeatSpec[] = [
    {
      id: 'hero',
      name: '你',
      isHuman: true,
      isAI: false,
    },
  ];

  for (let i = 1; i < count; i++) {
    const profile = AI_ROSTER[(i - 1) % AI_ROSTER.length];
    roster.push({
      id: `ai-${i}`,
      name: profile.name,
      isHuman: false,
      isAI: true,
      personality: profile.personality,
      personalityLabel: profile.personalityLabel,
    });
  }

  return createCustomTable(roster, config, rng);
}

export function startNewHand(
  prevState: GameTableState,
  rng: () => number = Math.random
): GameTableState {
  const state = cloneState(prevState);

  // Mark busted players as out
  for (const p of state.players) {
    if (p.chips <= 0) {
      p.status = 'out';
      p.chips = 0;
    } else {
      p.status = 'active';
    }
    p.betThisRound = 0;
    p.totalContributed = 0;
    p.holeCards = [];
    p.lastAction = undefined;
    p.lastActionType = undefined;
    p.hasActedSinceFullRaise = false;
  }

  const alivePlayers = state.players.filter((p) => p.status !== 'out');
  if (alivePlayers.length <= 1) {
    state.isMatchOver = true;
    state.isHandComplete = true;
    state.actingPlayerIndex = null;
    state.matchWinnerId = alivePlayers[0]?.id ?? null;
    state.actionMessage = alivePlayers[0]?.isHuman
      ? '恭喜！你赢得了牌桌全部筹码'
      : `${alivePlayers[0]?.name ?? '对手'} 赢得了牌桌冠军`;
    return state;
  }

  state.handNumber += 1;

  // Blind escalation for tournament feel if enabled
  if (
    state.config.blindEscalation &&
    state.handNumber > 1 &&
    (state.handNumber - 1) % state.config.handsPerBlindLevel === 0
  ) {
    state.smallBlind = state.smallBlind * 2;
    state.bigBlind = state.bigBlind * 2;
  }

  // Rotate dealer clockwise to next alive player
  const nextDealer = findNextIndex(state.players, state.dealerIndex, (p) => p.status !== 'out');
  state.dealerIndex = nextDealer ?? 0;

  // Determine SB and BB (Heads-up: Dealer IS SB)
  if (alivePlayers.length === 2) {
    state.sbIndex = state.dealerIndex;
    state.bbIndex = findNextIndex(state.players, state.dealerIndex, (p) => p.status !== 'out')!;
  } else {
    state.sbIndex = findNextIndex(state.players, state.dealerIndex, (p) => p.status !== 'out')!;
    state.bbIndex = findNextIndex(state.players, state.sbIndex, (p) => p.status !== 'out')!;
  }

  // Shuffle and deal 2 hole cards to each alive player
  state.deck = shuffleDeck(createDeck(), rng);
  state.communityCards = [];
  state.street = 'preflop';
  state.pots = [];
  state.collectedPotTotal = 0;
  state.payouts = [];
  state.isAllInRunout = false;
  state.isHandComplete = false;

  // Post blinds
  postBlind(state.players[state.sbIndex], state.smallBlind, '小盲', 'sb');
  postBlind(state.players[state.bbIndex], state.bigBlind, '大盲', 'bb');

  // Even if BB is short-stacked, the preflop bet level to match is BB (or max possible)
  state.currentBet = state.bigBlind;
  state.lastFullRaiseSize = state.bigBlind;

  // Deal 2 cards clockwise starting left of dealer
  for (let round = 0; round < 2; round++) {
    let cursor = state.dealerIndex;
    for (let i = 0; i < state.players.length; i++) {
      cursor = (cursor + 1) % state.players.length;
      const p = state.players[cursor];
      if (p.status !== 'out') {
        p.holeCards.push(state.deck.pop()!);
      }
    }
  }

  state.pots = calculateSidePots(state.players);

  // Determine first player to act preflop:
  // Heads-up: SB (Dealer) acts first; 3+ players: UTG (left of BB) acts first.
  const startFrom = alivePlayers.length === 2 ? state.dealerIndex - 1 + state.players.length : state.bbIndex;
  const firstActor = findNextIndex(
    state.players,
    startFrom % state.players.length,
    (p) => p.status === 'active'
  );

  // Check if everyone is already all-in from blinds (rare short-stack scenario)
  const activeCount = state.players.filter((p) => p.status === 'active').length;
  if (activeCount <= 1) {
    // Check if that 1 active player still faces an unmatched bet > their betThisRound
    const soleActive = state.players.find((p) => p.status === 'active');
    const maxOtherAllIn = Math.max(
      0,
      ...state.players.filter((p) => p.status === 'allin').map((p) => p.betThisRound)
    );
    if (soleActive && soleActive.betThisRound < maxOtherAllIn) {
      state.actingPlayerIndex = soleActive.seatIndex;
      state.actionMessage = `第 ${state.handNumber} 手 · 轮到 ${soleActive.name}`;
    } else {
      state.actingPlayerIndex = null;
      state.isAllInRunout = true;
      state.actionMessage = `第 ${state.handNumber} 手 · 全下摊牌`;
    }
  } else {
    state.actingPlayerIndex = firstActor;
    const actor = firstActor !== null ? state.players[firstActor] : null;
    state.actionMessage = actor
      ? `第 ${state.handNumber} 手 · 轮到${actor.isHuman ? '你' : actor.name}行动`
      : `第 ${state.handNumber} 手`;
  }

  return state;
}

export function getLegalActions(state: GameTableState, playerIndex: number): LegalActions {
  const player = state.players[playerIndex];
  if (
    !player ||
    state.isHandComplete ||
    state.actingPlayerIndex !== playerIndex ||
    player.status !== 'active'
  ) {
    return {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaiseTo: 0,
      maxRaiseTo: 0,
    };
  }

  const maxTotalBet = player.betThisRound + player.chips;
  const toCall = Math.max(0, state.currentBet - player.betThisRound);
  const callAmount = Math.min(player.chips, toCall);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && player.chips > 0;

  // Can raise only if:
  // 1) Player has chips strictly above callAmount
  // 2) Player has NOT already acted since the last full bet/raise (handles incomplete all-in raise rule)
  const canReopen = !player.hasActedSinceFullRaise;
  const minRaiseTarget = state.currentBet + state.lastFullRaiseSize;
  const canRaise = canReopen && maxTotalBet > state.currentBet && player.chips > callAmount;

  return {
    canFold: toCall > 0 || !canCheck,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTo: Math.min(maxTotalBet, minRaiseTarget),
    maxRaiseTo: maxTotalBet,
  };
}

function isBettingRoundComplete(state: GameTableState): boolean {
  const nonFolded = state.players.filter((p) => p.status === 'active' || p.status === 'allin');
  if (nonFolded.length <= 1) return true;

  const activePlayers = state.players.filter((p) => p.status === 'active');
  if (activePlayers.length === 0) return true;

  // Every active player must have acted at least once AND matched currentBet (or be unable to?)
  // Note: active players always have chips > 0, so if their betThisRound < currentBet they MUST still act.
  for (const p of activePlayers) {
    if (!p.hasActedSinceFullRaise) return false;
    if (p.betThisRound < state.currentBet) return false;
  }

  return true;
}

function finalizeHand(state: GameTableState): GameTableState {
  refundUncalledStreetBet(state.players);
  state.pots = calculateSidePots(state.players);

  const nonFolded = state.players.filter((p) => p.status !== 'folded' && p.status !== 'out');
  if (nonFolded.length > 1) {
    state.street = 'showdown';
  }

  const heroBefore = state.players.find((p) => p.isHuman);
  const heroContributed = heroBefore?.totalContributed ?? 0;
  const heroChipsBeforePayout = heroBefore?.chips ?? 0;

  const { payouts } = resolveAndDistributePots(
    state.pots,
    state.players,
    state.communityCards,
    state.dealerIndex
  );

  state.payouts = payouts;
  state.isHandComplete = true;
  state.isAllInRunout = false;
  state.actingPlayerIndex = null;

  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const mainPayout = payouts[0];
  const winnerNames = mainPayout
    ? mainPayout.winnerIds.map((id) => state.players.find((p) => p.id === id)?.name ?? id)
    : [];

  // Mark winners' lastAction
  const winnerTotalWon = new Map<string, number>();
  for (const payout of payouts) {
    payout.winnerIds.forEach((id, idx) => {
      const share = payout.amountPerWinner + (idx < payout.oddChips ? 1 : 0);
      winnerTotalWon.set(id, (winnerTotalWon.get(id) ?? 0) + share);
    });
  }
  for (const [winnerId, wonAmount] of winnerTotalWon.entries()) {
    const wp = state.players.find((p) => p.id === winnerId);
    if (wp) {
      wp.lastAction = `赢得 ${wonAmount}`;
      wp.lastActionType = 'win';
    }
  }

  const heroAfter = state.players.find((p) => p.isHuman);
  const heroWon = (heroAfter?.chips ?? 0) - heroChipsBeforePayout;
  const heroNet = heroWon - heroContributed;

  const winningSummary = mainPayout
    ? `${winnerNames.join(' & ')} · ${mainPayout.winReasonZh}`
    : '牌局结束';

  state.actionMessage = winningSummary;

  state.history = [
    {
      id: `hand-${state.handNumber}`,
      handNumber: state.handNumber,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      potTotal: totalPot,
      winnerNames,
      winningSummary,
      heroNet,
      heroHoleCards: (heroAfter?.holeCards ?? []).map((c) => ({ ...c })),
      communityCards: state.communityCards.map((c) => ({ ...c })),
      playerCount: state.players.filter((p) => p.status !== 'out').length,
    },
    ...state.history.slice(0, 29),
  ];

  // Check if match is over after chips settled
  const playersWithChips = state.players.filter((p) => p.chips > 0);
  const humanCount = state.players.filter((p) => p.isHuman).length;
  if (playersWithChips.length <= 1) {
    state.isMatchOver = true;
    state.matchWinnerId = playersWithChips[0]?.id ?? null;
  } else if (humanCount === 1 && heroAfter && heroAfter.chips <= 0) {
    // Sole human player busted out in solo mode -> match over
    state.isMatchOver = true;
    state.matchWinnerId = null;
  }

  return state;
}

function dealNextStreet(state: GameTableState): GameTableState {
  refundUncalledStreetBet(state.players);
  state.pots = calculateSidePots(state.players);

  // Reset per-street tracking
  for (const p of state.players) {
    p.betThisRound = 0;
    p.hasActedSinceFullRaise = false;
    if (p.status === 'active') {
      p.lastAction = undefined;
      p.lastActionType = undefined;
    }
  }
  state.currentBet = 0;
  state.lastFullRaiseSize = state.bigBlind;

  // Burn 1 card before dealing street (authentic casino rule)
  if (state.deck.length > 0) {
    state.deck.pop();
  }

  const nextStreetMap: Record<Street, Street> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    river: 'showdown',
    showdown: 'showdown',
  };

  const nextStreet = nextStreetMap[state.street];
  state.street = nextStreet;

  if (nextStreet === 'flop') {
    state.communityCards.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
  } else if (nextStreet === 'turn' || nextStreet === 'river') {
    state.communityCards.push(state.deck.pop()!);
  } else if (nextStreet === 'showdown') {
    return finalizeHand(state);
  }

  // Check if betting is possible on this new street
  const activePlayers = state.players.filter((p) => p.status === 'active');
  if (activePlayers.length <= 1) {
    state.isAllInRunout = true;
    state.actingPlayerIndex = null;
    const streetNames: Record<Street, string> = {
      preflop: '翻牌前',
      flop: '翻牌圈',
      turn: '转牌圈',
      river: '河牌圈',
      showdown: '摊牌',
    };
    state.actionMessage = `${streetNames[nextStreet]} · 全下自动发牌`;
    return state;
  }

  // First to act postflop is first active player clockwise from dealer
  const firstActor = findNextIndex(
    state.players,
    state.dealerIndex,
    (p) => p.status === 'active'
  );
  state.actingPlayerIndex = firstActor;
  const actor = firstActor !== null ? state.players[firstActor] : null;
  const streetLabels: Record<Street, string> = {
    preflop: '翻牌前',
    flop: '翻牌圈',
    turn: '转牌圈',
    river: '河牌圈',
    showdown: '摊牌',
  };
  state.actionMessage = actor
    ? `${streetLabels[nextStreet]} · 轮到${actor.isHuman ? '你' : actor.name}`
    : streetLabels[nextStreet];

  return state;
}

/**
 * Advances one community street during an all-in runout until showdown.
 */
export function advanceRunoutStreet(prevState: GameTableState): GameTableState {
  const state = cloneState(prevState);
  if (!state.isAllInRunout || state.isHandComplete) {
    return state;
  }
  return dealNextStreet(state);
}

/**
 * Applies a player action and returns the next immutable GameTableState.
 */
export function applyAction(
  prevState: GameTableState,
  playerIndex: number,
  action: PlayerAction
): GameTableState {
  const state = cloneState(prevState);
  const legal = getLegalActions(state, playerIndex);
  const player = state.players[playerIndex];

  if (!player || state.actingPlayerIndex !== playerIndex || state.isHandComplete) {
    return state;
  }

  let effectiveType = action.type;
  if (effectiveType === 'check' && !legal.canCheck) {
    effectiveType = 'fold';
  }
  if (effectiveType === 'call' && !legal.canCall) {
    effectiveType = legal.canCheck ? 'check' : 'fold';
  }
  if (effectiveType === 'raise' && !legal.canRaise) {
    effectiveType = legal.canCall ? 'call' : 'check';
  }

  if (effectiveType === 'fold') {
    player.status = 'folded';
    player.hasActedSinceFullRaise = true;
    player.lastAction = '弃牌';
    player.lastActionType = 'fold';
  } else if (effectiveType === 'check') {
    player.hasActedSinceFullRaise = true;
    player.lastAction = '过牌';
    player.lastActionType = 'check';
  } else if (effectiveType === 'call') {
    const paid = Math.min(player.chips, legal.callAmount);
    player.chips -= paid;
    player.betThisRound += paid;
    player.totalContributed += paid;
    player.hasActedSinceFullRaise = true;
    if (player.chips === 0) {
      player.status = 'allin';
      player.lastAction = `全下跟注 ${player.betThisRound}`;
    } else {
      player.lastAction = `跟注 ${paid}`;
    }
    player.lastActionType = 'call';
  } else if (effectiveType === 'raise' || effectiveType === 'allin') {
    const maxTotalBet = player.betThisRound + player.chips;
    let targetBet =
      effectiveType === 'allin'
        ? maxTotalBet
        : Math.round(action.raiseTo ?? legal.minRaiseTo);

    if (effectiveType === 'raise') {
      targetBet = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, targetBet));
    }

    // Check if an allin is actually just a call or a raise
    if (targetBet <= state.currentBet) {
      const paid = Math.min(player.chips, Math.max(0, targetBet - player.betThisRound));
      player.chips -= paid;
      player.betThisRound += paid;
      player.totalContributed += paid;
      player.hasActedSinceFullRaise = true;
      if (player.chips === 0) {
        player.status = 'allin';
        player.lastAction = `全下 ${player.betThisRound}`;
        player.lastActionType = 'allin';
      } else {
        player.lastAction = `跟注 ${paid}`;
        player.lastActionType = 'call';
      }
    } else {
      const added = targetBet - player.betThisRound;
      const raiseIncrement = targetBet - state.currentBet;
      const isFullRaise = raiseIncrement >= state.lastFullRaiseSize;

      player.chips -= added;
      player.betThisRound = targetBet;
      player.totalContributed += added;

      const wasFirstBet = state.currentBet === 0;
      state.currentBet = targetBet;

      if (isFullRaise) {
        state.lastFullRaiseSize = raiseIncrement;
        for (const other of state.players) {
          other.hasActedSinceFullRaise = other.id === player.id;
        }
      } else {
        // Incomplete all-in raise: does NOT reopen raising for players who already acted
        player.hasActedSinceFullRaise = true;
      }

      if (player.chips === 0) {
        player.status = 'allin';
        player.lastAction = `全下 ${targetBet}`;
        player.lastActionType = 'allin';
      } else {
        player.lastAction = wasFirstBet ? `下注 ${targetBet}` : `加注到 ${targetBet}`;
        player.lastActionType = 'raise';
      }
    }
  }

  state.pots = calculateSidePots(state.players);

  // Check if only 1 non-folded player remains -> immediate win without showdown
  const nonFolded = state.players.filter((p) => p.status !== 'folded' && p.status !== 'out');
  if (nonFolded.length === 1) {
    return finalizeHand(state);
  }

  // Check if current street betting is complete
  if (isBettingRoundComplete(state)) {
    return dealNextStreet(state);
  }

  // Advance to next active player clockwise
  const nextActor = findNextIndex(
    state.players,
    playerIndex,
    (p) => p.status === 'active'
  );
  state.actingPlayerIndex = nextActor;

  const actor = nextActor !== null ? state.players[nextActor] : null;
  state.actionMessage = actor
    ? `轮到${actor.isHuman ? '你' : actor.name}行动`
    : state.actionMessage;

  return state;
}

export function getTotalPotAmount(state: GameTableState): number {
  return state.players.reduce((sum, p) => sum + p.totalContributed, 0);
}
