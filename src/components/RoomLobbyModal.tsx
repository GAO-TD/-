import React, { useState } from 'react';
import { Bot, Check, Copy, LogOut, Trash2, Users } from 'lucide-react';
import type { RoomPublicSnapshot } from '../server/rooms.ts';

interface RoomLobbyModalProps {
  snapshot: RoomPublicSnapshot;
  playerId: string;
  wsConnected: boolean;
  onAddAI: () => void;
  onRemoveAI: (aiId: string) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  snapshot,
  playerId,
  wsConnected,
  onAddAI,
  onRemoveAI,
  onStartGame,
  onLeave,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isHost = snapshot.hostId === playerId;
  const canStart = snapshot.members.length >= 2;
  const isFull = snapshot.members.length >= snapshot.config.playerCount;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${snapshot.code}`
      : `?room=${snapshot.code}`;

  const copyValue = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (which === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  return (
    <div
      data-testid="room-lobby"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background:
          'radial-gradient(circle at 50% 40%, rgba(7, 16, 13, 0.94) 0%, rgba(6, 13, 10, 0.9) 100%)',
      }}
    >
      <div className="my-auto w-full max-w-md rounded-2xl border border-[#C9A24D]/35 bg-[#0C1914] p-5 sm:p-6 text-[#F5F2EB] shadow-2xl">
        {/* Room Code Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#C9A24D]/20 pb-4">
          <div>
            <div className="text-xs text-stone-400">联机牌桌房间号</div>
            <div
              data-testid="room-code-display"
              className="mt-0.5 font-mono-num text-3xl font-bold tracking-[0.18em] text-[#F3D778]"
            >
              {snapshot.code}
            </div>
            <div className="mt-1 text-xs text-stone-400 font-mono-num">
              {snapshot.config.playerCount}人桌 · 筹码 ¥{snapshot.config.startingChips.toLocaleString()} · 盲注 {snapshot.config.smallBlind}/{snapshot.config.bigBlind}
            </div>
          </div>

          <button
            type="button"
            onClick={onLeave}
            aria-label="离开房间"
            className="flex min-h-[40px] items-center gap-1 rounded-xl border border-stone-700 bg-[#10201A] px-3 text-xs font-medium text-stone-300 hover:border-red-400/50 hover:text-red-200 cursor-pointer shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>离开</span>
          </button>
        </div>

        {/* Invite Share Row */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copyValue(snapshot.code, 'code')}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/30 bg-[#10201A] px-3 text-xs sm:text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158] cursor-pointer whitespace-nowrap"
          >
            {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-[#E5C158]" />}
            <span>{copiedCode ? '已复制房号' : '复制房间号'}</span>
          </button>

          <button
            type="button"
            data-testid="copy-invite-link-btn"
            onClick={() => copyValue(inviteUrl, 'link')}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/30 bg-[#10201A] px-3 text-xs sm:text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158] cursor-pointer whitespace-nowrap"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-[#E5C158]" />}
            <span>{copiedLink ? '已复制链接' : '复制邀请链接'}</span>
          </button>
        </div>

        {/* Seated Players List */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-stone-300">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#E5C158]" />
              <span>已入座玩家 ({snapshot.members.length}/{snapshot.config.playerCount})</span>
            </span>
            <span className={wsConnected ? 'text-emerald-400' : 'text-amber-300'}>
              {wsConnected ? '实时已连接' : '连接同步中'}
            </span>
          </div>

          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {snapshot.members.map((member, idx) => {
              const memberIsHost = member.id === snapshot.hostId;
              const isSelf = member.id === playerId;
              return (
                <div
                  key={member.id}
                  data-testid={`lobby-member-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-[#C9A24D]/20 bg-[#10201A] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-num text-xs text-stone-400">
                      #{idx + 1}
                    </span>
                    <span className="truncate text-sm font-semibold text-[#F5F2EB]">
                      {member.name}
                    </span>
                    {isSelf && (
                      <span className="text-[11px] font-medium text-[#E5C158]">
                        (你)
                      </span>
                    )}
                    {memberIsHost && (
                      <span className="text-[11px] font-medium text-amber-300">
                        · 房主
                      </span>
                    )}
                    {member.isAI && (
                      <span className="text-[11px] text-emerald-300">
                        · AI ({member.personalityLabel})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!member.isAI && (
                      <span
                        className={`text-xs ${
                          member.connected ? 'text-emerald-400' : 'text-stone-400'
                        }`}
                      >
                        {member.connected ? '在线' : '离线'}
                      </span>
                    )}
                    {isHost && member.isAI && (
                      <button
                        type="button"
                        aria-label={`移除 ${member.name}`}
                        onClick={() => onRemoveAI(member.id)}
                        className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-red-500/30 text-red-300 hover:bg-red-950/50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Host Actions */}
        <div className="mt-5 flex flex-col gap-2">
          {isHost ? (
            <>
              {!isFull && (
                <button
                  type="button"
                  data-testid="add-ai-btn"
                  onClick={onAddAI}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/35 bg-[#10201A] text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158] cursor-pointer"
                >
                  <Bot className="h-4 w-4 text-[#E5C158]" />
                  <span>添加 1 名 AI 玩家补位</span>
                </button>
              )}

              <button
                type="button"
                data-testid="start-room-btn"
                disabled={!canStart}
                onClick={onStartGame}
                className="min-h-[48px] w-full rounded-xl bg-[#E5C158] text-[#0A1410] font-bold text-base hover:bg-[#F3D778] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer"
              >
                {canStart ? '开始多人牌局' : '至少需要 2 名玩家才可开局'}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-[#C9A24D]/25 bg-[#10201A] px-4 py-3 text-center text-sm text-stone-300">
              已入座，正在等待房主点击开始牌局...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
