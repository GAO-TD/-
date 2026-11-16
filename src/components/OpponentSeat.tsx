import React from 'react';
import { Player } from '../poker/types';
import { PlayingCard } from './PlayingCard';

interface OpponentSeatProps {
  player: Player;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActing: boolean;
  isWinner: boolean;
  revealCards: boolean;
  winningCardIds: Set<string>;
  fourColor: boolean;
  compact?: boolean;
  hideBet?: boolean;
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isActing,
  isWinner,
  revealCards,
  winningCardIds,
  fourColor,
  compact = false,
  hideBet = false,
}) => {
  const isFolded = player.status === 'folded';
  const isOut = player.status === 'out';
  const isAllIn = player.status === 'allin';

  const actionColor =
    player.lastActionType === 'win'
      ? 'text-[#F3D778]'
      : player.lastActionType === 'allin' || player.lastActionType === 'raise'
      ? 'text-[#FBBF24]'
      : player.lastActionType === 'fold'
      ? 'text-stone-400'
      : 'text-emerald-300';

  return (
    <div
      data-testid={`seat-${player.id}`}
      className={`relative flex flex-col items-center transition-opacity duration-200 ${
        isOut ? 'opacity-35' : isFolded ? 'opacity-55' : 'opacity-100'
      }`}
    >
      {/* Cards sitting just above or tucked behind seat plate */}
      {!isOut && (player.holeCards.length > 0 || player.hasHoleCards) && (
        <div className={`flex items-center -space-x-2 ${compact ? '-mb-2' : '-mb-2.5'} z-0`}>
          {player.holeCards.length > 0
            ? player.holeCards.map((c, idx) => (
                <PlayingCard
                  key={c.id}
                  card={c}
                  faceDown={!revealCards || isFolded}
                  size={compact ? 'xs' : 'sm'}
                  fourColor={fourColor}
                  highlighted={revealCards && winningCardIds.has(c.id)}
                  dimmed={revealCards && winningCardIds.size > 0 && !winningCardIds.has(c.id)}
                  delayMs={idx * 60}
                />
              ))
            : [0, 1].map((idx) => (
                <PlayingCard
                  key={`hidden-${player.id}-${idx}`}
                  faceDown={true}
                  size={compact ? 'xs' : 'sm'}
                  fourColor={fourColor}
                  delayMs={idx * 60}
                />
              ))}
        </div>
      )}

      {/* Seat Info Plate */}
      <div
        className={`relative z-10 flex flex-col justify-between rounded-xl border px-2.5 py-1.5 transition-all duration-200 ${
          compact ? 'min-w-[84px] max-w-[106px]' : 'min-w-[126px] max-w-[148px]'
        } ${
          isWinner
            ? 'border-[#F3D778] bg-[#162920] shadow-[0_0_20px_rgba(243,215,120,0.4)]'
            : isActing
            ? 'border-[#E5C158] bg-[#14251E] shadow-[0_0_16px_rgba(229,193,88,0.35)]'
            : 'border-[#C9A24D]/25 bg-[#0D1914]/95 shadow-[0_6px_14px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Dealer / Blind Corner Markers */}
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs sm:text-[13px] font-semibold text-[#F5F2EB]">
            {player.name}
            {player.connected === false && (
              <span className="ml-1 text-[10px] text-stone-400">(离线)</span>
            )}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {isDealer && (
              <span
                title="庄家按钮 (Dealer)"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E5C158] text-[9px] font-extrabold text-[#0B1410]"
              >
                D
              </span>
            )}
            {isSmallBlind && !isDealer && (
              <span className="text-[10px] font-semibold text-[#C9A24D]">SB</span>
            )}
            {isBigBlind && (
              <span className="text-[10px] font-semibold text-[#C9A24D]">BB</span>
            )}
          </div>
        </div>

        {/* Chips & Status */}
        <div className="mt-0.5 flex items-baseline justify-between gap-1">
          <span className="font-mono-num text-xs sm:text-sm font-bold text-[#E5C158]">
            {isOut ? '淘汰' : `¥${player.chips.toLocaleString()}`}
          </span>
          {!compact && player.personalityLabel && !isOut && (
            <span className="text-[10px] text-stone-400 truncate">
              {player.personalityLabel}
            </span>
          )}
        </div>

        {/* Last Action / Bet Readout */}
        <div className="mt-0.5 min-h-[15px] text-[11px] font-medium leading-tight truncate">
          {isActing ? (
            <span className="text-[#F3D778]">思考中...</span>
          ) : isAllIn ? (
            <span className="text-amber-300 font-semibold">全下 {player.betThisRound > 0 ? player.betThisRound : ''}</span>
          ) : player.lastAction ? (
            <span className={actionColor}>{player.lastAction}</span>
          ) : (
            <span className="text-stone-500">等待</span>
          )}
        </div>
      </div>

      {/* Active Bet Chip Readout in front of seat */}
      {!hideBet && player.betThisRound > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-mono-num font-semibold text-[#F5F2EB] bg-[#09120E]/90 border border-[#C9A24D]/35 rounded-md px-1.5 py-0.5 shadow">
          <span className="inline-block h-2 w-2 rounded-full bg-[#E5C158]" aria-hidden="true" />
          <span>{player.betThisRound}</span>
        </div>
      )}
    </div>
  );
};
