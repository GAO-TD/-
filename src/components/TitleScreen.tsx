import React, { useEffect, useState } from 'react';
import type { GameConfig } from '../poker/types.ts';

type ModeTab = 'solo' | 'create' | 'join';

interface TitleScreenProps {
  config: GameConfig;
  initialNickname: string;
  initialRoomCode?: string;
  roomError?: string | null;
  roomLoading?: boolean;
  onChangeConfig: (next: GameConfig) => void;
  onStartSolo: () => void;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
  onClearError?: () => void;
  onOpenRules: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  config,
  initialNickname,
  initialRoomCode = '',
  roomError = null,
  roomLoading = false,
  onChangeConfig,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onClearError,
  onOpenRules,
}) => {
  const [tab, setTab] = useState<ModeTab>(initialRoomCode ? 'join' : 'solo');
  const [nickname, setNickname] = useState(initialNickname || '德州玩家');
  const [roomCode, setRoomCode] = useState(initialRoomCode);

  useEffect(() => {
    if (initialRoomCode) {
      setTab('join');
      setRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  const playerOptions = [
    { value: 2, label: '2人 单挑' },
    { value: 4, label: '4人 精英桌' },
    { value: 6, label: '6人 标准桌' },
  ];

  const chipOptions = [
    { value: 1000, sb: 5, bb: 10, label: '1,000' },
    { value: 2000, sb: 10, bb: 20, label: '2,000' },
    { value: 5000, sb: 25, bb: 50, label: '5,000' },
  ];

  const switchTab = (next: ModeTab) => {
    setTab(next);
    onClearError?.();
  };

  return (
    <div
      data-testid="title-screen"
      className="fixed inset-0 z-30 flex flex-col items-center justify-between px-4 py-5 sm:px-8 sm:py-8 overflow-y-auto"
      style={{
        background:
          'radial-gradient(circle at 50% 42%, rgba(7, 16, 13, 0.94) 0%, rgba(7, 16, 13, 0.88) 55%, rgba(6, 13, 10, 0.82) 100%)',
      }}
    >
      <div className="hidden sm:block h-1" />

      <div className="my-auto flex w-full max-w-md flex-col items-center text-center">
        {/* Bespoke SVG Crest Emblem */}
        <svg
          viewBox="0 0 80 80"
          className="mb-2.5 h-14 w-14 sm:h-18 sm:w-18 drop-shadow-[0_6px_18px_rgba(229,193,88,0.3)]"
          aria-hidden="true"
        >
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="#0D1E17"
            stroke="#D4AF37"
            strokeWidth="2"
          />
          <circle
            cx="40"
            cy="40"
            r="30"
            fill="none"
            stroke="#D4AF37"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <path
            d="M40 18C32 29 21 36 21 46C21 52.5 26 57 32 57C35.2 57 37.8 55.6 39.4 53.6L36.5 62H43.5L40.6 53.6C42.2 55.6 44.8 57 48 57C54 57 59 52.5 59 46C59 36 48 29 40 18Z"
            fill="#E5C158"
          />
          <path d="M35 39L40 31L45 39L40 46L35 39Z" fill="#0D1E17" />
        </svg>

        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#F5F2EB] text-balance">
          皇家德州扑克
        </h1>
        <p className="mt-1 text-xs sm:text-sm tracking-[0.2em] text-[#C9A24D] font-medium">
          NO-LIMIT TEXAS HOLD&apos;EM
        </p>

        {/* Main Setup Card */}
        <div className="mt-5 w-full rounded-2xl border border-[#C9A24D]/30 bg-[#0B1713]/95 p-4 sm:p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
          {/* Mode Switcher */}
          <div
            role="tablist"
            aria-label="游戏模式选择"
            className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#08110E] p-1 border border-[#C9A24D]/20"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'solo'}
              data-testid="tab-solo"
              onClick={() => switchTab('solo')}
              className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'solo'
                  ? 'bg-[#E5C158] text-[#0A1410]'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              单人AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              data-testid="tab-create-room"
              onClick={() => switchTab('create')}
              className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'create'
                  ? 'bg-[#E5C158] text-[#0A1410]'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              创建房间
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'join'}
              data-testid="tab-join-room"
              onClick={() => switchTab('join')}
              className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'join'
                  ? 'bg-[#E5C158] text-[#0A1410]'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              加入房间
            </button>
          </div>

          {/* Nickname field for Multiplayer Create / Join */}
          {tab !== 'solo' && (
            <div className="mt-4">
              <label
                htmlFor="player-nickname-input"
                className="mb-1.5 block text-xs font-medium text-stone-300"
              >
                我的昵称
              </label>
              <input
                id="player-nickname-input"
                type="text"
                maxLength={14}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你在牌桌上的昵称"
                className="min-h-[44px] w-full rounded-xl border border-[#C9A24D]/30 bg-[#10201A] px-3 text-sm text-[#F5F2EB] placeholder:text-stone-500 focus:border-[#E5C158] focus:outline-none"
              />
            </div>
          )}

          {/* Join Room Code Field */}
          {tab === 'join' && (
            <div className="mt-3.5">
              <label
                htmlFor="room-code-input"
                className="mb-1.5 block text-xs font-medium text-stone-300"
              >
                6位房间号
              </label>
              <input
                id="room-code-input"
                type="text"
                maxLength={8}
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  onClearError?.();
                }}
                placeholder="例如：K7M9P2"
                className="min-h-[46px] w-full rounded-xl border border-[#C9A24D]/35 bg-[#10201A] px-3 font-mono-num text-base font-bold tracking-[0.2em] uppercase text-[#F3D778] placeholder:text-stone-500 placeholder:tracking-normal placeholder:font-normal focus:border-[#E5C158] focus:outline-none"
              />
            </div>
          )}

          {/* Table Rules Configuration for Solo & Create Room */}
          {tab !== 'join' && (
            <>
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-stone-300">
                  {tab === 'create' ? '房间人数上限' : '牌桌人数'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {playerOptions.map((opt) => {
                    const active = config.playerCount === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onChangeConfig({ ...config, playerCount: opt.value })
                        }
                        className={`min-h-[44px] rounded-xl border px-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'border-[#E5C158] bg-[#E5C158]/15 text-[#F3D778]'
                            : 'border-[#C9A24D]/20 bg-[#10201A] text-stone-300 hover:border-[#C9A24D]/45'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3.5">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-stone-300">
                  <span>初始筹码</span>
                  <span className="font-mono-num text-[#C9A24D]">
                    起始盲注 {config.smallBlind}/{config.bigBlind}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {chipOptions.map((opt) => {
                    const active = config.startingChips === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onChangeConfig({
                            ...config,
                            startingChips: opt.value,
                            smallBlind: opt.sb,
                            bigBlind: opt.bb,
                          })
                        }
                        className={`min-h-[44px] rounded-xl border px-2 text-xs sm:text-sm font-mono-num font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'border-[#E5C158] bg-[#E5C158]/15 text-[#F3D778]'
                            : 'border-[#C9A24D]/20 bg-[#10201A] text-stone-300 hover:border-[#C9A24D]/45'
                        }`}
                      >
                        ¥{opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3.5">
                <div className="mb-2 text-xs font-medium text-stone-300">盲注规则</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig({ ...config, blindEscalation: true })
                    }
                    className={`min-h-[44px] rounded-xl border px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      config.blindEscalation
                        ? 'border-[#E5C158] bg-[#E5C158]/15 text-[#F3D778]'
                        : 'border-[#C9A24D]/20 bg-[#10201A] text-stone-300 hover:border-[#C9A24D]/45'
                    }`}
                  >
                    每8手升盲
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig({ ...config, blindEscalation: false })
                    }
                    className={`min-h-[44px] rounded-xl border px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      !config.blindEscalation
                        ? 'border-[#E5C158] bg-[#E5C158]/15 text-[#F3D778]'
                        : 'border-[#C9A24D]/20 bg-[#10201A] text-stone-300 hover:border-[#C9A24D]/45'
                    }`}
                  >
                    固定盲注
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Error Feedback */}
          {roomError && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-red-500/45 bg-red-950/60 px-3 py-2 text-xs font-medium text-red-200"
            >
              {roomError}
            </div>
          )}

          {/* Primary Actions */}
          <div className="mt-5 flex flex-col gap-2.5">
            {tab === 'solo' && (
              <button
                type="button"
                data-start="true"
                onClick={onStartSolo}
                className="min-h-[48px] w-full rounded-xl bg-[#E5C158] text-[#0A1410] font-bold text-base hover:bg-[#F3D778] active:scale-[0.98] transition-all shadow-[0_6px_22px_rgba(229,193,88,0.3)] whitespace-nowrap cursor-pointer"
              >
                开始牌局
              </button>
            )}

            {tab === 'create' && (
              <button
                type="button"
                data-testid="create-room-submit"
                disabled={roomLoading || !nickname.trim()}
                onClick={() => onCreateRoom(nickname)}
                className="min-h-[48px] w-full rounded-xl bg-[#E5C158] text-[#0A1410] font-bold text-base hover:bg-[#F3D778] disabled:opacity-45 active:scale-[0.98] transition-all shadow-[0_6px_22px_rgba(229,193,88,0.3)] whitespace-nowrap cursor-pointer"
              >
                {roomLoading ? '正在创建房间...' : '创建联机房间'}
              </button>
            )}

            {tab === 'join' && (
              <button
                type="button"
                data-testid="join-room-submit"
                disabled={roomLoading || !nickname.trim() || !roomCode.trim()}
                onClick={() => onJoinRoom(roomCode, nickname)}
                className="min-h-[48px] w-full rounded-xl bg-[#E5C158] text-[#0A1410] font-bold text-base hover:bg-[#F3D778] disabled:opacity-45 active:scale-[0.98] transition-all shadow-[0_6px_22px_rgba(229,193,88,0.3)] whitespace-nowrap cursor-pointer"
              >
                {roomLoading ? '正在加入房间...' : '进入牌桌房间'}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenRules}
              className="min-h-[44px] w-full rounded-xl border border-[#C9A24D]/30 bg-[#10201A] text-sm font-medium text-[#F5F2EB] hover:border-[#E5C158]/60 transition-colors whitespace-nowrap cursor-pointer"
            >
              德州规则与牌型图解
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-stone-400">
        支持好友联机开房与手牌战报分享 · 手机竖屏单手触控优化
      </div>
    </div>
  );
};
