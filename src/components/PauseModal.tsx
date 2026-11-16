import React from 'react';

interface PauseModalProps {
  open: boolean;
  muted: boolean;
  fourColor: boolean;
  fastMode: boolean;
  isMultiplayer?: boolean;
  onToggleMute: () => void;
  onToggleFourColor: () => void;
  onToggleFastMode: () => void;
  onResume: () => void;
  onRestart: () => void;
  onBackToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  open,
  muted,
  fourColor,
  fastMode,
  isMultiplayer = false,
  onToggleMute,
  onToggleFourColor,
  onToggleFastMode,
  onResume,
  onRestart,
  onBackToTitle,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="牌局设置与暂停"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onResume}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#C9A24D]/35 bg-[#0C1914] p-5 text-[#F5F2EB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-[#F3D778] text-center">
          {isMultiplayer ? '房间设置' : '牌局暂停与设置'}
        </h2>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#C9A24D]/25 bg-[#10201A] px-4 text-sm cursor-pointer hover:border-[#E5C158]/50"
          >
            <span>牌桌音效</span>
            <span className="font-semibold text-[#E5C158]">
              {muted ? '已静音' : '开启'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleFourColor}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#C9A24D]/25 bg-[#10201A] px-4 text-sm cursor-pointer hover:border-[#E5C158]/50"
          >
            <span>四色扑克牌面</span>
            <span className="font-semibold text-[#E5C158]">
              {fourColor ? '四色 (黑红蓝绿)' : '经典双色'}
            </span>
          </button>

          {!isMultiplayer && (
            <button
              type="button"
              onClick={onToggleFastMode}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#C9A24D]/25 bg-[#10201A] px-4 text-sm cursor-pointer hover:border-[#E5C158]/50"
            >
              <span>AI 出牌速度</span>
              <span className="font-semibold text-[#E5C158]">
                {fastMode ? '极速模式' : '标准节奏'}
              </span>
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[46px] w-full rounded-xl bg-[#E5C158] text-[#0A1410] font-bold text-sm hover:bg-[#F3D778] cursor-pointer"
          >
            继续牌局
          </button>
          {!isMultiplayer && (
            <button
              type="button"
              onClick={onRestart}
              className="min-h-[44px] w-full rounded-xl border border-[#C9A24D]/30 bg-[#10201A] text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158]/50 cursor-pointer"
            >
              重置筹码重新开局
            </button>
          )}
          <button
            type="button"
            onClick={onBackToTitle}
            className="min-h-[44px] w-full rounded-xl border border-stone-700 bg-transparent text-sm font-medium text-stone-300 hover:text-white cursor-pointer"
          >
            {isMultiplayer ? '离开房间返回主菜单' : '返回主菜单'}
          </button>
        </div>
      </div>
    </div>
  );
};
