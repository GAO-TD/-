import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { RoomChatMessage } from '../server/rooms.ts';

interface TableChatDrawerProps {
  open: boolean;
  messages: RoomChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

const QUICK_PHRASES = [
  '大家好！',
  '打得漂亮',
  'All-In！',
  '请快点下注',
  '谢谢老板',
  '手气不错',
];

export const TableChatDrawer: React.FC<TableChatDrawerProps> = ({
  open,
  messages,
  onSend,
  onClose,
}) => {
  const [draft, setDraft] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="牌桌聊天"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl border border-[#C9A24D]/35 bg-[#0C1914] text-[#F5F2EB] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#C9A24D]/20 px-4 py-3">
          <h2 className="font-display text-base font-bold text-[#F3D778]">
            牌桌互动聊天
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-[#C9A24D]/25 px-3 text-xs text-stone-300 hover:border-[#E5C158] cursor-pointer"
          >
            关闭
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[180px]">
          {messages.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              暂无消息，发送一句快捷短语和牌友打个招呼吧。
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl bg-[#10201A] border border-[#C9A24D]/15 px-3 py-2 text-xs sm:text-sm"
              >
                <span className="font-semibold text-[#E5C158]">{m.senderName}：</span>
                <span className="text-stone-100 break-words">{m.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Quick Phrases */}
        <div className="flex flex-wrap gap-1.5 border-t border-[#C9A24D]/15 bg-[#09130F] px-3 py-2">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => onSend(phrase)}
              className="min-h-[34px] rounded-lg border border-[#C9A24D]/25 bg-[#10201A] px-2.5 text-xs text-stone-200 hover:border-[#E5C158] cursor-pointer whitespace-nowrap"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-[#C9A24D]/20 p-3 pb-safe"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={80}
            placeholder="输入聊天内容..."
            className="min-h-[44px] flex-1 rounded-xl border border-[#C9A24D]/30 bg-[#10201A] px-3 text-sm text-[#F5F2EB] placeholder:text-stone-500 focus:border-[#E5C158] focus:outline-none"
          />
          <button
            type="submit"
            aria-label="发送消息"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#E5C158] text-[#0A1410] hover:bg-[#F3D778] cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
