import type {
  GameState, GameSettings, Player, Location, Guess, LeaderboardEntry, RoundScore,
  HostMessage, PeerMessage,
} from '../types';
import { HostPeerManager, ClientPeerManager } from './peer-manager';
import { pickRandomLocations } from './location-picker';
import { haversineDistance, calculateScore } from './scoring';
import { DEFAULT_SETTINGS } from '../config';

type StateChangeHandler = (state: GameState) => void;
type UIUpdateHandler = (event: UIEvent) => void;

export type UIEvent =
  | { type: 'players_updated'; players: Player[] }
  | { type: 'round_start'; round: number; totalRounds: number; imageId: string }
  | { type: 'timer_update'; remaining: number }
  | { type: 'player_guessed'; playerId: string }
  | { type: 'player_ready'; playerId: string }
  | { type: 'all_ready' }
  | { type: 'round_end'; round: number; correctLat: number; correctLng: number; guesses: Guess[] }
  | { type: 'game_end'; leaderboard: LeaderboardEntry[] }
  | { type: 'error'; message: string }
  | { type: 'room_created'; roomCode: string }
  | { type: 'joined_room' };

export class GameEngine {
  state: GameState = 'idle';
  isHost = false;
  hostPeer: HostPeerManager | null = null;
  clientPeer: ClientPeerManager | null = null;

  players: Player[] = [];
  settings: GameSettings = { ...DEFAULT_SETTINGS };
  hostPlayerId = '';
  localPlayerId = '';
  localPlayerName = '';

  // Round state (public for UI reads)
  currentRound = 0;
  currentImageId = '';
  private locations: Location[] = [];
  private roundGuesses: RoundScore = {};
  private readyPlayers = new Set<string>();
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private timeRemaining = 0;
  private timerStarted = false;
  private totalScores: Record<string, number> = {};

  private stateChangeHandlers: StateChangeHandler[] = [];
  private uiHandlers: UIUpdateHandler[] = [];

  onStateChanged(handler: StateChangeHandler) { this.stateChangeHandlers.push(handler); }
  onUI(handler: UIUpdateHandler) { this.uiHandlers.push(handler); }
  offUI(handler: UIUpdateHandler) { this.uiHandlers = this.uiHandlers.filter(h => h !== handler); }

  private emit(event: UIEvent) { for (const h of this.uiHandlers) h(event); }
  private setState(s: GameState) {
    this.state = s;
    for (const h of this.stateChangeHandlers) h(s);
  }

  // === Session persistence ===
  private saveSession() {
    const roomCode = this.isHost ? this.hostPeer?.roomCode : this.clientPeer?.roomCode;
    const session = {
      roomCode: roomCode || '',
      playerName: this.localPlayerName,
      isHost: this.isHost,
    };
    localStorage.setItem('geoguesser_session', JSON.stringify(session));
  }

  private clearSession() {
    localStorage.removeItem('geoguesser_session');
  }

  clearSessionPublic() {
    this.clearSession();
  }

  static getSavedSession(): { roomCode: string; playerName: string; isHost: boolean } | null {
    try {
      const data = localStorage.getItem('geoguesser_session');
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // === HOST: Create Room ===
  async createRoom(playerName: string) {
    this.isHost = true;
    this.localPlayerName = playerName;
    this.hostPeer = new HostPeerManager();

    try {
      console.log('[GeoGuesser] Creating room...');
      const roomCode = await this.hostPeer.createRoom();
      this.hostPlayerId = this.hostPeer.peer!.id;
      this.localPlayerId = this.hostPlayerId;
      console.log('[GeoGuesser] Room created:', roomCode, 'PeerID:', this.hostPlayerId);

      // Host is a player too
      this.players = [{ id: this.hostPlayerId, name: playerName, isHost: true }];
      this.emit({ type: 'room_created', roomCode });
      this.emit({ type: 'players_updated', players: this.players });

      this.hostPeer.onMessage((msg, connId) => {
        console.log('[GeoGuesser] Host got message:', msg.type, 'from:', connId);
        this.handlePeerMessage(msg, connId);
      });
      this.hostPeer.onPlayerJoin((connId) => {
        console.log('[GeoGuesser] Player connection opened:', connId);
      });
      this.hostPeer.onPlayerLeave((connId) => {
        console.log('[GeoGuesser] Player left:', connId);
        this.handlePlayerLeave(connId);
      });

      this.setState('lobby');
      this.saveSession();
    } catch (err) {
      console.error('[GeoGuesser] Failed to create room:', err);
      this.emit({ type: 'error', message: 'Не удалось создать комнату. Попробуй ещё раз.' });
    }
  }

  // === CLIENT: Join Room ===
  async joinRoom(roomCode: string, playerName: string) {
    this.isHost = false;
    this.localPlayerName = playerName;
    this.clientPeer = new ClientPeerManager();

    try {
      console.log('[GeoGuesser] Joining room:', roomCode);
      await this.clientPeer.joinRoom(roomCode);
      this.localPlayerId = this.clientPeer.connId;
      console.log('[GeoGuesser] Joined! Sending JOIN message...');

      this.clientPeer.send({ type: 'JOIN', name: playerName });

      this.clientPeer.onMessage((msg) => {
        console.log('[GeoGuesser] Client got message:', msg.type);
        this.handleHostMessage(msg);
      });
      this.clientPeer.onDisconnect(() => {
        console.log('[GeoGuesser] Disconnected from host');
        this.emit({ type: 'error', message: 'Хост отключился' });
        this.setState('idle');
      });

      this.emit({ type: 'joined_room' });
      this.setState('lobby');
      this.saveSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GeoGuesser] Failed to join:', msg);
      this.clearSession();
      this.emit({ type: 'error', message: `Не удалось подключиться: ${msg}` });
    }
  }

  // === HOST: Handle messages from peers ===
  private handlePeerMessage(msg: PeerMessage, connId: string) {
    if (!this.isHost) return;

    switch (msg.type) {
      case 'JOIN': {
        const player: Player = { id: connId, name: msg.name, isHost: false };
        this.players.push(player);
        this.emit({ type: 'players_updated', players: this.players });
        this.hostPeer!.broadcast({ type: 'LOBBY_UPDATE', players: this.players });
        break;
      }
      case 'GUESS': {
        if (this.state !== 'playing') return;
        this.registerGuess(connId, msg.lat, msg.lng);
        break;
      }
      case 'READY': {
        if (this.state !== 'playing') return;
        this.registerReady(connId);
        break;
      }
    }
  }

  private handlePlayerLeave(connId: string) {
    this.players = this.players.filter(p => p.id !== connId);
    this.readyPlayers.delete(connId);
    this.emit({ type: 'players_updated', players: this.players });
    this.hostPeer?.broadcast({ type: 'LOBBY_UPDATE', players: this.players });

    if (this.state === 'playing') {
      this.checkAllGuessed();
    }
  }

  // === CLIENT: Handle messages from host ===
  private handleHostMessage(msg: HostMessage) {
    switch (msg.type) {
      case 'LOBBY_UPDATE':
        this.players = msg.players;
        this.emit({ type: 'players_updated', players: this.players });
        break;

      case 'GAME_START':
        this.settings = msg.settings;
        break;

      case 'ROUND_START':
        this.currentRound = msg.round;
        this.currentImageId = msg.imageId;
        this.setState('playing');
        this.emit({ type: 'round_start', round: msg.round, totalRounds: msg.totalRounds, imageId: msg.imageId });
        break;

      case 'TIMER_SYNC':
        this.timeRemaining = msg.remaining;
        this.emit({ type: 'timer_update', remaining: msg.remaining });
        break;

      case 'PLAYER_GUESSED':
        this.emit({ type: 'player_guessed', playerId: msg.playerId });
        break;

      case 'PLAYER_READY':
        this.readyPlayers.add(msg.playerId);
        this.emit({ type: 'player_ready', playerId: msg.playerId });
        break;

      case 'ALL_READY':
        this.emit({ type: 'all_ready' });
        break;

      case 'ROUND_END':
        this.setState('round_result');
        this.emit({
          type: 'round_end',
          round: msg.round,
          correctLat: msg.correctLat,
          correctLng: msg.correctLng,
          guesses: msg.guesses,
        });
        break;

      case 'GAME_END':
        this.setState('game_over');
        this.emit({ type: 'game_end', leaderboard: msg.leaderboard });
        break;
    }
  }

  // === HOST: Start Game ===
  startGame(settings?: Partial<GameSettings>) {
    if (!this.isHost) return;

    this.settings = { ...this.settings, ...settings };
    this.locations = pickRandomLocations(this.settings.totalRounds, this.settings.category);
    this.currentRound = 0;
    this.totalScores = {};
    for (const p of this.players) {
      this.totalScores[p.id] = 0;
    }

    this.hostPeer!.broadcast({ type: 'GAME_START', settings: this.settings });
    this.startNextRound();
  }

  private async startNextRound() {
    // Clear old broadcast messages to prevent bloat
    await this.hostPeer!.clearBroadcast();

    this.currentRound++;
    const location = this.locations[this.currentRound - 1];
    this.currentImageId = location.imageId;
    this.roundGuesses = {};
    this.readyPlayers.clear();
    this.timerStarted = false;
    this.timeRemaining = this.settings.timePerRound;

    const msg: HostMessage = {
      type: 'ROUND_START',
      round: this.currentRound,
      imageId: location.imageId,
      totalRounds: this.settings.totalRounds,
    };

    this.hostPeer!.broadcast(msg);

    // Host also plays
    this.setState('playing');
    this.emit({
      type: 'round_start',
      round: this.currentRound,
      totalRounds: this.settings.totalRounds,
      imageId: location.imageId,
    });

    // Timer starts only when all players are ready (markReady called)
  }

  private startTimer() {
    this.clearTimer();
    this.emit({ type: 'timer_update', remaining: this.timeRemaining });

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.emit({ type: 'timer_update', remaining: this.timeRemaining });
      this.hostPeer?.broadcast({ type: 'TIMER_SYNC', remaining: this.timeRemaining });

      if (this.timeRemaining <= 0) {
        this.endRound();
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // === BOTH: Mark self as ready (loaded) ===
  markReady() {
    if (this.isHost) {
      this.registerReady(this.hostPlayerId);
    } else {
      this.clientPeer?.send({ type: 'READY' });
    }
  }

  // === HOST: Register player ready ===
  private registerReady(playerId: string) {
    if (this.readyPlayers.has(playerId)) return;
    this.readyPlayers.add(playerId);
    console.log('[GeoGuesser] Player ready:', playerId, `(${this.readyPlayers.size}/${this.players.length})`);

    this.hostPeer?.broadcast({ type: 'PLAYER_READY', playerId });
    this.emit({ type: 'player_ready', playerId });

    // Check if all ready
    if (this.readyPlayers.size >= this.players.length && !this.timerStarted) {
      this.timerStarted = true;
      this.hostPeer?.broadcast({ type: 'ALL_READY' });
      this.emit({ type: 'all_ready' });
      this.startTimer();
    }
  }

  // === BOTH: Submit guess ===
  submitGuess(lat: number, lng: number) {
    if (this.state !== 'playing') return;

    if (this.isHost) {
      this.registerGuess(this.hostPlayerId, lat, lng);
    } else {
      this.clientPeer?.send({ type: 'GUESS', lat, lng });
    }
  }

  // === HOST: Register a guess ===
  private registerGuess(playerId: string, lat: number, lng: number) {
    if (this.roundGuesses[playerId]) return; // already guessed

    const location = this.locations[this.currentRound - 1];
    const distance = haversineDistance(lat, lng, location.lat, location.lng);
    const score = calculateScore(distance);

    this.roundGuesses[playerId] = { lat, lng, distance, score };

    // Notify all that this player guessed
    this.hostPeer?.broadcast({ type: 'PLAYER_GUESSED', playerId });
    this.emit({ type: 'player_guessed', playerId });

    this.checkAllGuessed();
  }

  private checkAllGuessed() {
    const activePlayers = this.players;
    const allGuessed = activePlayers.every(p => this.roundGuesses[p.id] != null);

    if (allGuessed) {
      this.endRound();
    }
  }

  private endRound() {
    this.clearTimer();

    const location = this.locations[this.currentRound - 1];
    const guesses: Guess[] = this.players.map(p => {
      const g = this.roundGuesses[p.id];
      const result: Guess = {
        playerId: p.id,
        playerName: p.name,
        lat: g?.lat ?? 0,
        lng: g?.lng ?? 0,
        distance: g?.distance ?? 20000,
        score: g?.score ?? 0,
      };
      this.totalScores[p.id] = (this.totalScores[p.id] || 0) + result.score;
      return result;
    });

    guesses.sort((a, b) => b.score - a.score);

    const roundEndMsg: HostMessage = {
      type: 'ROUND_END',
      round: this.currentRound,
      correctLat: location.lat,
      correctLng: location.lng,
      guesses,
    };

    this.hostPeer!.broadcast(roundEndMsg);
    this.setState('round_result');
    this.emit({
      type: 'round_end',
      round: this.currentRound,
      correctLat: location.lat,
      correctLng: location.lng,
      guesses,
    });

    if (this.currentRound >= this.settings.totalRounds) {
      setTimeout(() => this.endGame(), 8000);
    }
  }

  // === HOST: Next round ===
  nextRound() {
    if (!this.isHost) return;
    if (this.currentRound >= this.settings.totalRounds) {
      this.endGame();
    } else {
      this.startNextRound();
    }
  }

  private endGame() {
    const leaderboard: LeaderboardEntry[] = this.players
      .map(p => ({
        playerId: p.id,
        name: p.name,
        totalScore: this.totalScores[p.id] || 0,
        rank: 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    this.hostPeer!.broadcast({ type: 'GAME_END', leaderboard });
    this.setState('game_over');
    this.emit({ type: 'game_end', leaderboard });
  }

  // === HOST: Play again ===
  playAgain() {
    if (!this.isHost) return;
    this.setState('lobby');
    this.hostPeer!.broadcast({ type: 'LOBBY_UPDATE', players: this.players });
    this.emit({ type: 'players_updated', players: this.players });
  }

  // === Cleanup ===
  destroy() {
    this.clearTimer();
    this.hostPeer?.destroy();
    this.clientPeer?.destroy();
    this.hostPeer = null;
    this.clientPeer = null;
    this.state = 'idle';
    this.players = [];
    this.clearSession();
  }
}
