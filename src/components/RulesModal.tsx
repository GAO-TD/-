import React, { useState } from 'react';
import { createCard } from '../poker/evaluator';
import { Card } from '../poker/types';
import { PlayingCard } from './PlayingCard';

interface RulesModalProps {
  open: boolean;
  fourColor: boolean;
  onClose: () => void;
}

interface RankExample {
  rank: number;
  name: string;
  desc: string;
  cards: Card[];
}

const HAND_RANK_EXAMPLES: RankExample[] = [
  {
    rank: 1,
    name: '皇家同花顺',
    desc: '同花色的 10-J-Q-K-A，最大牌型',
    cards: [
      createCard(10, 'spades'),
      createCard(11, 'spades'),
      createCard(12, 'spades'),
      createCard(13, 'spades'),
      createCard(14, 'spades'),
    ],
  },
  {
    rank: 2,
    name: '同花顺',
    desc: '五张同花色且点数相连（A-2-3-4-5 最小）',
    cards: [
      createCard(5, 'hearts'),
      createCard(6, 'hearts'),
      createCard(7, 'hearts'),
      createCard(8, 'hearts'),
      createCard(9, 'hearts'),
    ],
  },
  {
    rank: 3,
    name: '四条',
    desc: '四张相同点数的牌加一张单牌',
    cards: [
      createCard(14, 'spades'),
      createCard(14, 'hearts'),
      createCard(14, 'diamonds'),
      createCard(14, 'clubs'),
      createCard(13, 'spades'),
    ],
  },
  {
    rank: 4,
    name: '葫芦',
    desc: '三条加一对（先比三条大小，再比对子）',
    cards: [
      createCard(13, 'spades'),
      createCard(13, 'hearts'),
      createCard(13, 'clubs'),
      createCard(9, 'diamonds'),
      createCard(9, 'spades'),
    ],
  },
  {
    rank: 5,
    name: '同花',
    desc: '五张花色相同但不成顺子，按最大牌依次比',
    cards: [
      createCard(14, 'diamonds'),
      createCard(11, 'diamonds'),
      createCard(8, 'diamonds'),
      createCard(4, 'diamonds'),
      createCard(2, 'diamonds'),
    ],
  },
  {
    rank: 6,
    name: '顺子',
    desc: '五张不同花色但点数连续的牌',
    cards: [
      createCard(6, 'spades'),
      createCard(7, 'hearts'),
      createCard(8, 'clubs'),
      createCard(9, 'diamonds'),
      createCard(10, 'spades'),
    ],
  },
  {
    rank: 7,
    name: '三条',
    desc: '三张同点数的牌加两张散牌',
    cards: [
      createCard(7, 'spades'),
      createCard(7, 'hearts'),
      createCard(7, 'diamonds'),
      createCard(14, 'clubs'),
      createCard(3, 'spades'),
    ],
  },
  {
    rank: 8,
    name: '两对',
    desc: '两组不同的对子加一张踢脚牌',
    cards: [
      createCard(12, 'spades'),
      createCard(12, 'hearts'),
      createCard(5, 'diamonds'),
      createCard(5, 'clubs'),
      createCard(14, 'spades'),
    ],
  },
  {
    rank: 9,
    name: '一对',
    desc: '两张相同点数的牌加三张散牌',
    cards: [
      createCard(10, 'spades'),
      createCard(10, 'hearts'),
      createCard(14, 'diamonds'),
      createCard(8, 'clubs'),
      createCard(2, 'spades'),
    ],
  },
  {
    rank: 10,
    name: '高牌',
    desc: '不符合以上任何牌型，按最大单张依次比较',
    cards: [
      createCard(14, 'spades'),
      createCard(12, 'hearts'),
      createCard(9, 'diamonds'),
      createCard(5, 'clubs'),
      createCard(2, 'spades'),
    ],
  },
];

export const RulesModal: React.FC<RulesModalProps> = ({
  open,
  fourColor,
  onClose,
}) => {
  const [tab, setTab] = useState<'ranks' | 'rules'>('ranks');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="德州扑克规则与牌型图解"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-[#C9A24D]/35 bg-[#0C1914] text-[#F5F2EB] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9A24D]/20 px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#F3D778]">
            德州扑克规则与牌型
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭规则弹窗"
            className="min-h-[40px] min-w-[40px] rounded-lg border border-[#C9A24D]/25 text-sm text-stone-300 hover:border-[#E5C158] hover:text-white cursor-pointer"
          >
            关闭
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 border-b border-[#C9A24D]/15 bg-[#09130F] p-2 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('ranks')}
            className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === 'ranks'
                ? 'bg-[#E5C158] text-[#0A1410]'
                : 'text-stone-300 hover:bg-[#13261E]'
            }`}
          >
            十大牌型大小
          </button>
          <button
            type="button"
            onClick={() => setTab('rules')}
            className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === 'rules'
                ? 'bg-[#E5C158] text-[#0A1410]'
                : 'text-stone-300 hover:bg-[#13261E]'
            }`}
          >
            完整发牌与下注规则
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {tab === 'ranks' ? (
            HAND_RANK_EXAMPLES.map((item) => (
              <div
                key={item.rank}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs font-bold text-[#E5C158]">
                      #{item.rank}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-[#F5F2EB]">
                      {item.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-300">{item.desc}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.cards.map((c) => (
                    <PlayingCard
                      key={c.id}
                      card={c}
                      size="xs"
                      fourColor={fourColor}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-4 text-sm leading-relaxed text-stone-200">
              <div className="rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-4">
                <h3 className="font-bold text-[#F3D778]">1. 盲注与庄家位 (D / SB / BB)</h3>
                <p className="mt-1 text-xs sm:text-sm text-stone-300">
                  每手牌庄家按钮（D）顺时针移动一位。多人桌时，庄家左侧第一位下小盲注（SB），第二位下大盲注（BB）。两人单挑（Heads-Up）时，庄家即为小盲注，翻牌前先行动，翻牌后由大盲注先行动。
                </p>
              </div>
              <div className="rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-4">
                <h3 className="font-bold text-[#F3D778]">2. 四轮下注流程</h3>
                <ul className="mt-1.5 space-y-1 text-xs sm:text-sm text-stone-300 list-disc list-inside">
                  <li>翻牌前 (Preflop)：每人发 2 张底牌，从大盲左侧第一位开始行动。</li>
                  <li>翻牌圈 (Flop)：发出 3 张公共牌，从庄家左侧存活玩家开始行动。</li>
                  <li>转牌圈 (Turn)：发出第 4 张公共牌，进行第三轮下注。</li>
                  <li>河牌圈 (River)：发出第 5 张公共牌，最后一轮下注后进入摊牌。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-4">
                <h3 className="font-bold text-[#F3D778]">3. 全下 (All-In) 与边池机制</h3>
                <p className="mt-1 text-xs sm:text-sm text-stone-300">
                  当筹码不足以跟注或选择全下时，系统自动划分主池与边池。玩家最多只能赢得自己所投入筹码对应比例的底池；若出现平局，筹码平分，无法整除的余数筹码按顺时针从庄家左侧第一位赢家起分配。若所有剩余玩家仅剩一人有筹码可下注且其余玩家已全下，系统自动亮牌并发完剩余公共牌。
                </p>
              </div>
              <div className="rounded-xl border border-[#C9A24D]/20 bg-[#10201A] p-4">
                <h3 className="font-bold text-[#F3D778]">4. 最小加注与不足额全下规则</h3>
                <p className="mt-1 text-xs sm:text-sm text-stone-300">
                  每次加注的增量不得小于本轮大盲或前一次完整加注的增量。如果短筹码玩家全下但增量不足最小加注额，本轮已经行动过的玩家只能选择跟注差额或弃牌，不会重新开启加注轮。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
