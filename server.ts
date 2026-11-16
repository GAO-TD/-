import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './src/server/rooms.ts';
import type { GameConfig, PlayerAction } from './src/poker/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface ClientConn {
  ws: WebSocket;
  playerId: string | null;
  roomCode: string | null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const connections = new Set<ClientConn>();

  const broadcastRoom = (roomCode: string) => {
    for (const conn of connections) {
      if (conn.roomCode === roomCode && conn.playerId && conn.ws.readyState === WebSocket.OPEN) {
        const snapshot = roomManager.getSnapshotForPlayer(roomCode, conn.playerId);
        if (snapshot) {
          conn.ws.send(JSON.stringify({ type: 'room:state', payload: snapshot }));
        }
      }
    }
  };

  const roomManager = new RoomManager(broadcastRoom);

  // REST API for room creation and inspection
  app.post('/api/rooms', (req, res) => {
    const body = req.body as {
      hostId?: string;
      hostName?: string;
      config?: Partial<GameConfig>;
    };
    const hostId = body.hostId || `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const hostName = body.hostName || '房主';
    const snapshot = roomManager.createRoom({
      hostId,
      hostName,
      config: body.config,
    });
    res.json({ ok: true, playerId: hostId, snapshot });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const info = roomManager.getRoomInfo(req.params.code);
    if (!info) {
      res.status(404).json({ ok: false, error: '房间不存在或已关闭' });
      return;
    }
    res.json({ ok: true, room: info });
  });

  // Mount Vite middleware in dev or serve dist/ in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    const conn: ClientConn = { ws, playerId: null, roomCode: null };
    connections.add(conn);

    const sendError = (error: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room:error', payload: { error } }));
      }
    };

    ws.on('message', (raw) => {
      let msg: { type?: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const type = msg.type;
      const payload = msg.payload ?? {};

      if (type === 'room:join') {
        const code = String(payload.code ?? '').trim().toUpperCase();
        const playerId = String(payload.playerId ?? '');
        const playerName = String(payload.playerName ?? '玩家');
        if (!code || !playerId) {
          sendError('缺少房间号或玩家信息');
          return;
        }
        const result = roomManager.joinRoom({ code, playerId, playerName });
        if (!result.ok) {
          sendError(result.error);
          return;
        }
        conn.playerId = playerId;
        conn.roomCode = result.snapshot.code;
        ws.send(JSON.stringify({ type: 'room:state', payload: result.snapshot }));
        return;
      }

      if (!conn.roomCode || !conn.playerId) {
        sendError('请先加入房间');
        return;
      }

      if (type === 'room:add_ai') {
        const res = roomManager.addAI(conn.roomCode, conn.playerId);
        if (!res.ok && res.error) sendError(res.error);
      } else if (type === 'room:remove_ai') {
        const aiId = String(payload.aiId ?? '');
        const res = roomManager.removeAI(conn.roomCode, conn.playerId, aiId);
        if (!res.ok && res.error) sendError(res.error);
      } else if (type === 'room:start') {
        const res = roomManager.startGame(conn.roomCode, conn.playerId);
        if (!res.ok && res.error) sendError(res.error);
      } else if (type === 'game:action') {
        const action = payload.action as PlayerAction;
        if (!action || !action.type) return;
        const res = roomManager.handleAction(conn.roomCode, conn.playerId, action);
        if (!res.ok && res.error) sendError(res.error);
      } else if (type === 'game:next_hand') {
        const res = roomManager.nextHand(conn.roomCode, conn.playerId);
        if (!res.ok && res.error) sendError(res.error);
      } else if (type === 'room:chat') {
        const text = String(payload.text ?? '');
        roomManager.addChatMessage(conn.roomCode, conn.playerId, text);
      } else if (type === 'room:leave') {
        roomManager.leaveRoom(conn.roomCode, conn.playerId);
        conn.roomCode = null;
      }
    });

    ws.on('close', () => {
      connections.delete(conn);
      if (conn.roomCode && conn.playerId) {
        roomManager.setPlayerDisconnected(conn.roomCode, conn.playerId);
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Texas Hold'em server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
