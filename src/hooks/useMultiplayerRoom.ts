import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConfig, PlayerAction } from '../poker/types.ts';
import type { RoomPublicSnapshot } from '../server/rooms.ts';

function getOrCreatePlayerId(): string {
  try {
    const existing = sessionStorage.getItem('poker_player_id');
    if (existing) return existing;
    const created = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem('poker_player_id', created);
    return created;
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function getSavedNickname(): string {
  try {
    return localStorage.getItem('poker_nickname') || '';
  } catch {
    return '';
  }
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem('poker_nickname', name.trim().slice(0, 14));
  } catch {
    // ignore
  }
}

export function useMultiplayerRoom() {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [snapshot, setSnapshot] = useState<RoomPublicSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomRef = useRef<{ code: string; playerName: string } | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const manualLeaveRef = useRef<boolean>(false);

  const closeSocket = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  const connectSocket = useCallback(
    (code: string, playerName: string) => {
      closeSocket();
      manualLeaveRef.current = false;
      activeRoomRef.current = { code: code.toUpperCase(), playerName };

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setError(null);
        ws.send(
          JSON.stringify({
            type: 'room:join',
            payload: {
              code: code.toUpperCase(),
              playerId,
              playerName,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room:state') {
            setSnapshot(msg.payload as RoomPublicSnapshot);
            setLoading(false);
          } else if (msg.type === 'room:error') {
            setError(msg.payload?.error || '房间操作失败');
            setLoading(false);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!manualLeaveRef.current && activeRoomRef.current) {
          reconnectTimerRef.current = window.setTimeout(() => {
            if (activeRoomRef.current && !manualLeaveRef.current) {
              connectSocket(activeRoomRef.current.code, activeRoomRef.current.playerName);
            }
          }, 1500);
        }
      };
    },
    [closeSocket, playerId]
  );

  useEffect(() => {
    return () => {
      manualLeaveRef.current = true;
      closeSocket();
    };
  }, [closeSocket]);

  const createRoom = useCallback(
    async (hostName: string, config: Partial<GameConfig>): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const cleanName = hostName.trim().slice(0, 14) || '房主';
      saveNickname(cleanName);
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId: playerId, hostName: cleanName, config }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || '创建房间失败');
          setLoading(false);
          return false;
        }
        setSnapshot(data.snapshot);
        connectSocket(data.snapshot.code, cleanName);
        return true;
      } catch {
        setError('网络错误，无法连接服务器');
        setLoading(false);
        return false;
      }
    },
    [connectSocket, playerId]
  );

  const joinRoom = useCallback(
    async (codeInput: string, playerName: string): Promise<boolean> => {
      const code = codeInput.trim().toUpperCase();
      if (code.length < 4) {
        setError('请输入有效的 6 位房间号');
        return false;
      }
      setLoading(true);
      setError(null);
      const cleanName = playerName.trim().slice(0, 14) || '玩家';
      saveNickname(cleanName);
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || '房间不存在');
          setLoading(false);
          return false;
        }
        connectSocket(code, cleanName);
        return true;
      } catch {
        setError('网络错误，无法加入房间');
        setLoading(false);
        return false;
      }
    },
    [connectSocket]
  );

  const sendWs = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const leaveRoom = useCallback(() => {
    manualLeaveRef.current = true;
    activeRoomRef.current = null;
    sendWs('room:leave');
    closeSocket();
    setSnapshot(null);
    setError(null);
  }, [closeSocket, sendWs]);

  return {
    playerId,
    snapshot,
    wsConnected,
    loading,
    error,
    clearError: () => setError(null),
    createRoom,
    joinRoom,
    addAI: () => sendWs('room:add_ai'),
    removeAI: (aiId: string) => sendWs('room:remove_ai', { aiId }),
    startGame: () => sendWs('room:start'),
    sendAction: (action: PlayerAction) => sendWs('game:action', { action }),
    nextHand: () => sendWs('game:next_hand'),
    sendChat: (text: string) => sendWs('room:chat', { text }),
    leaveRoom,
  };
}
