import { chooseAIAction } from '../poker/ai.ts';
import {
  advanceRunoutStreet,
  applyAction,
  createCustomTable,
  createDefaultConfig,
  startNewHand,
} from '../poker/engine.ts';
import type { SeatSpec } from '../poker/engine.ts';
import type {
  AIPersonality,
  GameConfig,
  GameTableState,
  PlayerAction,
} from '../poker/types.ts';

export interface RoomSeatMember {
  id: string;
  name: string;
  isAI: boolean;
  connected: boolean;
  personality?: AIPersonality;
  personalityLabel?: string;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomPublicSnapshot {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  config: GameConfig;
  members: RoomSeatMember[];
  table: GameTableState | null;
  turnDeadline: number | null;
  chat: RoomChatMessage[];
}

interface InternalRoom {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  config: GameConfig;
  members: RoomSeatMember[];
  table: GameTableState | null;
  turnDeadline: number | null;
  chat: RoomChatMessage[];
  aiTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  runoutTimer: ReturnType<typeof setTimeout> | null;
}

const BOT_PROFILES: Array<{
  name: string;
  personality: AIPersonality;
  personalityLabel: string;
}> = [
  { name: 'AI · 林墨', personality: 'tight', personalityLabel: '稳健紧凶' },
  { name: 'AI · 苏菲', personality: 'aggressive', personalityLabel: '激进施压' },
  { name: 'AI · 陈远', personality: 'balanced', personalityLabel: '平衡策略' },
  { name: 'AI · 陆川', personality: 'loose', personalityLabel: '松凶变化' },
  { name: 'AI · 白露', personality: 'calling_station', personalityLabel: '跟注防守' },
];

const TURN_TIMEOUT_MS = 30_000;
const AI_DELAY_MS = 600;
const RUNOUT_DELAY_MS = 850;

export function sanitizeTableForPlayer(
  table: GameTableState,
  viewerId: string
): GameTableState {
  const nonFoldedCount = table.players.filter(
    (p) => p.status !== 'folded' && p.status !== 'out'
  ).length;
  const revealAll =
    (table.isHandComplete && nonFoldedCount > 1) ||
    (table.isAllInRunout && nonFoldedCount > 1);

  return {
    ...table,
    deck: [], // Never expose deck to clients
    players: table.players.map((p) => {
      const canSee =
        p.id === viewerId ||
        (revealAll && p.status !== 'folded' && p.status !== 'out');
      return {
        ...p,
        hasHoleCards: p.holeCards.length > 0,
        holeCards: canSee ? p.holeCards.map((c) => ({ ...c })) : [],
      };
    }),
  };
}

export type RoomBroadcastFn = (roomCode: string) => void;

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();
  private onBroadcast: RoomBroadcastFn;

  constructor(onBroadcast: RoomBroadcastFn = () => {}) {
    this.onBroadcast = onBroadcast;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `R${Date.now().toString(36).slice(-5).toUpperCase()}`;
  }

  private clearTimers(room: InternalRoom): void {
    if (room.aiTimer) {
      clearTimeout(room.aiTimer);
      room.aiTimer = null;
    }
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    if (room.runoutTimer) {
      clearTimeout(room.runoutTimer);
      room.runoutTimer = null;
    }
  }

  createRoom(params: {
    hostId: string;
    hostName: string;
    config?: Partial<GameConfig>;
  }): RoomPublicSnapshot {
    const code = this.generateCode();
    const config = createDefaultConfig({
      playerCount: params.config?.playerCount ?? 6,
      startingChips: params.config?.startingChips ?? 2000,
      smallBlind: params.config?.smallBlind,
      bigBlind: params.config?.bigBlind,
      blindEscalation: params.config?.blindEscalation ?? true,
    });

    const host: RoomSeatMember = {
      id: params.hostId,
      name: params.hostName.trim().slice(0, 14) || '房主',
      isAI: false,
      connected: true,
    };

    const room: InternalRoom = {
      code,
      hostId: host.id,
      status: 'lobby',
      config,
      members: [host],
      table: null,
      turnDeadline: null,
      chat: [],
      aiTimer: null,
      turnTimer: null,
      runoutTimer: null,
    };

    this.rooms.set(code, room);
    return this.getSnapshotForPlayer(code, host.id)!;
  }

  getRoomInfo(code: string): {
    code: string;
    status: 'lobby' | 'playing';
    memberCount: number;
    maxPlayers: number;
    config: GameConfig;
  } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    return {
      code: room.code,
      status: room.status,
      memberCount: room.members.length,
      maxPlayers: room.config.playerCount,
      config: room.config,
    };
  }

  joinRoom(params: {
    code: string;
    playerId: string;
    playerName: string;
  }): { ok: true; snapshot: RoomPublicSnapshot } | { ok: false; error: string } {
    const room = this.rooms.get(params.code.trim().toUpperCase());
    if (!room) {
      return { ok: false, error: '房间不存在或已关闭' };
    }

    const cleanName = params.playerName.trim().slice(0, 14) || '玩家';

    // Reconnecting existing member
    const existing = room.members.find((m) => m.id === params.playerId);
    if (existing) {
      existing.connected = true;
      if (cleanName) existing.name = cleanName;
      if (room.table) {
        const tp = room.table.players.find((p) => p.id === existing.id);
        if (tp) {
          tp.connected = true;
          tp.name = existing.name;
        }
      }
      this.onBroadcast(room.code);
      return { ok: true, snapshot: this.getSnapshotForPlayer(room.code, existing.id)! };
    }

    if (room.status === 'playing') {
      return { ok: false, error: '牌局已开始，暂不支持中途加入' };
    }

    if (room.members.length >= room.config.playerCount) {
      return { ok: false, error: '房间已满员' };
    }

    room.members.push({
      id: params.playerId,
      name: cleanName,
      isAI: false,
      connected: true,
    });

    this.onBroadcast(room.code);
    return { ok: true, snapshot: this.getSnapshotForPlayer(room.code, params.playerId)! };
  }

  setPlayerDisconnected(code: string, playerId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    const member = room.members.find((m) => m.id === playerId);
    if (!member) return;
    member.connected = false;
    if (room.table) {
      const tp = room.table.players.find((p) => p.id === playerId);
      if (tp) tp.connected = false;
    }
    this.onBroadcast(room.code);
  }

  leaveRoom(code: string, playerId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;

    if (room.status === 'lobby') {
      room.members = room.members.filter((m) => m.id !== playerId);
      const humanRemaining = room.members.filter((m) => !m.isAI);
      if (humanRemaining.length === 0) {
        this.clearTimers(room);
        this.rooms.delete(room.code);
        return;
      }
      if (room.hostId === playerId) {
        room.hostId = humanRemaining[0].id;
      }
      this.onBroadcast(room.code);
      return;
    }

    // If playing, mark disconnected (and fold if currently acting)
    const member = room.members.find((m) => m.id === playerId);
    if (member) member.connected = false;
    if (room.table) {
      const idx = room.table.players.findIndex((p) => p.id === playerId);
      if (idx !== -1) {
        room.table.players[idx].connected = false;
        if (room.table.actingPlayerIndex === idx && !room.table.isHandComplete) {
          this.handleAction(room.code, playerId, { type: 'fold' });
          return;
        }
      }
    }
    const anyConnectedHuman = room.members.some((m) => !m.isAI && m.connected);
    if (!anyConnectedHuman) {
      this.clearTimers(room);
    } else {
      this.onBroadcast(room.code);
    }
  }

  addAI(code: string, requesterId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, error: '房间不存在' };
    if (room.hostId !== requesterId) return { ok: false, error: '只有房主可以添加AI' };
    if (room.status !== 'lobby') return { ok: false, error: '牌局已开始' };
    if (room.members.length >= room.config.playerCount) {
      return { ok: false, error: '房间座位已满' };
    }

    const aiCount = room.members.filter((m) => m.isAI).length;
    const profile = BOT_PROFILES[aiCount % BOT_PROFILES.length];
    room.members.push({
      id: `ai-${Date.now()}-${aiCount + 1}`,
      name: profile.name,
      isAI: true,
      connected: true,
      personality: profile.personality,
      personalityLabel: profile.personalityLabel,
    });
    this.onBroadcast(room.code);
    return { ok: true };
  }

  removeAI(code: string, requesterId: string, aiId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, error: '房间不存在' };
    if (room.hostId !== requesterId) return { ok: false, error: '只有房主可以移除AI' };
    if (room.status !== 'lobby') return { ok: false, error: '牌局已开始' };
    room.members = room.members.filter((m) => !(m.id === aiId && m.isAI));
    this.onBroadcast(room.code);
    return { ok: true };
  }

  startGame(code: string, requesterId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, error: '房间不存在' };
    if (room.hostId !== requesterId) return { ok: false, error: '只有房主可以开始牌局' };
    if (room.members.length < 2) return { ok: false, error: '至少需要 2 名玩家才能开局' };

    this.clearTimers(room);
    const roster: SeatSpec[] = room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isHuman: !m.isAI,
      isAI: m.isAI,
      personality: m.personality,
      personalityLabel: m.personalityLabel,
    }));

    room.status = 'playing';
    room.table = createCustomTable(roster, {
      ...room.config,
      playerCount: roster.length,
    });
    this.scheduleNextServerStep(room);
    this.onBroadcast(room.code);
    return { ok: true };
  }

  handleAction(
    code: string,
    playerId: string,
    action: PlayerAction
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.table) return { ok: false, error: '牌局未在进行中' };
    if (room.table.isHandComplete || room.table.isAllInRunout) {
      return { ok: false, error: '当前不可行动' };
    }

    const idx = room.table.actingPlayerIndex;
    if (idx === null) return { ok: false, error: '无行动玩家' };
    const actingPlayer = room.table.players[idx];
    if (!actingPlayer || actingPlayer.id !== playerId) {
      return { ok: false, error: '还未轮到你行动' };
    }

    this.clearTimers(room);
    room.table = applyAction(room.table, idx, action);
    this.scheduleNextServerStep(room);
    this.onBroadcast(room.code);
    return { ok: true };
  }

  nextHand(code: string, requesterId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.table) return { ok: false, error: '牌局不存在' };
    if (!room.table.isHandComplete) return { ok: false, error: '当前手牌尚未结束' };
    if (room.table.isMatchOver) {
      // Host can restart match
      if (room.hostId !== requesterId) {
        return { ok: false, error: '请等待房主开启新的一局' };
      }
      return this.startGame(code, requesterId);
    }

    this.clearTimers(room);
    room.table = startNewHand(room.table);
    this.scheduleNextServerStep(room);
    this.onBroadcast(room.code);
    return { ok: true };
  }

  addChatMessage(code: string, senderId: string, text: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    const member = room.members.find((m) => m.id === senderId);
    if (!member) return;
    const clean = text.trim().slice(0, 80);
    if (!clean) return;
    room.chat = [
      ...room.chat.slice(-24),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: member.id,
        senderName: member.name,
        text: clean,
        timestamp: Date.now(),
      },
    ];
    this.onBroadcast(room.code);
  }

  private scheduleNextServerStep(room: InternalRoom): void {
    const table = room.table;
    if (!table || table.isHandComplete) {
      room.turnDeadline = null;
      return;
    }

    if (table.isAllInRunout) {
      room.turnDeadline = null;
      room.runoutTimer = setTimeout(() => {
        if (!room.table || !room.table.isAllInRunout || room.table.isHandComplete) return;
        room.table = advanceRunoutStreet(room.table);
        this.scheduleNextServerStep(room);
        this.onBroadcast(room.code);
      }, RUNOUT_DELAY_MS);
      return;
    }

    const idx = table.actingPlayerIndex;
    if (idx === null) {
      room.turnDeadline = null;
      return;
    }

    const actor = table.players[idx];
    if (!actor) return;

    if (actor.isAI) {
      room.turnDeadline = null;
      room.aiTimer = setTimeout(() => {
        if (!room.table || room.table.isHandComplete || room.table.actingPlayerIndex !== idx) return;
        const move = chooseAIAction(room.table, idx);
        room.table = applyAction(room.table, idx, move);
        this.scheduleNextServerStep(room);
        this.onBroadcast(room.code);
      }, AI_DELAY_MS);
      return;
    }

    // Human turn timeout (30s) -> auto check or fold so room never stalls
    room.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
    room.turnTimer = setTimeout(() => {
      if (!room.table || room.table.isHandComplete || room.table.actingPlayerIndex !== idx) return;
      const fallback: PlayerAction =
        actor.betThisRound >= room.table.currentBet ? { type: 'check' } : { type: 'fold' };
      room.table = applyAction(room.table, idx, fallback);
      this.scheduleNextServerStep(room);
      this.onBroadcast(room.code);
    }, TURN_TIMEOUT_MS);
  }

  getMemberIds(code: string): string[] {
    const room = this.rooms.get(code.toUpperCase());
    return room ? room.members.filter((m) => !m.isAI).map((m) => m.id) : [];
  }

  getSnapshotForPlayer(code: string, viewerId: string): RoomPublicSnapshot | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      config: room.config,
      members: room.members.map((m) => ({ ...m })),
      table: room.table ? sanitizeTableForPlayer(room.table, viewerId) : null,
      turnDeadline: room.turnDeadline,
      chat: room.chat,
    };
  }
}
