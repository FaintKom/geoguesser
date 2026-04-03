import Peer, { DataConnection } from 'peerjs';
import type { HostMessage, PeerMessage } from '../types';

type MessageHandler = (msg: PeerMessage, connId: string) => void;
type HostMessageHandler = (msg: HostMessage) => void;
type ConnectionHandler = (connId: string) => void;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const PEER_PREFIX = 'geoguesser-';

export class HostPeerManager {
  peer: Peer | null = null;
  connections: Map<string, DataConnection> = new Map();
  roomCode = '';
  private onMessageHandler: MessageHandler | null = null;
  private onPlayerJoinHandler: ConnectionHandler | null = null;
  private onPlayerLeaveHandler: ConnectionHandler | null = null;

  async createRoom(): Promise<string> {
    // Retry up to 3 times with fresh room codes
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.tryCreateRoom();
      } catch {
        this.peer?.destroy();
        this.peer = null;
      }
    }
    throw new Error('Failed to create room after 3 attempts');
  }

  private tryCreateRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.roomCode = generateRoomCode();
      const peerId = PEER_PREFIX + this.roomCode;
      let settled = false;

      this.peer = new Peer(peerId);

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Connection timeout'));
        }
      }, 15000);

      this.peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        this.peer!.on('connection', (conn) => {
          conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.onPlayerJoinHandler?.(conn.peer);
          });

          conn.on('data', (data) => {
            this.onMessageHandler?.(data as PeerMessage, conn.peer);
          });

          conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.onPlayerLeaveHandler?.(conn.peer);
          });

          conn.on('error', () => {
            this.connections.delete(conn.peer);
            this.onPlayerLeaveHandler?.(conn.peer);
          });
        });

        resolve(this.roomCode);
      });

      this.peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  broadcast(message: HostMessage) {
    const data = JSON.parse(JSON.stringify(message));
    for (const conn of this.connections.values()) {
      conn.send(data);
    }
  }

  sendTo(connId: string, message: HostMessage) {
    const conn = this.connections.get(connId);
    conn?.send(JSON.parse(JSON.stringify(message)));
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
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

export class ClientPeerManager {
  peer: Peer | null = null;
  connection: DataConnection | null = null;
  private onMessageHandler: HostMessageHandler | null = null;
  private onDisconnectHandler: (() => void) | null = null;
  connId = '';

  async joinRoom(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      this.peer = new Peer();

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.error('[GeoGuesser] Join timeout after 20s');
          reject(new Error('Connection timeout'));
        }
      }, 20000);

      this.peer.on('open', (id) => {
        this.connId = id;
        console.log('[GeoGuesser] Peer open, connecting to host:', PEER_PREFIX + roomCode.toUpperCase());
        const hostId = PEER_PREFIX + roomCode.toUpperCase();
        const conn = this.peer!.connect(hostId, { reliable: true });

        conn.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.connection = conn;
          console.log('[GeoGuesser] Connected to host!');

          conn.on('data', (data) => {
            this.onMessageHandler?.(data as HostMessage);
          });

          conn.on('close', () => {
            this.onDisconnectHandler?.();
          });

          conn.on('error', () => {
            this.onDisconnectHandler?.();
          });

          resolve();
        });

        conn.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            console.error('[GeoGuesser] Connection error:', err);
            reject(err);
          }
        });
      });

      this.peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          console.error('[GeoGuesser] Peer error:', err.type, err.message);
          reject(err);
        }
      });
    });
  }

  send(message: PeerMessage) {
    this.connection?.send(JSON.parse(JSON.stringify(message)));
  }

  onMessage(handler: HostMessageHandler) {
    this.onMessageHandler = handler;
  }

  onDisconnect(handler: () => void) {
    this.onDisconnectHandler = handler;
  }

  destroy() {
    this.connection?.close();
    this.peer?.destroy();
    this.peer = null;
    this.connection = null;
  }
}
