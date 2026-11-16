import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './rooms.ts';

test('room creation, joining, and strict server-side hole-card redaction', () => {
  const manager = new RoomManager();
  const created = manager.createRoom({
    hostId: 'u1',
    hostName: '玩家一',
    config: { playerCount: 4, startingChips: 2000, smallBlind: 10, bigBlind: 20 },
  });

  assert.equal(created.code.length, 6);
  assert.equal(created.members.length, 1);

  const joined = manager.joinRoom({
    code: created.code,
    playerId: 'u2',
    playerName: '玩家二',
  });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.snapshot.members.length, 2);

  // Non-host cannot start
  const badStart = manager.startGame(created.code, 'u2');
  assert.equal(badStart.ok, false);

  // Host starts game
  const started = manager.startGame(created.code, 'u1');
  assert.equal(started.ok, true);

  const snapU1 = manager.getSnapshotForPlayer(created.code, 'u1')!;
  const snapU2 = manager.getSnapshotForPlayer(created.code, 'u2')!;

  assert.ok(snapU1.table);
  assert.ok(snapU2.table);
  assert.equal(snapU1.table.deck.length, 0); // Deck stripped

  // U1 sees own cards, U2's cards are redacted
  const u1Self = snapU1.table.players.find((p) => p.id === 'u1')!;
  const u1SeesU2 = snapU1.table.players.find((p) => p.id === 'u2')!;
  assert.equal(u1Self.holeCards.length, 2);
  assert.equal(u1SeesU2.holeCards.length, 0);
  assert.equal(u1SeesU2.hasHoleCards, true);

  // U2 sees own cards, U1's cards are redacted
  const u2Self = snapU2.table.players.find((p) => p.id === 'u2')!;
  const u2SeesU1 = snapU2.table.players.find((p) => p.id === 'u1')!;
  assert.equal(u2Self.holeCards.length, 2);
  assert.equal(u2SeesU1.holeCards.length, 0);
  assert.equal(u2SeesU1.hasHoleCards, true);

  // Acting player must be respected (out-of-turn action rejected)
  const actingIdx = snapU1.table.actingPlayerIndex!;
  const actingId = snapU1.table.players[actingIdx].id;
  const nonActingId = actingId === 'u1' ? 'u2' : 'u1';

  const badAction = manager.handleAction(created.code, nonActingId, { type: 'fold' });
  assert.equal(badAction.ok, false);

  const validAction = manager.handleAction(created.code, actingId, { type: 'fold' });
  assert.equal(validAction.ok, true);
});
