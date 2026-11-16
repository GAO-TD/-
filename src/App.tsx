import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, History, MessageSquare, Pause, Volume2, VolumeX } from 'lucide-react';
import { ActionControls, PreActionChoice } from './components/ActionControls.tsx';
import { HistoryDrawer } from './components/HistoryDrawer.tsx';
import { PauseModal } from './components/PauseModal.tsx';
import { PokerTable } from './components/PokerTable.tsx';
import { RoomLobbyModal } from './components/RoomLobbyModal.tsx';
import { RulesModal } from './components/RulesModal.tsx';
import { ShareHandModal } from './components/ShareHandModal.tsx';
import { TableChatDrawer } from './components/TableChatDrawer.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { getSavedNickname, useMultiplayerRoom } from './hooks/useMultiplayerRoom.ts';
import { chooseAIAction } from './poker/ai.ts';
import {
  advanceRunoutStreet,
  applyAction,
  createDefaultConfig,
  createInitialTable,
  getLegalActions,
  getTotalPotAmount,
  startNewHand,
} from './poker/engine.ts';
import { decodeSharedHand, handLogToSharedPayload } from './poker/share.ts';
import type { SharedHandPayload } from './poker/share.ts';
import type { GameConfig, GameTableState, HandLogEntry, PlayerAction } from './poker/types.ts';
import { soundEngine } from './utils/sound.ts';

type AppPhase = 'title' | 'playing' | 'paused' | 'gameover';

function buildSharePayloadFromCompletedTable(
  state: GameTableState,
  viewerId: string
): SharedHandPayload {
  const viewer = state.players.find((p) => p.id === viewerId) ?? state.players[0];
  let viewerWon = 0;
  for (const payout of state.payouts) {
    const idx = payout.winnerIds.indexOf(viewer.id);
    if (idx !== -1) {
      viewerWon += payout.amountPerWinner + (idx < payout.oddChips ? 1 : 0);
    }
  }
  const latestEntry = state.history[0];
  return {
    handNumber: state.handNumber,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    potTotal: latestEntry?.potTotal ?? getTotalPotAmount(state),
    heroNet: viewerId === 'hero' && latestEntry ? latestEntry.heroNet : viewerWon - viewer.totalContributed,
    winningSummary: latestEntry?.winningSummary ?? state.actionMessage,
    heroHoleCards: viewer.holeCards.map((c) => ({ ...c })),
    communityCards: state.communityCards.map((c) => ({ ...c })),
    playerCount: state.players.filter((p) => p.status !== 'out').length,
    sharedBy: viewer.isHuman && viewer.name !== '你' ? viewer.name : undefined,
  };
}

export default function App() {
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const initialAutostart = urlParams.get('autostart') === '1';
  const initialRoomCode = (urlParams.get('room') || '').toUpperCase();
  const initialHandToken = urlParams.get('hand') || '';

  const [config, setConfig] = useState<GameConfig>(() =>
    createDefaultConfig({ playerCount: 6, startingChips: 2000 })
  );
  const [phase, setPhase] = useState<AppPhase>(
    initialAutostart ? 'playing' : 'title'
  );
  const [soloState, setSoloState] = useState<GameTableState>(() =>
    createInitialTable(createDefaultConfig({ playerCount: 6, startingChips: 2000 }))
  );

  const mp = useMultiplayerRoom();
  const isMultiplayer = mp.snapshot !== null;
  const activeState = mp.snapshot?.table ?? soloState;
  const activeHeroId = isMultiplayer ? mp.playerId : 'hero';
  const isRoomHost = mp.snapshot ? mp.snapshot.hostId === mp.playerId : true;

  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [fourColor, setFourColor] = useState<boolean>(false);
  const [fastMode, setFastMode] = useState<boolean>(false);
  const [preAction, setPreAction] = useState<PreActionChoice>('none');

  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [shareTarget, setShareTarget] = useState<{
    payload: SharedHandPayload;
    incoming: boolean;
  } | null>(() => {
    if (!initialHandToken) return null;
    const decoded = decodeSharedHand(initialHandToken);
    return decoded ? { payload: decoded, incoming: true } : null;
  });

  // Live countdown seconds for multiplayer turns
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    const deadline = mp.snapshot?.turnDeadline ?? null;
    if (!deadline) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTurnSecondsLeft(diff);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [mp.snapshot?.turnDeadline]);

  // Enter playing phase automatically when multiplayer room starts
  useEffect(() => {
    if (mp.snapshot?.status === 'playing' && phase === 'title') {
      setPhase('playing');
    }
  }, [mp.snapshot?.status, phase]);

  // Keep body[data-state] synced immediately for state observability
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Sync gameover state when match completes
  useEffect(() => {
    if (phase === 'playing' && activeState.isMatchOver) {
      setPhase('gameover');
    } else if (phase === 'gameover' && !activeState.isMatchOver) {
      setPhase('playing');
    }
  }, [phase, activeState.isMatchOver]);

  const playSoundForAction = useCallback((action: PlayerAction, nextState: GameTableState) => {
    if (action.type === 'fold') {
      soundEngine.playFold();
    } else if (action.type === 'check') {
      soundEngine.playCheck();
    } else if (action.type === 'allin') {
      soundEngine.playAllIn();
    } else {
      soundEngine.playChip();
    }
    if (nextState.isHandComplete) {
      setTimeout(() => soundEngine.playWin(), 120);
    }
  }, []);

  // Sound cues on multiplayer table updates
  const prevHandRef = useRef<number>(activeState.handNumber);
  const prevCompleteRef = useRef<boolean>(activeState.isHandComplete);
  useEffect(() => {
    if (!isMultiplayer) return;
    if (activeState.handNumber !== prevHandRef.current) {
      soundEngine.playDeal();
      setPreAction('none');
    } else if (activeState.isHandComplete && !prevCompleteRef.current) {
      soundEngine.playWin();
    }
    prevHandRef.current = activeState.handNumber;
    prevCompleteRef.current = activeState.isHandComplete;
  }, [isMultiplayer, activeState.handNumber, activeState.isHandComplete]);

  const handleStartSolo = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const fresh = createInitialTable(config);
    setSoloState(fresh);
    setPreAction('none');
    setPhase('playing');
    document.body.dataset.state = 'playing';
    soundEngine.playDeal();
  }, [config]);

  const handleCreateRoom = useCallback(
    async (nickname: string) => {
      await mp.createRoom(nickname, config);
    },
    [mp, config]
  );

  const handleJoinRoom = useCallback(
    async (code: string, nickname: string) => {
      await mp.joinRoom(code, nickname);
    },
    [mp]
  );

  const handlePlayerAction = useCallback(
    (action: PlayerAction) => {
      setPreAction('none');
      if (isMultiplayer) {
        if (action.type === 'fold') soundEngine.playFold();
        else if (action.type === 'check') soundEngine.playCheck();
        else if (action.type === 'allin') soundEngine.playAllIn();
        else soundEngine.playChip();
        mp.sendAction(action);
        return;
      }

      setSoloState((prev) => {
        if (prev.actingPlayerIndex !== 0 || prev.isHandComplete) return prev;
        const next = applyAction(prev, 0, action);
        playSoundForAction(action, next);
        return next;
      });
    },
    [isMultiplayer, mp, playSoundForAction]
  );

  const handleNextHand = useCallback(() => {
    setPreAction('none');
    if (isMultiplayer) {
      mp.nextHand();
      return;
    }
    setSoloState((prev) => {
      const next = startNewHand(prev);
      soundEngine.playDeal();
      return next;
    });
    if (phase === 'gameover') {
      setPhase('playing');
    }
  }, [isMultiplayer, mp, phase]);

  const handleRestartMatch = useCallback(() => {
    if (isMultiplayer) {
      mp.nextHand();
      return;
    }
    const fresh = createInitialTable(config);
    setSoloState(fresh);
    setPreAction('none');
    setPhase('playing');
    document.body.dataset.state = 'playing';
    soundEngine.playDeal();
  }, [config, isMultiplayer, mp]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleOpenShareLatest = useCallback(() => {
    const payload = buildSharePayloadFromCompletedTable(activeState, activeHeroId);
    setShareTarget({ payload, incoming: false });
  }, [activeState, activeHeroId]);

  const handleOpenShareFromHistory = useCallback(
    (entry: HandLogEntry) => {
      const me = activeState.players.find((p) => p.id === activeHeroId);
      const payload = handLogToSharedPayload(
        entry,
        me && me.name !== '你' ? me.name : undefined
      );
      setHistoryOpen(false);
      setShareTarget({ payload, incoming: false });
    },
    [activeState.players, activeHeroId]
  );

  // Solo Mode AI Turn & Pre-Action & All-In Runout Loop
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isMultiplayer) {
      // Handle pre-action in multiplayer when it becomes our turn
      const heroIdx = activeState.players.findIndex((p) => p.id === activeHeroId);
      if (
        phase === 'playing' &&
        !activeState.isHandComplete &&
        !activeState.isAllInRunout &&
        heroIdx !== -1 &&
        activeState.actingPlayerIndex === heroIdx &&
        preAction !== 'none'
      ) {
        const legal = getLegalActions(activeState, heroIdx);
        timerRef.current = window.setTimeout(() => {
          if (preAction === 'check_fold') {
            handlePlayerAction(legal.canCheck ? { type: 'check' } : { type: 'fold' });
          } else if (preAction === 'auto_check') {
            if (legal.canCheck) handlePlayerAction({ type: 'check' });
            else setPreAction('none');
          }
        }, 150);
      }
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }

    if (phase !== 'playing' || soloState.isHandComplete || rulesOpen || historyOpen || shareTarget) {
      return;
    }

    if (soloState.isAllInRunout) {
      const delay = fastMode ? 350 : 750;
      timerRef.current = window.setTimeout(() => {
        setSoloState((prev) => {
          if (!prev.isAllInRunout || prev.isHandComplete) return prev;
          const next = advanceRunoutStreet(prev);
          if (next.isHandComplete) {
            soundEngine.playWin();
          } else {
            soundEngine.playDeal();
          }
          return next;
        });
      }, delay);
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }

    const actorIdx = soloState.actingPlayerIndex;
    if (actorIdx === null) return;

    const actor = soloState.players[actorIdx];
    if (!actor) return;

    if (actor.isHuman && preAction !== 'none') {
      const legal = getLegalActions(soloState, 0);
      timerRef.current = window.setTimeout(() => {
        if (preAction === 'check_fold') {
          const chosen: PlayerAction = legal.canCheck ? { type: 'check' } : { type: 'fold' };
          handlePlayerAction(chosen);
        } else if (preAction === 'auto_check') {
          if (legal.canCheck) {
            handlePlayerAction({ type: 'check' });
          } else {
            setPreAction('none');
          }
        }
      }, 150);
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }

    if (!actor.isHuman) {
      const delay = fastMode ? 240 : 580;
      timerRef.current = window.setTimeout(() => {
        setSoloState((prev) => {
          if (
            prev.isHandComplete ||
            prev.isAllInRunout ||
            prev.actingPlayerIndex !== actorIdx
          ) {
            return prev;
          }
          const aiMove = chooseAIAction(prev, actorIdx);
          const next = applyAction(prev, actorIdx, aiMove);
          playSoundForAction(aiMove, next);
          return next;
        });
      }, delay);
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }
  }, [
    isMultiplayer,
    activeState,
    activeHeroId,
    phase,
    soloState,
    fastMode,
    preAction,
    rulesOpen,
    historyOpen,
    shareTarget,
    handlePlayerAction,
    playSoundForAction,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (phase === 'title' && !isMultiplayer && !rulesOpen && !shareTarget) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartSolo();
        }
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (shareTarget) {
          setShareTarget(null);
          return;
        }
        if (chatOpen) {
          setChatOpen(false);
          return;
        }
        if (rulesOpen) {
          setRulesOpen(false);
          return;
        }
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        if (phase === 'playing') {
          setPhase('paused');
        } else if (phase === 'paused') {
          setPhase('playing');
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        handleToggleMute();
        return;
      }

      if (phase === 'playing' && !rulesOpen && !historyOpen && !chatOpen && !shareTarget) {
        if (activeState.isHandComplete && !activeState.isMatchOver) {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleNextHand();
          }
          return;
        }

        const heroIdx = activeState.players.findIndex((p) => p.id === activeHeroId);
        if (heroIdx !== -1 && activeState.actingPlayerIndex === heroIdx && !activeState.isHandComplete) {
          const legal = getLegalActions(activeState, heroIdx);
          if (e.key.toLowerCase() === 'f' && legal.canFold) {
            handlePlayerAction({ type: 'fold' });
          } else if (e.key.toLowerCase() === 'c') {
            if (legal.canCheck) handlePlayerAction({ type: 'check' });
            else if (legal.canCall) handlePlayerAction({ type: 'call' });
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    isMultiplayer,
    rulesOpen,
    historyOpen,
    chatOpen,
    shareTarget,
    activeState,
    activeHeroId,
    handleStartSolo,
    handleNextHand,
    handlePlayerAction,
    handleToggleMute,
  ]);

  const showTitleScreen = phase === 'title' && !mp.snapshot;
  const showRoomLobby = mp.snapshot?.status === 'lobby';

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#08110E] text-[#F5F2EB]">
      {/* Compact Game HUD Header */}
      <header className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-[#C9A24D]/15 bg-[#09130F]/95 px-2.5 pt-safe pb-2 sm:px-6">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <span className="font-display text-sm sm:text-base font-bold text-[#F3D778] whitespace-nowrap shrink-0">
            皇家德州
          </span>
          <span className="text-stone-600 shrink-0" aria-hidden="true">·</span>
          <span className="font-mono-num text-[11px] sm:text-sm text-stone-300 whitespace-nowrap truncate min-w-0">
            {isMultiplayer && mp.snapshot ? `${mp.snapshot.code} · ` : ''}
            <span className={isMultiplayer ? 'hidden sm:inline' : ''}>第{activeState.handNumber}手 · </span>
            <span className="hidden sm:inline">盲注 </span>
            {activeState.smallBlind}/{activeState.bigBlind}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isMultiplayer && (
            <button
              type="button"
              aria-label="牌桌聊天"
              onClick={() => setChatOpen(true)}
              className="flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/25 bg-[#10201A] px-2 sm:px-2.5 text-xs font-medium text-stone-200 hover:border-[#E5C158] cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-[#E5C158]" />
              <span className="hidden sm:inline">聊天</span>
            </button>
          )}

          <button
            type="button"
            aria-label="规则与牌型"
            onClick={() => setRulesOpen(true)}
            className="flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/25 bg-[#10201A] px-2 sm:px-2.5 text-xs font-medium text-stone-200 hover:border-[#E5C158] cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-[#E5C158]" />
            <span className="hidden sm:inline">牌型规则</span>
          </button>

          <button
            type="button"
            aria-label="牌局记录"
            onClick={() => setHistoryOpen(true)}
            className="flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/25 bg-[#10201A] px-2 sm:px-2.5 text-xs font-medium text-stone-200 hover:border-[#E5C158] cursor-pointer"
          >
            <History className="h-4 w-4 text-[#E5C158]" />
            <span className="hidden sm:inline">记录</span>
          </button>

          <button
            type="button"
            aria-label={muted ? '开启音效' : '静音'}
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleMute();
            }}
            className="flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-lg border border-[#C9A24D]/25 bg-[#10201A] text-stone-200 hover:border-[#E5C158] cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-stone-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-[#E5C158]" />
            )}
          </button>

          <button
            type="button"
            aria-label="暂停与设置"
            onClick={(e) => {
              e.currentTarget.blur();
              setPhase('paused');
            }}
            className="flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-lg border border-[#C9A24D]/25 bg-[#10201A] text-stone-200 hover:border-[#E5C158] cursor-pointer"
          >
            <Pause className="h-4 w-4 text-[#E5C158]" />
          </button>
        </div>
      </header>

      {/* Main Felt Poker Table */}
      <PokerTable
        state={activeState}
        heroId={activeHeroId}
        fourColor={fourColor}
        isPreview={showTitleScreen || showRoomLobby}
      />

      {/* Bottom Thumb-Zone Hero Cards & Action Controls */}
      <ActionControls
        state={activeState}
        heroId={activeHeroId}
        fourColor={fourColor}
        isMultiplayer={isMultiplayer}
        isRoomHost={isRoomHost}
        turnSecondsLeft={isMultiplayer ? turnSecondsLeft : null}
        preAction={preAction}
        onSetPreAction={setPreAction}
        onAction={handlePlayerAction}
        onNextHand={handleNextHand}
        onRestartMatch={handleRestartMatch}
        onShareLatestHand={handleOpenShareLatest}
      />

      {/* Title Screen Overlay */}
      {showTitleScreen && (
        <TitleScreen
          config={config}
          initialNickname={getSavedNickname()}
          initialRoomCode={initialRoomCode}
          roomError={mp.error}
          roomLoading={mp.loading}
          onChangeConfig={(nextCfg) => {
            setConfig(nextCfg);
            setSoloState(createInitialTable(nextCfg));
          }}
          onStartSolo={handleStartSolo}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onClearError={mp.clearError}
          onOpenRules={() => setRulesOpen(true)}
        />
      )}

      {/* Multiplayer Waiting Room Lobby */}
      {showRoomLobby && mp.snapshot && (
        <RoomLobbyModal
          snapshot={mp.snapshot}
          playerId={mp.playerId}
          wsConnected={mp.wsConnected}
          onAddAI={mp.addAI}
          onRemoveAI={mp.removeAI}
          onStartGame={mp.startGame}
          onLeave={() => {
            mp.leaveRoom();
            setPhase('title');
          }}
        />
      )}

      {/* Modals */}
      <RulesModal
        open={rulesOpen}
        fourColor={fourColor}
        onClose={() => setRulesOpen(false)}
      />

      <HistoryDrawer
        open={historyOpen}
        history={activeState.history}
        fourColor={fourColor}
        onShareHand={handleOpenShareFromHistory}
        onClose={() => setHistoryOpen(false)}
      />

      <ShareHandModal
        hand={shareTarget?.payload ?? null}
        fourColor={fourColor}
        isIncomingShare={shareTarget?.incoming ?? false}
        onClose={() => setShareTarget(null)}
      />

      {isMultiplayer && mp.snapshot && (
        <TableChatDrawer
          open={chatOpen}
          messages={mp.snapshot.chat}
          onSend={mp.sendChat}
          onClose={() => setChatOpen(false)}
        />
      )}

      <PauseModal
        open={phase === 'paused'}
        muted={muted}
        fourColor={fourColor}
        fastMode={fastMode}
        isMultiplayer={isMultiplayer}
        onToggleMute={handleToggleMute}
        onToggleFourColor={() => setFourColor((v) => !v)}
        onToggleFastMode={() => setFastMode((v) => !v)}
        onResume={() => setPhase('playing')}
        onRestart={handleRestartMatch}
        onBackToTitle={() => {
          if (isMultiplayer) {
            mp.leaveRoom();
          } else {
            setSoloState(createInitialTable(config));
          }
          setPhase('title');
        }}
      />
    </main>
  );
}
