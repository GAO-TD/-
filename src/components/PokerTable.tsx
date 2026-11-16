import React from 'react';
import { getTotalPotAmount } from '../poker/engine';
import { GameTableState, Player } from '../poker/types';
import { OpponentSeat } from './OpponentSeat';
import { PlayingCard } from './PlayingCard';

interface PokerTableProps {
  state: GameTableState;
  heroId?: string;
  fourColor: boolean;
  isPreview?: boolean;
}

const STREET_LABEL_ZH: Record<GameTableState['street'], string> = {
  preflop: '翻牌前',
  flop: '翻牌圈',
  turn: '转牌圈',
  river: '河牌圈',
  showdown: '摊牌比牌',
};

export const PokerTable: React.FC<PokerTableProps> = ({
  state,
  heroId = 'hero',
  fourColor,
  isPreview = false,
}) => {
  const heroIdxRaw = state.players.findIndex((p) => p.id === heroId);
  const heroIdx = heroIdxRaw >= 0 ? heroIdxRaw : 0;
  const heroPlayer = state.players[heroIdx];
  const opponents: Player[] = [];
  for (let offset = 1; offset < state.players.length; offset++) {
    opponents.push(state.players[(heroIdx + offset) % state.players.length]);
  }
  const totalPot = getTotalPotAmount(state);

  const nonFoldedCount = state.players.filter(
    (p) => p.status !== 'folded' && p.status !== 'out'
  ).length;
  const revealShowdown =
    (state.isHandComplete && nonFoldedCount > 1) ||
    (state.isAllInRunout && nonFoldedCount > 1);

  const winnerIds = new Set<string>();
  const winningCardIds = new Set<string>();
  for (const payout of state.payouts) {
    payout.winnerIds.forEach((id) => winnerIds.add(id));
    payout.winningHand?.bestFive.forEach((c) => winningCardIds.add(c.id));
  }

  const renderSeat = (player: Player, compact: boolean) => (
    <OpponentSeat
      key={player.id}
      player={player}
      isDealer={state.dealerIndex === player.seatIndex}
      isSmallBlind={state.sbIndex === player.seatIndex}
      isBigBlind={state.bbIndex === player.seatIndex}
      isActing={!isPreview && state.actingPlayerIndex === player.seatIndex}
      isWinner={!isPreview && state.isHandComplete && winnerIds.has(player.id)}
      revealCards={!isPreview && revealShowdown}
      winningCardIds={winningCardIds}
      fourColor={fourColor}
      compact={compact}
      hideBet={state.isHandComplete}
    />
  );

  // Split opponents into upper row and side flanks for clean non-overlapping layout on both mobile and desktop
  let topRow: Player[] = [];
  let leftFlank: Player | null = null;
  let rightFlank: Player | null = null;

  if (opponents.length <= 3) {
    topRow = opponents;
  } else if (opponents.length === 4) {
    leftFlank = opponents[0];
    topRow = [opponents[1], opponents[2]];
    rightFlank = opponents[3];
  } else {
    // 5 opponents (6-max)
    leftFlank = opponents[0];
    topRow = [opponents[1], opponents[2], opponents[3]];
    rightFlank = opponents[4];
  }

  // Order topRow left-to-right clockwise around the table
  const orderedTopRow = [...topRow];

  // Only show side pot breakdown when a genuine all-in side pot exists (not live mid-street raises)
  const nonFoldedPlayers = state.players.filter(
    (p) => p.status !== 'folded' && p.status !== 'out'
  );
  const maxNonFoldedContribution = Math.max(
    0,
    ...nonFoldedPlayers.map((p) => p.totalContributed)
  );
  const hasRealSidePot =
    state.pots.length > 1 &&
    nonFoldedPlayers.some(
      (p) => p.status === 'allin' && p.totalContributed < maxNonFoldedContribution
    );

  return (
    <div className="relative flex w-full flex-1 flex-col items-center justify-center px-2 py-1 sm:px-6 sm:py-3 min-h-0">
      {/* Main Table Frame */}
      <div className="relative flex w-full max-w-[980px] flex-1 flex-col justify-between mahogany-rail rounded-[30px] sm:rounded-[160px] p-1.5 sm:p-3.5 max-h-[580px] sm:max-h-[520px]">
        {/* Inner Gold Trim & Emerald Felt */}
        <div className="relative flex flex-1 flex-col justify-between felt-surface rounded-[24px] sm:rounded-[148px] border-2 border-[#C9A24D]/45 px-2 py-2.5 sm:px-8 sm:py-5 overflow-hidden">
          {/* Subtle inner betting line */}
          <div
            className="pointer-events-none absolute inset-2.5 sm:inset-5 rounded-[18px] sm:rounded-[132px] border border-[#F3D778]/15"
            aria-hidden="true"
          />

          {/* Mobile: Clean non-overlapping opponent rows above community cards */}
          <div className="relative z-10 flex sm:hidden flex-wrap items-start justify-center gap-x-2 gap-y-2">
            {opponents.map((opp) => renderSeat(opp, true))}
          </div>

          {/* Desktop/Tablet: Top Opponent Arc */}
          <div className="relative z-10 hidden sm:flex items-start justify-center gap-6 md:gap-8">
            {orderedTopRow.map((opp) => renderSeat(opp, opponents.length >= 4))}
          </div>

          {/* Middle Section: Desktop Flank Opponents + Center Community Cards & Pot */}
          <div className="relative z-10 my-auto flex items-center justify-between gap-2 sm:gap-4 py-1.5 sm:py-2">
            {/* Left Flank Seat (desktop/tablet only when 5 or 6 players) */}
            {leftFlank ? (
              <div className="hidden sm:block shrink-0">{renderSeat(leftFlank, true)}</div>
            ) : (
              <div className="hidden sm:block w-12" />
            )}

            {/* Center Pot + Community Cards */}
            <div className="flex flex-1 flex-col items-center justify-center min-w-0">
              {/* Pot & Street Readout */}
              <div className="mb-2 sm:mb-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center">
                <div
                  data-testid="pot-display"
                  className="flex items-center gap-1.5 rounded-lg bg-[#08130E]/85 border border-[#C9A24D]/40 px-3 py-1 shadow-md"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-[#E5C158] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                  <span className="text-[11px] sm:text-xs text-stone-300">底池</span>
                  <span className="font-mono-num text-sm sm:text-base font-bold text-[#F3D778]">
                    ¥{totalPot.toLocaleString()}
                  </span>
                </div>

                {!isPreview && (
                  <span className="text-[11px] sm:text-xs font-medium text-emerald-200/80">
                    {STREET_LABEL_ZH[state.street]}
                  </span>
                )}
              </div>

              {/* Side Pot Breakdown only when real all-in side pots exist */}
              {!isPreview && hasRealSidePot && (
                <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[#E5C158]/90 font-mono-num">
                  {state.pots.map((pot, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[#08130E]/75 border border-[#C9A24D]/25 px-2 py-0.5"
                    >
                      {idx === 0 ? '主池' : `边池${idx}`} ¥{pot.amount.toLocaleString()}
                    </span>
                  ))}
                </div>
              )}

              {/* 5 Community Cards */}
              <div
                data-testid="community-cards"
                className="flex items-center justify-center gap-1.5 sm:gap-2.5"
              >
                {[0, 1, 2, 3, 4].map((slotIdx) => {
                  const card = state.communityCards[slotIdx];
                  if (!card) {
                    return (
                      <div
                        key={`empty-${slotIdx}`}
                        className="w-[50px] h-[72px] sm:w-[66px] sm:h-[94px] rounded-lg border border-dashed border-[#F3D778]/20 bg-[#07261A]/40"
                        aria-hidden="true"
                      />
                    );
                  }
                  const isWinning =
                    revealShowdown && winningCardIds.has(card.id);
                  const isDimmed =
                    revealShowdown &&
                    winningCardIds.size > 0 &&
                    !winningCardIds.has(card.id);
                  return (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      size="md"
                      fourColor={fourColor}
                      highlighted={isWinning}
                      dimmed={isDimmed}
                      delayMs={slotIdx < 3 ? slotIdx * 70 : 0}
                    />
                  );
                })}
              </div>

              {/* Live Action / Showdown Summary Line */}
              {!isPreview && (
                <div
                  data-testid="table-status-banner"
                  className={`mt-2 sm:mt-3 max-w-full truncate rounded-md px-3 py-1 text-center text-xs sm:text-sm font-medium ${
                    state.isHandComplete
                      ? 'bg-[#172B21] text-[#F3D778] border border-[#E5C158]/50 shadow-md'
                      : 'text-emerald-100/85'
                  }`}
                >
                  {state.actionMessage}
                </div>
              )}
            </div>

            {/* Right Flank Seat (desktop/tablet only when 5 or 6 players) */}
            {rightFlank ? (
              <div className="hidden sm:block shrink-0">{renderSeat(rightFlank, true)}</div>
            ) : (
              <div className="hidden sm:block w-12" />
            )}
          </div>

          {/* Bottom Felt Spacer for Hero Bet Indicator */}
          <div className="relative z-10 flex items-center justify-center min-h-[26px]">
            {!isPreview && !state.isHandComplete && heroPlayer && heroPlayer.betThisRound > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-[#09120E]/90 border border-[#C9A24D]/45 px-2.5 py-0.5 text-xs font-mono-num font-semibold text-[#F5F2EB] shadow">
                <span className="inline-block h-2 w-2 rounded-full bg-[#E5C158]" aria-hidden="true" />
                <span>本轮下注 ¥{heroPlayer.betThisRound.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
