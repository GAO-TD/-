import React from 'react';
import { rankToShort } from '../poker/evaluator';
import { Card, Suit } from '../poker/types';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fourColor?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  delayMs?: number;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps['size']>, string> = {
  xs: 'w-8 h-11 rounded-[5px] text-[11px]',
  sm: 'w-10 h-14 sm:w-12 sm:h-[68px] rounded-[6px] text-xs sm:text-sm',
  md: 'w-[50px] h-[72px] sm:w-[66px] sm:h-[94px] rounded-lg text-sm sm:text-base',
  lg: 'w-[58px] h-[82px] sm:w-[74px] sm:h-[104px] rounded-[10px] text-base sm:text-lg',
};

function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  switch (suit) {
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2C9 6.5 4 10.2 4 14.5C4 17.5 6.3 19.5 9 19.5C10.3 19.5 11.4 18.9 12 18C12.6 18.9 13.7 19.5 15 19.5C17.7 19.5 20 17.5 20 14.5C20 10.2 15 6.5 12 2ZM10.8 18.5L9.5 22H14.5L13.2 18.5H10.8Z" />
        </svg>
      );
    case 'hearts':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2L20 12L12 22L4 12L12 2Z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 3C9.8 3 8 4.8 8 7C8 8.1 8.5 9.1 9.2 9.8C8.6 9.6 8 9.5 7.4 9.5C5.2 9.5 3.4 11.3 3.4 13.5C3.4 15.7 5.2 17.5 7.4 17.5C9.1 17.5 10.5 16.4 11.1 14.9L9.8 21.5H14.2L12.9 14.9C13.5 16.4 14.9 17.5 16.6 17.5C18.8 17.5 20.6 15.7 20.6 13.5C20.6 11.3 18.8 9.5 16.6 9.5C16 9.5 15.4 9.6 14.8 9.8C15.5 9.1 16 8.1 16 7C16 4.8 14.2 3 12 3Z" />
        </svg>
      );
  }
}

function getSuitColorClass(suit: Suit, fourColor: boolean): string {
  if (!fourColor) {
    return suit === 'hearts' || suit === 'diamonds' ? 'text-[#C81E2B]' : 'text-[#18181B]';
  }
  switch (suit) {
    case 'spades':
      return 'text-[#18181B]';
    case 'hearts':
      return 'text-[#C81E2B]';
    case 'diamonds':
      return 'text-[#1D4ED8]';
    case 'clubs':
      return 'text-[#15803D]';
  }
}

const SUIT_LABEL_ZH: Record<Suit, string> = {
  spades: '黑桃',
  hearts: '红桃',
  diamonds: '方块',
  clubs: '梅花',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'md',
  fourColor = false,
  highlighted = false,
  dimmed = false,
  delayMs = 0,
}) => {
  const sizeCls = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        style={{ animationDelay: `${delayMs}ms` }}
        className={`${sizeCls} animate-card-deal relative select-none overflow-hidden border border-[#C9A24D]/55 bg-[#11241D] shadow-[0_4px_12px_rgba(0,0,0,0.45)]`}
        aria-label="暗牌"
      >
        <div
          className="absolute inset-[3px] rounded-[inherit] border border-[#D4AF37]/40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(212,175,55,0.12) 0px, rgba(212,175,55,0.12) 2px, transparent 2px, transparent 6px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rotate-45 border border-[#D4AF37]/60 bg-[#D4AF37]/20" />
        </div>
      </div>
    );
  }

  const rankStr = rankToShort(card.rank);
  const colorCls = getSuitColorClass(card.suit, fourColor);
  const pipSize =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
      ? 'w-3.5 h-3.5 sm:w-4 sm:h-4'
      : size === 'md'
      ? 'w-5 h-5 sm:w-7 sm:h-7'
      : 'w-6 h-6 sm:w-8 sm:h-8';
  const cornerPipSize =
    size === 'xs' ? 'w-2 h-2' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3 sm:w-3.5 sm:h-3.5';

  if (size === 'xs') {
    return (
      <div
        style={{ animationDelay: `${delayMs}ms` }}
        aria-label={`${SUIT_LABEL_ZH[card.suit]}${rankStr}`}
        className={`${sizeCls} ${colorCls} animate-card-deal relative flex select-none flex-col justify-between bg-[#FCFBF7] p-1 font-bold leading-none transition-transform duration-200 ${
          highlighted
            ? 'ring-2 ring-[#F3D778] shadow-[0_0_18px_rgba(243,215,120,0.55)] -translate-y-1.5'
            : 'border border-[#D6CFC2] shadow-[0_4px_10px_rgba(0,0,0,0.4)]'
        } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
      >
        <span className="self-start tracking-tighter text-[11px]">{rankStr}</span>
        <SuitIcon suit={card.suit} className="w-3.5 h-3.5 self-end" />
      </div>
    );
  }

  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      aria-label={`${SUIT_LABEL_ZH[card.suit]}${rankStr}`}
      className={`${sizeCls} ${colorCls} animate-card-deal relative flex select-none flex-col justify-between bg-[#FCFBF7] p-1 sm:p-1.5 font-bold leading-none transition-transform duration-200 ${
        highlighted
          ? 'ring-2 ring-[#F3D778] shadow-[0_0_18px_rgba(243,215,120,0.55)] -translate-y-1.5'
          : 'border border-[#D6CFC2] shadow-[0_6px_14px_rgba(0,0,0,0.42)]'
      } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center self-start">
        <span className="tracking-tighter">{rankStr}</span>
        <SuitIcon suit={card.suit} className={cornerPipSize} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <SuitIcon suit={card.suit} className={pipSize} />
      </div>

      <div className="flex flex-col items-center self-end rotate-180">
        <span className="tracking-tighter">{rankStr}</span>
        <SuitIcon suit={card.suit} className={cornerPipSize} />
      </div>
    </div>
  );
};
