import React, { useState } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { rankToShort } from '../poker/evaluator.ts';
import {
  encodeSharedHand,
  formatHandSummaryText,
} from '../poker/share.ts';
import type { SharedHandPayload } from '../poker/share.ts';
import type { Card, Suit } from '../poker/types.ts';
import { PlayingCard } from './PlayingCard.tsx';

interface ShareHandModalProps {
  hand: SharedHandPayload | null;
  fourColor: boolean;
  isIncomingShare?: boolean;
  onClose: () => void;
}

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

function drawCardToCanvas(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = '#FCFBF7';
  ctx.strokeStyle = '#D6CFC2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  ctx.fillStyle = isRed ? '#C81E2B' : '#18181B';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rankToShort(card.rank), x + 8, y + 7);

  ctx.font = '26px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SUIT_GLYPH[card.suit], x + w / 2, y + h / 2 + 6);
  ctx.restore();
}

export const ShareHandModal: React.FC<ShareHandModalProps> = ({
  hand,
  fourColor,
  isIncomingShare = false,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!hand) return null;

  const token = encodeSharedHand(hand);
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?hand=${token}`
      : `?hand=${token}`;

  const copyText = async (text: string, which: 'link' | 'text') => {
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
    if (which === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 460;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background felt gradient
    const bg = ctx.createRadialGradient(420, 200, 40, 420, 230, 520);
    bg.addColorStop(0, '#145C40');
    bg.addColorStop(0.65, '#0B3B28');
    bg.addColorStop(1, '#071E15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 840, 460);

    // Gold border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(16, 16, 808, 428, 22);
    ctx.stroke();

    // Header
    ctx.fillStyle = '#F3D778';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('皇家德州 · 手牌战报', 42, 62);

    ctx.fillStyle = '#D1D5DB';
    ctx.font = '18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `第 ${hand.handNumber} 手 · ${hand.playerCount}人桌 · 盲注 ${hand.smallBlind}/${hand.bigBlind}`,
      798,
      62
    );

    // Hole cards label & cards
    ctx.fillStyle = '#A7F3D0';
    ctx.font = '600 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('手牌', 42, 118);

    hand.heroHoleCards.forEach((card, i) => {
      drawCardToCanvas(ctx, card, 42 + i * 82, 134, 72, 102);
    });

    // Community cards label & cards
    ctx.fillStyle = '#A7F3D0';
    ctx.fillText('公共牌', 252, 118);
    if (hand.communityCards.length > 0) {
      hand.communityCards.forEach((card, i) => {
        drawCardToCanvas(ctx, card, 252 + i * 82, 134, 72, 102);
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '18px sans-serif';
      ctx.fillText('翻牌前结束战斗', 252, 184);
    }

    // Divider
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(42, 274);
    ctx.lineTo(798, 274);
    ctx.stroke();

    // Result summary
    ctx.fillStyle = '#F5F2EB';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(hand.winningSummary, 42, 326);

    ctx.fillStyle = '#E5C158';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`总底池 ¥${hand.potTotal.toLocaleString()}`, 42, 376);

    const netStr =
      hand.heroNet > 0
        ? `+¥${hand.heroNet.toLocaleString()}`
        : hand.heroNet < 0
        ? `-¥${Math.abs(hand.heroNet).toLocaleString()}`
        : '平手 ¥0';
    ctx.fillStyle = hand.heroNet > 0 ? '#34D399' : hand.heroNet < 0 ? '#F87171' : '#D1D5DB';
    ctx.textAlign = 'right';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`本手盈亏 ${netStr}`, 798, 376);

    const link = document.createElement('a');
    link.download = `royal-holdem-hand-${hand.handNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const netLabel =
    hand.heroNet > 0
      ? `+¥${hand.heroNet.toLocaleString()}`
      : hand.heroNet < 0
      ? `-¥${Math.abs(hand.heroNet).toLocaleString()}`
      : '¥0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="手牌分享"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/78 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-[#C9A24D]/40 bg-[#0C1914] p-4 sm:p-6 text-[#F5F2EB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#C9A24D]/20">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-[#E5C158]" aria-hidden="true" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#F3D778]">
              {isIncomingShare
                ? `${hand.sharedBy ? `${hand.sharedBy} 分享的手牌` : '好友分享的手牌'}`
                : '分享精彩手牌'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg border border-[#C9A24D]/25 px-3 text-xs sm:text-sm text-stone-300 hover:border-[#E5C158] cursor-pointer"
          >
            {isIncomingShare ? '进入牌局' : '关闭'}
          </button>
        </div>

        {/* Visual Hand Share Card Preview */}
        <div className="mt-4 rounded-2xl border border-[#C9A24D]/40 felt-surface p-4 shadow-inner">
          <div className="flex items-center justify-between text-xs text-emerald-100/80 font-mono-num">
            <span>
              第 {hand.handNumber} 手 · {hand.playerCount}人桌
            </span>
            <span>
              盲注 {hand.smallBlind}/{hand.bigBlind}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {/* Hero Hole Cards */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-emerald-200/80">
                  我的底牌
                </div>
                <div className="flex items-center gap-1.5">
                  {hand.heroHoleCards.length > 0 ? (
                    hand.heroHoleCards.map((c) => (
                      <PlayingCard
                        key={c.id}
                        card={c}
                        size="sm"
                        fourColor={fourColor}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-stone-300">未亮牌</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-emerald-200/80">总底池</div>
                <div className="font-mono-num text-lg font-bold text-[#F3D778]">
                  ¥{hand.potTotal.toLocaleString()}
                </div>
                <div
                  className={`font-mono-num text-sm font-bold ${
                    hand.heroNet > 0
                      ? 'text-emerald-300'
                      : hand.heroNet < 0
                      ? 'text-red-300'
                      : 'text-stone-300'
                  }`}
                >
                  盈亏 {netLabel}
                </div>
              </div>
            </div>

            {/* Community Cards */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-emerald-200/80">
                公共牌
              </div>
              {hand.communityCards.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hand.communityCards.map((c) => (
                    <PlayingCard
                      key={c.id}
                      card={c}
                      size="sm"
                      fourColor={fourColor}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#F3D778]/25 bg-[#07261A]/50 px-3 py-2 text-xs text-stone-300">
                  翻牌前直接分出胜负
                </div>
              )}
            </div>

            {/* Winning Summary */}
            <div className="rounded-xl bg-[#08130E]/85 border border-[#C9A24D]/35 px-3 py-2 text-xs sm:text-sm font-semibold text-[#F3D778]">
              {hand.winningSummary}
            </div>
          </div>
        </div>

        {/* Share Action Buttons */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="copy-hand-link-btn"
            onClick={() => copyText(shareUrl, 'link')}
            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-[#E5C158] px-3 text-xs sm:text-sm font-bold text-[#0A1410] hover:bg-[#F3D778] active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedLink ? '已复制链接' : '复制分享链接'}</span>
          </button>

          <button
            type="button"
            data-testid="copy-hand-text-btn"
            onClick={() => copyText(formatHandSummaryText(hand, shareUrl), 'text')}
            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/35 bg-[#10201A] px-3 text-xs sm:text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158] active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            {copiedText ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-[#E5C158]" />}
            <span>{copiedText ? '已复制战报' : '复制战报文字'}</span>
          </button>

          <button
            type="button"
            data-testid="download-hand-png-btn"
            onClick={handleDownloadPng}
            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/35 bg-[#10201A] px-3 text-xs sm:text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158] active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-[#E5C158]" />
            <span>保存战报长图</span>
          </button>
        </div>
      </div>
    </div>
  );
};
