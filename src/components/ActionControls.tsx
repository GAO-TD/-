import React, { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { getLegalActions, getTotalPotAmount } from '../poker/engine.ts';
import { describePlayerHand } from '../poker/evaluator.ts';
import type { GameTableState, PlayerAction } from '../poker/types.ts';
import { PlayingCard } from './PlayingCard.tsx';

export type PreActionChoice = 'none' | 'check_fold' | 'auto_check';

interface ActionControlsProps {
  state: GameTableState;
  heroId?: string;
  fourColor: boolean;
  isMultiplayer?: boolean;
  isRoomHost?: boolean;
  turnSecondsLeft?: number | null;
  preAction: PreActionChoice;
  onSetPreAction: (choice: PreActionChoice) => void;
  onAction: (action: PlayerAction) => void;
  onNextHand: () => void;
  onRestartMatch: () => void;
  onShareLatestHand?: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  state,
  heroId = 'hero',
  fourColor,
  isMultiplayer = false,
  isRoomHost = true,
  turnSecondsLeft = null,
  preAction,
  onSetPreAction,
  onAction,
  onNextHand,
  onRestartMatch,
  onShareLatestHand,
}) => {
  const heroIndexRaw = state.players.findIndex((p) => p.id === heroId);
  const heroIndex = heroIndexRaw >= 0 ? heroIndexRaw : 0;
  const hero = state.players[heroIndex];

  const isHeroTurn =
    !state.isHandComplete &&
    !state.isAllInRunout &&
    state.actingPlayerIndex === heroIndex &&
    hero?.status === 'active';

  const legal = getLegalActions(state, heroIndex);
  const totalPot = Math.max(state.bigBlind, getTotalPotAmount(state));
  const [raiseTo, setRaiseTo] = useState<number>(legal.minRaiseTo);

  useEffect(() => {
    if (legal.canRaise) {
      setRaiseTo(legal.minRaiseTo);
    }
  }, [isHeroTurn, legal.canRaise, legal.minRaiseTo, legal.maxRaiseTo]);

  const handDescription =
    hero && hero.holeCards.length === 2
      ? describePlayerHand(hero.holeCards, state.communityCards)
      : '';

  const nonFoldedCount = state.players.filter(
    (p) => p.status !== 'folded' && p.status !== 'out'
  ).length;
  const revealShowdown = state.isHandComplete && nonFoldedCount > 1;
  const winningCardIds = new Set<string>();
  const heroIsWinner = state.payouts.some((p) => p.winnerIds.includes(hero?.id ?? ''));
  if (revealShowdown && hero) {
    state.payouts.forEach((p) => {
      if (p.winnerIds.includes(hero.id)) {
        p.winningHand?.bestFive.forEach((c) => winningCardIds.add(c.id));
      }
    });
  }

  const snapBet = (raw: number) => {
    const step = Math.max(5, state.smallBlind);
    const snapped = Math.round(raw / step) * step;
    return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, snapped));
  };

  const halfPotBet = snapBet(state.currentBet + totalPot * 0.5 + legal.callAmount);
  const fullPotBet = snapBet(state.currentBet + totalPot + legal.callAmount);
  const isAllInRaise = raiseTo >= legal.maxRaiseTo;

  const isHeroDealer = state.dealerIndex === heroIndex;
  const isHeroSB = state.sbIndex === heroIndex;
  const isHeroBB = state.bbIndex === heroIndex;

  return (
    <section
      aria-label="玩家操作区"
      className="w-full shrink-0 border-t border-[#C9A24D]/25 bg-[#0A1511]/96 px-3 pt-2.5 pb-safe sm:px-6 sm:py-3"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {/* Hero Cards + Stack Info */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Hero Hole Cards */}
            <div className="flex items-center -space-x-1.5 sm:space-x-1.5 shrink-0">
              {hero?.holeCards.length > 0 ? (
                hero.holeCards.map((c, idx) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    size="lg"
                    fourColor={fourColor}
                    highlighted={revealShowdown && winningCardIds.has(c.id)}
                    dimmed={hero.status === 'folded'}
                    delayMs={idx * 80}
                  />
                ))
              ) : (
                <div className="h-[82px] w-[108px] rounded-lg border border-dashed border-[#C9A24D]/25" />
              )}
            </div>

            {/* Hero Stack & Live Hand Strength */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold text-[#F5F2EB] truncate max-w-[110px]">
                  {hero?.name ?? '你'}
                </span>
                {isHeroDealer && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E5C158] text-[10px] font-extrabold text-[#0B1410]">
                    D
                  </span>
                )}
                {isHeroSB && !isHeroDealer && (
                  <span className="text-xs font-semibold text-[#C9A24D]">SB</span>
                )}
                {isHeroBB && (
                  <span className="text-xs font-semibold text-[#C9A24D]">BB</span>
                )}
                {heroIsWinner && state.isHandComplete && (
                  <span className="text-xs font-bold text-[#F3D778]">· 胜出</span>
                )}
              </div>

              <div
                data-testid="hero-chips"
                className="font-mono-num text-lg sm:text-xl font-bold text-[#E5C158] leading-tight"
              >
                ¥{(hero?.chips ?? 0).toLocaleString()}
              </div>

              <div className="mt-0.5 text-xs text-emerald-200/85 truncate max-w-[170px] sm:max-w-[220px]">
                {hero?.status === 'out'
                  ? '已出局 · 观战中'
                  : hero?.status === 'folded'
                  ? '已弃牌'
                  : hero?.status === 'allin'
                  ? `全下 · ${handDescription}`
                  : handDescription || '准备发牌'}
              </div>
            </div>
          </div>

          {/* Mobile compact turn indicator */}
          <div className="sm:hidden text-right shrink-0">
            {isHeroTurn ? (
              <span className="inline-block rounded bg-[#E5C158]/20 border border-[#E5C158]/50 px-2 py-1 text-xs font-semibold text-[#F3D778] font-mono-num">
                轮到你{turnSecondsLeft !== null ? ` ${turnSecondsLeft}s` : ''}
              </span>
            ) : !state.isHandComplete ? (
              <span className="text-xs text-stone-400">
                等待行动{turnSecondsLeft !== null ? ` ${turnSecondsLeft}s` : ''}
              </span>
            ) : null}
          </div>
        </div>

        {/* Thumb-Zone Controls */}
        <div className="flex flex-1 flex-col gap-2 lg:max-w-[540px]">
          {state.isMatchOver ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <div className="text-sm font-medium text-[#F3D778] text-center sm:text-left sm:mr-2">
                {hero && hero.chips > 0 ? '你已成为牌桌最终赢家！' : '你的筹码已耗尽'}
              </div>
              {onShareLatestHand && state.history.length > 0 && (
                <button
                  type="button"
                  data-testid="share-hand-btn"
                  onClick={onShareLatestHand}
                  className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-[#10201A] px-4 text-sm font-semibold text-[#F3D778] hover:border-[#E5C158] cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="h-4 w-4" />
                  <span>分享手牌</span>
                </button>
              )}
              {(!isMultiplayer || isRoomHost) && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onRestartMatch}
                  className="min-h-[48px] px-6 rounded-xl bg-[#E5C158] text-[#0B1410] font-bold text-sm hover:bg-[#F3D778] active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                >
                  重新开始新牌局
                </button>
              )}
            </div>
          ) : state.isHandComplete ? (
            <div className="flex items-center justify-end gap-2">
              {onShareLatestHand && state.history.length > 0 && (
                <button
                  type="button"
                  data-testid="share-hand-btn"
                  onClick={onShareLatestHand}
                  className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-[#10201A] px-4 text-sm font-semibold text-[#F3D778] hover:border-[#E5C158] active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="h-4 w-4" />
                  <span>分享本手</span>
                </button>
              )}
              <button
                type="button"
                data-testid="next-hand-btn"
                onClick={onNextHand}
                className="flex-1 sm:flex-none min-h-[48px] px-8 rounded-xl bg-[#E5C158] text-[#0B1410] font-bold text-sm sm:text-base hover:bg-[#F3D778] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(229,193,88,0.28)] whitespace-nowrap cursor-pointer"
              >
                发下一手牌
              </button>
            </div>
          ) : isHeroTurn ? (
            <>
              {legal.canRaise && (
                <div className="flex flex-col gap-2 rounded-xl bg-[#11201A] border border-[#C9A24D]/25 p-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRaiseTo(legal.minRaiseTo)}
                      className="flex-1 min-h-[36px] rounded-lg border border-[#C9A24D]/30 bg-[#0A1511] px-2 text-xs font-medium text-stone-200 hover:border-[#E5C158] whitespace-nowrap cursor-pointer"
                    >
                      最小
                    </button>
                    <button
                      type="button"
                      onClick={() => setRaiseTo(halfPotBet)}
                      className="flex-1 min-h-[36px] rounded-lg border border-[#C9A24D]/30 bg-[#0A1511] px-2 text-xs font-medium text-stone-200 hover:border-[#E5C158] whitespace-nowrap cursor-pointer"
                    >
                      1/2池
                    </button>
                    <button
                      type="button"
                      onClick={() => setRaiseTo(fullPotBet)}
                      className="flex-1 min-h-[36px] rounded-lg border border-[#C9A24D]/30 bg-[#0A1511] px-2 text-xs font-medium text-stone-200 hover:border-[#E5C158] whitespace-nowrap cursor-pointer"
                    >
                      1x池
                    </button>
                    <button
                      type="button"
                      onClick={() => setRaiseTo(legal.maxRaiseTo)}
                      className="flex-1 min-h-[36px] rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 text-xs font-semibold text-amber-300 hover:border-amber-400 whitespace-nowrap cursor-pointer"
                    >
                      全下
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      aria-label="减少加注额"
                      onClick={() =>
                        setRaiseTo((prev) =>
                          Math.max(legal.minRaiseTo, prev - state.bigBlind)
                        )
                      }
                      className="min-h-[38px] min-w-[38px] rounded-lg bg-[#0A1511] border border-[#C9A24D]/30 text-base font-bold text-[#F5F2EB] hover:border-[#E5C158] cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      aria-label="加注金额滑块"
                      min={legal.minRaiseTo}
                      max={legal.maxRaiseTo}
                      step={Math.max(5, state.smallBlind)}
                      value={raiseTo}
                      onChange={(e) => setRaiseTo(Number(e.target.value))}
                      className="poker-slider flex-1"
                    />
                    <button
                      type="button"
                      aria-label="增加加注额"
                      onClick={() =>
                        setRaiseTo((prev) =>
                          Math.min(legal.maxRaiseTo, prev + state.bigBlind)
                        )
                      }
                      className="min-h-[38px] min-w-[38px] rounded-lg bg-[#0A1511] border border-[#C9A24D]/30 text-base font-bold text-[#F5F2EB] hover:border-[#E5C158] cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="fold-btn"
                  disabled={!legal.canFold}
                  onClick={() => onAction({ type: 'fold' })}
                  className="min-h-[48px] rounded-xl border border-red-500/35 bg-red-950/55 px-3 text-sm sm:text-base font-semibold text-red-200 hover:bg-red-900/65 disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                >
                  弃牌
                </button>

                {legal.canCheck ? (
                  <button
                    type="button"
                    data-testid="check-btn"
                    onClick={() => onAction({ type: 'check' })}
                    className="min-h-[48px] rounded-xl border border-emerald-500/45 bg-emerald-800/65 px-3 text-sm sm:text-base font-semibold text-emerald-50 hover:bg-emerald-700/75 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                  >
                    过牌
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="call-btn"
                    disabled={!legal.canCall}
                    onClick={() => onAction({ type: 'call' })}
                    className="min-h-[48px] rounded-xl border border-emerald-500/45 bg-emerald-800/75 px-3 text-sm sm:text-base font-semibold text-emerald-50 hover:bg-emerald-700/80 disabled:opacity-40 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer font-mono-num"
                  >
                    {legal.callAmount >= (hero?.chips ?? 0)
                      ? `全下 ${legal.callAmount}`
                      : `跟注 ${legal.callAmount}`}
                  </button>
                )}

                <button
                  type="button"
                  data-testid="raise-btn"
                  disabled={!legal.canRaise}
                  onClick={() =>
                    onAction(
                      isAllInRaise
                        ? { type: 'allin' }
                        : { type: 'raise', raiseTo }
                    )
                  }
                  className={`min-h-[48px] rounded-xl px-3 text-sm sm:text-base font-bold transition-all active:scale-[0.98] whitespace-nowrap font-mono-num ${
                    legal.canRaise
                      ? isAllInRaise
                        ? 'bg-amber-500 text-[#0B1410] hover:bg-amber-400 cursor-pointer'
                        : 'bg-[#E5C158] text-[#0B1410] hover:bg-[#F3D778] cursor-pointer'
                      : 'bg-stone-800/60 text-stone-500 border border-stone-700/40 cursor-not-allowed'
                  }`}
                >
                  {!legal.canRaise
                    ? '不可加注'
                    : isAllInRaise
                    ? `全下 ${legal.maxRaiseTo}`
                    : state.currentBet === 0
                    ? `下注 ${raiseTo}`
                    : `加注 ${raiseTo}`}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {hero?.status === 'active' && !state.isAllInRunout ? (
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSetPreAction(
                        preAction === 'check_fold' ? 'none' : 'check_fold'
                      )
                    }
                    className={`min-h-[44px] rounded-xl border px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      preAction === 'check_fold'
                        ? 'border-[#E5C158] bg-[#E5C158]/20 text-[#F3D778]'
                        : 'border-[#C9A24D]/25 bg-[#101E18] text-stone-300 hover:border-[#C9A24D]/50'
                    }`}
                  >
                    {preAction === 'check_fold' ? '✓ 自动过牌 / 弃牌' : '自动过牌 / 弃牌'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSetPreAction(
                        preAction === 'auto_check' ? 'none' : 'auto_check'
                      )
                    }
                    className={`min-h-[44px] rounded-xl border px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      preAction === 'auto_check'
                        ? 'border-emerald-400 bg-emerald-900/40 text-emerald-200'
                        : 'border-[#C9A24D]/25 bg-[#101E18] text-stone-300 hover:border-[#C9A24D]/50'
                    }`}
                  >
                    {preAction === 'auto_check' ? '✓ 仅自动过牌' : '仅自动过牌'}
                  </button>
                </div>
              ) : (
                <div className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-[#C9A24D]/20 bg-[#101E18]/70 text-xs sm:text-sm text-stone-300 font-mono-num">
                  {state.isAllInRunout
                    ? '全下对决 · 正在发出剩余公共牌...'
                    : turnSecondsLeft !== null
                    ? `等待其他玩家行动 (${turnSecondsLeft}s)`
                    : '本手已观战中'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
