import React from 'react';
import { Share2 } from 'lucide-react';
import type { HandLogEntry } from '../poker/types.ts';
import { PlayingCard } from './PlayingCard.tsx';

interface HistoryDrawerProps {
  open: boolean;
  history: HandLogEntry[];
  fourColor: boolean;
  onShareHand?: (entry: HandLogEntry) => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  open,
  history,
  fourColor,
  onShareHand,
  onClose,
}) => {
  if (!open) return null;

  const handsPlayed = history.length;
  const handsWonByHero = history.filter((h) => h.heroNet > 0).length;
  const totalNet = history.reduce((sum, h) => sum + h.heroNet, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="牌局战绩与历史记录"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-[#C9A24D]/35 bg-[#0C1914] text-[#F5F2EB] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#C9A24D]/20 px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg font-bold text-[#F3D778]">
            牌局战绩与记录
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg border border-[#C9A24D]/25 text-sm text-stone-300 hover:border-[#E5C158] cursor-pointer"
          >
            关闭
          </button>
        </div>

        {/* Session Summary */}
        <div className="grid grid-cols-3 gap-2 border-b border-[#C9A24D]/15 bg-[#09130F] p-3 sm:px-6">
          <div className="text-center">
            <div className="text-[11px] text-stone-400">已完手数</div>
            <div className="font-mono-num text-base font-bold text-[#F5F2EB]">
              {handsPlayed}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-stone-400">净胜局数</div>
            <div className="font-mono-num text-base font-bold text-[#E5C158]">
              {handsWonByHero}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-stone-400">累计盈亏</div>
            <div
              className={`font-mono-num text-base font-bold ${
                totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {totalNet >= 0 ? `+${totalNet}` : totalNet}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-400">
              完成第一手牌后，将在此显示详细胜负记录。
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-num font-bold text-[#C9A24D]">
                    第 {entry.handNumber} 手 · 底池 ¥{entry.potTotal}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono-num font-bold ${
                        entry.heroNet > 0
                          ? 'text-emerald-400'
                          : entry.heroNet < 0
                          ? 'text-red-400'
                          : 'text-stone-400'
                      }`}
                    >
                      {entry.heroNet > 0
                        ? `+¥${entry.heroNet}`
                        : entry.heroNet < 0
                        ? `-¥${Math.abs(entry.heroNet)}`
                        : '平手 ¥0'}
                    </span>
                    {onShareHand && (
                      <button
                        type="button"
                        onClick={() => onShareHand(entry)}
                        aria-label={`分享第 ${entry.handNumber} 手`}
                        className="flex min-h-[32px] items-center gap-1 rounded-lg border border-[#C9A24D]/35 bg-[#0A1511] px-2 text-[11px] font-medium text-[#F3D778] hover:border-[#E5C158] cursor-pointer"
                      >
                        <Share2 className="h-3 w-3" />
                        <span>分享</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-[#F5F2EB] truncate">
                    {entry.winningSummary}
                  </span>
                  {entry.communityCards.length > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {entry.communityCards.map((c) => (
                        <PlayingCard
                          key={c.id}
                          card={c}
                          size="xs"
                          fourColor={fourColor}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
