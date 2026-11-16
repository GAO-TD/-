export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string; // e.g. "As", "Td", "7c"
  suit: Suit;
  rank: Rank;
}

export const HandCategory = {
  HighCard: 0,
  OnePair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
  RoyalFlush: 9,
} as const;

export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export interface EvaluatedHand {
  category: HandCategory;
  categoryNameZh: string;
  categoryNameEn: string;
  /** Lexicographical integer score for exact comparison */
  score: number;
  /** Exact 5 cards forming the best hand */
  bestFive: Card[];
  /** Human-readable Chinese breakdown, e.g. "葫芦 · K带9" */
  descriptionZh: string;
}

export type AIPersonality = 'tight' | 'aggressive' | 'balanced' | 'loose' | 'calling_station';

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'out';

export interface Player {
  id: string;
  seatIndex: number;
  name: string;
  isHuman: boolean;
  isAI?: boolean;
  connected?: boolean;
  personality?: AIPersonality;
  personalityLabel?: string;
  chips: number;
  /** Chips placed into the pot during the current betting street */
  betThisRound: number;
  /** Total chips contributed across the entire current hand */
  totalContributed: number;
  holeCards: Card[];
  /** Used in sanitized multiplayer state to show card backs when holeCards are redacted */
  hasHoleCards?: boolean;
  status: PlayerStatus;
  lastAction?: string;
  lastActionType?: ActionType | 'sb' | 'bb' | 'win';
  /** Whether player has acted since the last full bet/raise on this street */
  hasActedSinceFullRaise: boolean;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface PlayerAction {
  type: ActionType;
  /** Target total betThisRound when raising (optional for allin/call/check/fold) */
  raiseTo?: number;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PotPayout {
  potIndex: number;
  potAmount: number;
  winnerIds: string[];
  amountPerWinner: number;
  oddChips: number;
  winningHand?: EvaluatedHand;
  winReasonZh: string;
}

export interface HandLogEntry {
  id: string;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  potTotal: number;
  winnerNames: string[];
  winningSummary: string;
  heroNet: number;
  heroHoleCards: Card[];
  communityCards: Card[];
  playerCount: number;
}

export interface GameConfig {
  playerCount: number; // 2 to 6
  startingChips: number; // e.g. 1000, 2000, 5000
  smallBlind: number;
  bigBlind: number;
  blindEscalation: boolean; // Increase blinds every 8 hands
  handsPerBlindLevel: number;
}

export interface GameTableState {
  config: GameConfig;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  sbIndex: number;
  bbIndex: number;
  street: Street;
  deck: Card[];
  communityCards: Card[];
  players: Player[];
  /** Side pots accumulated from completed betting rounds + current bets */
  pots: SidePot[];
  /** Total chips in completed pots (before current street bets) */
  collectedPotTotal: number;
  currentBet: number;
  lastFullRaiseSize: number;
  actingPlayerIndex: number | null;
  isAllInRunout: boolean;
  isHandComplete: boolean;
  isMatchOver: boolean;
  matchWinnerId: string | null;
  payouts: PotPayout[];
  actionMessage: string;
  history: HandLogEntry[];
}
