import { createCard, rankToShort } from './evaluator.ts';
import type { Card, HandLogEntry, Rank, Suit } from './types.ts';

export interface SharedHandPayload {
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  potTotal: number;
  heroNet: number;
  winningSummary: string;
  heroHoleCards: Card[];
  communityCards: Card[];
  playerCount: number;
  sharedBy?: string;
}

const SUIT_BY_CHAR: Record<string, Suit> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function parseCardId(id: string): Card | null {
  if (!id || id.length !== 2) return null;
  const rankChar = id[0];
  const suitChar = id[1];
  const suit = SUIT_BY_CHAR[suitChar];
  if (!suit) return null;

  let rank: number;
  if (rankChar === 'A') rank = 14;
  else if (rankChar === 'K') rank = 13;
  else if (rankChar === 'Q') rank = 12;
  else if (rankChar === 'J') rank = 11;
  else if (rankChar === 'T') rank = 10;
  else rank = Number(rankChar);

  if (!Number.isInteger(rank) || rank < 2 || rank > 14) return null;
  return createCard(rank as Rank, suit);
}

export function cardToSymbolText(card: Card): string {
  return `${SUIT_SYMBOL[card.suit]}${rankToShort(card.rank)}`;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function handLogToSharedPayload(
  entry: HandLogEntry,
  sharedBy?: string
): SharedHandPayload {
  return {
    handNumber: entry.handNumber,
    smallBlind: entry.smallBlind,
    bigBlind: entry.bigBlind,
    potTotal: entry.potTotal,
    heroNet: entry.heroNet,
    winningSummary: entry.winningSummary,
    heroHoleCards: entry.heroHoleCards,
    communityCards: entry.communityCards,
    playerCount: entry.playerCount,
    sharedBy,
  };
}

export function encodeSharedHand(payload: SharedHandPayload): string {
  const compact = {
    h: payload.handNumber,
    sb: payload.smallBlind,
    bb: payload.bigBlind,
    p: payload.potTotal,
    n: payload.heroNet,
    w: payload.winningSummary,
    hc: payload.heroHoleCards.map((c) => c.id),
    cc: payload.communityCards.map((c) => c.id),
    pc: payload.playerCount,
    by: payload.sharedBy,
  };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeSharedHand(token: string): SharedHandPayload | null {
  try {
    const raw = JSON.parse(fromBase64Url(token));
    if (!raw || typeof raw !== 'object') return null;
    const heroHoleCards = Array.isArray(raw.hc)
      ? raw.hc.map((id: unknown) => (typeof id === 'string' ? parseCardId(id) : null)).filter(Boolean) as Card[]
      : [];
    const communityCards = Array.isArray(raw.cc)
      ? raw.cc.map((id: unknown) => (typeof id === 'string' ? parseCardId(id) : null)).filter(Boolean) as Card[]
      : [];

    if (typeof raw.h !== 'number' || typeof raw.p !== 'number') {
      return null;
    }

    return {
      handNumber: raw.h,
      smallBlind: typeof raw.sb === 'number' ? raw.sb : 10,
      bigBlind: typeof raw.bb === 'number' ? raw.bb : 20,
      potTotal: raw.p,
      heroNet: typeof raw.n === 'number' ? raw.n : 0,
      winningSummary: typeof raw.w === 'string' ? raw.w : '牌局分享',
      heroHoleCards,
      communityCards,
      playerCount: typeof raw.pc === 'number' ? raw.pc : 6,
      sharedBy: typeof raw.by === 'string' ? raw.by : undefined,
    };
  } catch {
    return null;
  }
}

export function formatHandSummaryText(payload: SharedHandPayload, shareUrl?: string): string {
  const hole =
    payload.heroHoleCards.length > 0
      ? payload.heroHoleCards.map(cardToSymbolText).join(' ')
      : '未亮牌';
  const board =
    payload.communityCards.length > 0
      ? payload.communityCards.map(cardToSymbolText).join(' ')
      : '翻牌前结束';
  const netStr =
    payload.heroNet > 0
      ? `+¥${payload.heroNet}`
      : payload.heroNet < 0
      ? `-¥${Math.abs(payload.heroNet)}`
      : '¥0';

  const lines = [
    `【皇家德州】第${payload.handNumber}手战报 (${payload.playerCount}人桌 · 盲注 ${payload.smallBlind}/${payload.bigBlind})`,
    `底牌：${hole} | 公共牌：${board}`,
    `底池：¥${payload.potTotal} | 盈亏：${netStr}`,
    `赛果：${payload.winningSummary}`,
  ];
  if (shareUrl) {
    lines.push(`查看手牌回放：${shareUrl}`);
  }
  return lines.join('\n');
}
