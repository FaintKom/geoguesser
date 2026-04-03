import { db } from './firebase-config';
import {
  ref, set, push, onValue, onChildAdded, onChildRemoved,
  remove, update, off, get,
} from 'firebase/database';
import type { HostMessage, PeerMessage } from '../types';

type MessageHandler = (msg: PeerMessage, playerId: string) => void;
type HostMessageHandler = (msg: HostMessage) => void;
type ConnectionHandler = (playerId: string) => void;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export class HostPeerManager {
  roomCode = '';
  playerId = '';
  private onMessageHandler: MessageHandler | null = null;
  private onPlayerJoinHandler: ConnectionHandler | null = null;
  private onPlayerLeaveHandler: ConnectionHandler | null = null;
  private cleanupFns: (() => void)[] = [];

  get peer() { return { id: this.playerId }; }
  get connections(): Map<string, boolean> {
    return this._playerIds;
  }
  private _playerIds = new Map<string, boolean>();

  async createRoom(): Promise<string> {
    this.playerId = generatePlayerId();

    // Try up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      this.roomCode = generateRoomCode();
      const roomRef = ref(db, `rooms/${this.roomCode}`);

      // Check if room exists
      const snapshot = await get(roomRef);
      if (snapshot.exists()) continue;

      // roomRef used below

      // Create room
      await set(roomRef, {
        hostId: this.playerId,
        createdAt: Date.now(),
        state: 'lobby',
      });

      const createdAt = Date.now();
      console.log('[GeoGuesser] Room created:', this.roomCode);

      // Listen for peer messages (only new ones)
      const messagesRef = ref(db, `rooms/${this.roomCode}/messages`);
      onChildAdded(messagesRef, (snap) => {
        const data = snap.val();
        if (data && data.from !== this.playerId && data.ts >= createdAt) {
          console.log('[GeoGuesser] Host got message:', data.type, 'from:', data.from);
          this.onMessageHandler?.(data as PeerMessage, data.from);
        }
        // Always clean up processed messages
        remove(snap.ref);
      });
      this.cleanupFns.push(() => off(messagesRef));

      // Listen for players joining/leaving
      const playersRef = ref(db, `rooms/${this.roomCode}/players`);
      onChildAdded(playersRef, (snap) => {
        const pid = snap.key!;
        if (pid !== this.playerId) {
          console.log('[GeoGuesser] Player joined:', pid);
          this._playerIds.set(pid, true);
          this.onPlayerJoinHandler?.(pid);
        }
      });

      onChildRemoved(playersRef, (snap) => {
        const pid = snap.key!;
        console.log('[GeoGuesser] Player left:', pid);
        this._playerIds.delete(pid);
        this.onPlayerLeaveHandler?.(pid);
      });

      this.cleanupFns.push(() => off(playersRef));

      // Add host as player
      await set(ref(db, `rooms/${this.roomCode}/players/${this.playerId}`), {
        joinedAt: Date.now(),
      });

      // Heartbeat to keep room alive
      const heartbeat = setInterval(() => {
        update(ref(db, `rooms/${this.roomCode}`), { lastActive: Date.now() });
      }, 10000);
      this.cleanupFns.push(() => clearInterval(heartbeat));

      return this.roomCode;
    }

    throw new Error('Failed to create room');
  }

  broadcast(message: HostMessage) {
    if (!this.roomCode) return;
    const broadcastRef = ref(db, `rooms/${this.roomCode}/broadcast`);
    push(broadcastRef, { ...message, ts: Date.now() });
  }

  async clearBroadcast() {
    if (!this.roomCode) return;
    await remove(ref(db, `rooms/${this.roomCode}/broadcast`));
  }

  sendTo(_connId: string, message: HostMessage) {
    // For simplicity, broadcast to all (peers filter by relevance)
    this.broadcast(message);
  }

  onMessage(handler: MessageHandler) {
    this.onMessageHandler = handler;
  }

  onPlayerJoin(handler: ConnectionHandler) {
    this.onPlayerJoinHandler = handler;
  }

  onPlayerLeave(handler: ConnectionHandler) {
    this.onPlayerLeaveHandler = handler;
  }

  destroy() {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    if (this.roomCode) {
      remove(ref(db, `rooms/${this.roomCode}`));
    }
    // cleaned up
    this._playerIds.clear();
  }
}

export class ClientPeerManager {
  connId = '';
  roomCode = '';
  private onMessageHandler: HostMessageHandler | null = null;
  private onDisconnectHandler: (() => void) | null = null;
  private cleanupFns: (() => void)[] = [];
  connection: boolean = false;

  async joinRoom(roomCode: string): Promise<void> {
    this.roomCode = roomCode.toUpperCase();
    this.connId = generatePlayerId();

    console.log('[GeoGuesser] Joining room:', this.roomCode);

    // Check room exists
    const roomRef = ref(db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      throw new Error('Комната не найдена');
    }

    // Add self as player
    await set(ref(db, `rooms/${this.roomCode}/players/${this.connId}`), {
      joinedAt: Date.now(),
    });

    this.connection = true;
    const joinedAt = Date.now();
    console.log('[GeoGuesser] Joined room:', this.roomCode);

    // Listen for broadcast messages from host (only new ones after join)
    const broadcastRef = ref(db, `rooms/${this.roomCode}/broadcast`);
    onChildAdded(broadcastRef, (snap) => {
      const data = snap.val();
      if (data && data.ts >= joinedAt) {
        console.log('[GeoGuesser] Client got broadcast:', data.type);
        this.onMessageHandler?.(data as HostMessage);
      }
    });
    this.cleanupFns.push(() => off(broadcastRef));

    // Watch for room deletion (host left)
    onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        console.log('[GeoGuesser] Room was deleted (host left)');
        this.onDisconnectHandler?.();
      }
    });
    this.cleanupFns.push(() => off(roomRef));

    // Heartbeat
    const heartbeat = setInterval(() => {
      update(ref(db, `rooms/${this.roomCode}/players/${this.connId}`), {
        lastActive: Date.now(),
      });
    }, 10000);
    this.cleanupFns.push(() => clearInterval(heartbeat));
  }

  send(message: PeerMessage) {
    if (!this.roomCode) return;
    const messagesRef = ref(db, `rooms/${this.roomCode}/messages`);
    push(messagesRef, { ...message, from: this.connId, ts: Date.now() });
  }

  onMessage(handler: HostMessageHandler) {
    this.onMessageHandler = handler;
  }

  onDisconnect(handler: () => void) {
    this.onDisconnectHandler = handler;
  }

  destroy() {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    if (this.roomCode && this.connId) {
      remove(ref(db, `rooms/${this.roomCode}/players/${this.connId}`));
    }
    this.connection = false;
  }
}
