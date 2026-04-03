import { HostPeerManager, ClientPeerManager } from './peer-manager';

export interface CNCard {
  word: string;
  color: 'red' | 'blue' | 'neutral' | 'assassin';
  revealed: boolean;
}

export interface CNPlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | null;
  role: 'captain' | 'guesser' | null;
}

export interface CNClue {
  word: string;
  count: number;
  team: 'red' | 'blue';
}

export type CNPhase = 'waiting' | 'clue' | 'guessing' | 'game_over';

export interface CNGameState {
  board: CNCard[];
  currentTeam: 'red' | 'blue';
  clue: CNClue | null;
  guessesLeft: number;
  redScore: number;
  blueScore: number;
  redTotal: number;
  blueTotal: number;
  phase: CNPhase;
  winner: 'red' | 'blue' | null;
  lang: string;
}

// Messages
export type CNHostMessage =
  | { type: 'CN_ROOM_STATE'; players: CNPlayer[] }
  | { type: 'CN_GAME_STATE'; state: CNGameState; isCaptainView: boolean }
  | { type: 'CN_CARD_REVEALED'; index: number; color: string }
  | { type: 'CN_CLUE_GIVEN'; clue: CNClue }
  | { type: 'CN_TURN_CHANGED'; team: 'red' | 'blue' }
  | { type: 'CN_GAME_OVER'; winner: 'red' | 'blue' };

export type CNPeerMessage =
  | { type: 'CN_JOIN'; name: string }
  | { type: 'CN_SET_TEAM'; team: 'red' | 'blue' | null }
  | { type: 'CN_SET_ROLE'; role: 'captain' | 'guesser' }
  | { type: 'CN_GIVE_CLUE'; word: string; count: number }
  | { type: 'CN_GUESS'; index: number }
  | { type: 'CN_END_TURN' }
  | { type: 'CN_NEW_GAME' };

type UIHandler = (event: CNUIEvent) => void;

export type CNUIEvent =
  | { type: 'cn_players_updated'; players: CNPlayer[] }
  | { type: 'cn_game_updated'; state: CNGameState; isCaptainView: boolean }
  | { type: 'cn_card_revealed'; index: number; color: string }
  | { type: 'cn_error'; message: string }
  | { type: 'cn_room_created'; roomCode: string };

export class CodenamesEngine {
  isHost = false;
  hostPeer: HostPeerManager | null = null;
  clientPeer: ClientPeerManager | null = null;
  localPlayerId = '';
  localPlayerName = '';

  players: CNPlayer[] = [];
  gameState: CNGameState | null = null;
  lang = 'ru';
  turnTimer = 0;
  boardSize = 25;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private timeRemaining = 0;

  private uiHandlers: UIHandler[] = [];

  onUI(handler: UIHandler) { this.uiHandlers.push(handler); }
  private emit(event: CNUIEvent) { for (const h of this.uiHandlers) h(event); }

  // === HOST: Create Room ===
  async createRoom(playerName: string, lang: string = 'ru') {
    this.isHost = true;
    this.localPlayerName = playerName;
    this.lang = lang;
    this.hostPeer = new HostPeerManager();

    const roomCode = await this.hostPeer.createRoom();
    this.localPlayerId = this.hostPeer.playerId;

    this.players = [{ id: this.localPlayerId, name: playerName, team: null, role: null }];
    this.emit({ type: 'cn_room_created', roomCode });
    this.emit({ type: 'cn_players_updated', players: this.players });

    this.hostPeer.onMessage((msg, connId) => this.handlePeerMessage(msg as unknown as CNPeerMessage, connId));
    this.hostPeer.onPlayerLeave((connId) => {
      this.players = this.players.filter(p => p.id !== connId);
      this.broadcastRoomState();
    });
  }

  // === CLIENT: Join Room ===
  async joinRoom(roomCode: string, playerName: string) {
    this.isHost = false;
    this.localPlayerName = playerName;
    this.clientPeer = new ClientPeerManager();

    await this.clientPeer.joinRoom(roomCode);
    this.localPlayerId = this.clientPeer.connId;

    this.clientPeer.send({ type: 'CN_JOIN', name: playerName } as any);
    this.clientPeer.onMessage((msg) => this.handleHostMessage(msg as unknown as CNHostMessage));
    this.clientPeer.onDisconnect(() => {
      this.emit({ type: 'cn_error', message: 'Хост отключился' });
    });
  }

  // === HOST: Handle peer messages ===
  private handlePeerMessage(msg: CNPeerMessage, connId: string) {
    switch (msg.type) {
      case 'CN_JOIN': {
        this.players.push({ id: connId, name: msg.name, team: null, role: null });
        this.broadcastRoomState();
        // Send current game state if game is in progress
        if (this.gameState) {
          this.sendGameStateToPlayer(connId);
        }
        break;
      }
      case 'CN_SET_TEAM': {
        const player = this.players.find(p => p.id === connId);
        if (player) {
          player.team = msg.team;
          player.role = msg.team ? 'guesser' : null;
          this.broadcastRoomState();
        }
        break;
      }
      case 'CN_SET_ROLE': {
        const player = this.players.find(p => p.id === connId);
        if (player && player.team) {
          // Only one captain per team
          if (msg.role === 'captain') {
            for (const p of this.players) {
              if (p.team === player.team && p.role === 'captain') {
                p.role = 'guesser';
              }
            }
          }
          player.role = msg.role;
          this.broadcastRoomState();
          this.checkAndStartGame();
        }
        break;
      }
      case 'CN_GIVE_CLUE': {
        if (!this.gameState || this.gameState.phase !== 'clue') return;
        const player = this.players.find(p => p.id === connId);
        if (!player || player.role !== 'captain' || player.team !== this.gameState.currentTeam) return;

        this.gameState.clue = { word: msg.word, count: msg.count, team: this.gameState.currentTeam };
        this.gameState.guessesLeft = msg.count + 1;
        this.gameState.phase = 'guessing';
        this.broadcastGameState();
        break;
      }
      case 'CN_GUESS': {
        if (!this.gameState || this.gameState.phase !== 'guessing') return;
        const player = this.players.find(p => p.id === connId);
        if (!player || player.role !== 'guesser' || player.team !== this.gameState.currentTeam) return;

        this.revealCard(msg.index);
        break;
      }
      case 'CN_END_TURN': {
        if (!this.gameState || this.gameState.phase !== 'guessing') return;
        const player = this.players.find(p => p.id === connId);
        if (!player || player.team !== this.gameState.currentTeam) return;

        this.switchTurn();
        break;
      }
      case 'CN_NEW_GAME': {
        this.startNewGame();
        break;
      }
    }
  }

  // === CLIENT: Handle host messages ===
  private handleHostMessage(msg: CNHostMessage) {
    switch (msg.type) {
      case 'CN_ROOM_STATE':
        this.players = msg.players;
        this.emit({ type: 'cn_players_updated', players: this.players });
        break;
      case 'CN_GAME_STATE':
        this.gameState = msg.state;
        this.emit({ type: 'cn_game_updated', state: msg.state, isCaptainView: msg.isCaptainView });
        break;
      case 'CN_CARD_REVEALED':
        if (this.gameState) {
          this.gameState.board[msg.index].revealed = true;
          this.gameState.board[msg.index].color = msg.color as any;
        }
        this.emit({ type: 'cn_card_revealed', index: msg.index, color: msg.color });
        break;
      case 'CN_GAME_OVER':
        if (this.gameState) {
          this.gameState.phase = 'game_over';
          this.gameState.winner = msg.winner;
        }
        break;
    }
  }

  updateSettings(settings: { lang?: string; turnTimer?: number; boardSize?: number }) {
    if (settings.lang) this.lang = settings.lang;
    if (settings.turnTimer !== undefined) this.turnTimer = settings.turnTimer;
    if (settings.boardSize) this.boardSize = settings.boardSize;
  }

  // === HOST: Game actions ===
  setTeam(team: 'red' | 'blue' | null) {
    if (this.isHost) {
      const player = this.players.find(p => p.id === this.localPlayerId);
      if (player) {
        player.team = team;
        player.role = team ? 'guesser' : null;
        this.broadcastRoomState();
      }
    } else {
      this.clientPeer?.send({ type: 'CN_SET_TEAM', team } as any);
    }
  }

  setRole(role: 'captain' | 'guesser') {
    if (this.isHost) {
      const player = this.players.find(p => p.id === this.localPlayerId);
      if (player && player.team) {
        if (role === 'captain') {
          for (const p of this.players) {
            if (p.team === player.team && p.role === 'captain') p.role = 'guesser';
          }
        }
        player.role = role;
        this.broadcastRoomState();
        this.checkAndStartGame();
      }
    } else {
      this.clientPeer?.send({ type: 'CN_SET_ROLE', role } as any);
    }
  }

  giveClue(word: string, count: number) {
    if (this.isHost) {
      if (!this.gameState || this.gameState.phase !== 'clue') return;
      const player = this.players.find(p => p.id === this.localPlayerId);
      if (!player || player.role !== 'captain' || player.team !== this.gameState.currentTeam) return;

      this.gameState.clue = { word, count, team: this.gameState.currentTeam };
      this.gameState.guessesLeft = count + 1;
      this.gameState.phase = 'guessing';
      this.broadcastGameState();
    } else {
      this.clientPeer?.send({ type: 'CN_GIVE_CLUE', word, count } as any);
    }
  }

  guessCard(index: number) {
    if (this.isHost) {
      if (!this.gameState || this.gameState.phase !== 'guessing') return;
      const player = this.players.find(p => p.id === this.localPlayerId);
      if (!player || player.role !== 'guesser' || player.team !== this.gameState.currentTeam) return;
      this.revealCard(index);
    } else {
      this.clientPeer?.send({ type: 'CN_GUESS', index } as any);
    }
  }

  endTurn() {
    if (this.isHost) {
      this.switchTurn();
    } else {
      this.clientPeer?.send({ type: 'CN_END_TURN' } as any);
    }
  }

  requestNewGame() {
    if (this.isHost) {
      this.startNewGame();
    } else {
      this.clientPeer?.send({ type: 'CN_NEW_GAME' } as any);
    }
  }

  // === Game logic (HOST only) ===
  private checkAndStartGame() {
    if (!this.isHost) return;

    const redCaptain = this.players.some(p => p.team === 'red' && p.role === 'captain');
    const blueCaptain = this.players.some(p => p.team === 'blue' && p.role === 'captain');

    if (redCaptain && blueCaptain && !this.gameState) {
      this.startNewGame();
    }
  }

  private async startNewGame() {
    if (!this.isHost) return;
    this.clearTimer();

    const totalCards = this.boardSize;
    const words = await this.loadWords();
    const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, totalCards);

    // Scale card counts based on board size
    const firstTeam = Math.random() < 0.5 ? 'red' : 'blue';
    const secondTeam = firstTeam === 'red' ? 'blue' : 'red';

    let firstCount: number, secondCount: number, neutralCount: number;
    if (totalCards === 16) {
      firstCount = 6; secondCount = 5; neutralCount = 4; // +1 assassin = 16
    } else if (totalCards === 36) {
      firstCount = 12; secondCount = 11; neutralCount = 12; // +1 assassin = 36
    } else {
      firstCount = 9; secondCount = 8; neutralCount = 7; // +1 assassin = 25
    }

    const colors: CNCard['color'][] = [];
    for (let i = 0; i < firstCount; i++) colors.push(firstTeam as CNCard['color']);
    for (let i = 0; i < secondCount; i++) colors.push(secondTeam as CNCard['color']);
    for (let i = 0; i < neutralCount; i++) colors.push('neutral');
    colors.push('assassin');
    colors.sort(() => Math.random() - 0.5);

    const board: CNCard[] = shuffled.map((word, i) => ({
      word,
      color: colors[i],
      revealed: false,
    }));

    this.gameState = {
      board,
      currentTeam: firstTeam as 'red' | 'blue',
      clue: null,
      guessesLeft: 0,
      redScore: 0,
      blueScore: 0,
      redTotal: firstTeam === 'red' ? firstCount : secondCount,
      blueTotal: firstTeam === 'blue' ? firstCount : secondCount,
      phase: 'clue',
      winner: null,
      lang: this.lang,
    };

    this.broadcastGameState();
    this.startTurnTimer();
  }

  private startTurnTimer() {
    this.clearTimer();
    if (!this.turnTimer || !this.gameState || this.gameState.phase === 'game_over') return;

    this.timeRemaining = this.turnTimer;
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.clearTimer();
        if (this.gameState?.phase === 'clue') {
          // Captain ran out of time — skip their turn
          this.switchTurn();
        } else if (this.gameState?.phase === 'guessing') {
          this.switchTurn();
        }
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async loadWords(): Promise<string[]> {
    if (this.lang === 'en') {
      const mod = await import('../data/words-en.json');
      return mod.default as string[];
    }
    const mod = await import('../data/words-ru.json');
    return mod.default as string[];
  }

  private revealCard(index: number) {
    if (!this.gameState || this.gameState.board[index].revealed) return;

    const card = this.gameState.board[index];
    card.revealed = true;

    // Update scores
    if (card.color === 'red') this.gameState.redScore++;
    if (card.color === 'blue') this.gameState.blueScore++;

    this.hostPeer?.broadcast({ type: 'CN_CARD_REVEALED', index, color: card.color } as any);
    this.emit({ type: 'cn_card_revealed', index, color: card.color });

    // Check assassin
    if (card.color === 'assassin') {
      const loser = this.gameState.currentTeam;
      this.gameState.winner = loser === 'red' ? 'blue' : 'red';
      this.gameState.phase = 'game_over';
      this.broadcastGameState();
      return;
    }

    // Check win
    if (this.gameState.redScore >= this.gameState.redTotal) {
      this.gameState.winner = 'red';
      this.gameState.phase = 'game_over';
      this.broadcastGameState();
      return;
    }
    if (this.gameState.blueScore >= this.gameState.blueTotal) {
      this.gameState.winner = 'blue';
      this.gameState.phase = 'game_over';
      this.broadcastGameState();
      return;
    }

    // Wrong guess or neutral → end turn
    if (card.color !== this.gameState.currentTeam) {
      this.switchTurn();
      return;
    }

    // Correct guess
    this.gameState.guessesLeft--;
    if (this.gameState.guessesLeft <= 0) {
      this.switchTurn();
      return;
    }

    this.broadcastGameState();
  }

  private switchTurn() {
    if (!this.gameState) return;
    this.gameState.currentTeam = this.gameState.currentTeam === 'red' ? 'blue' : 'red';
    this.gameState.clue = null;
    this.gameState.guessesLeft = 0;
    this.gameState.phase = 'clue';
    this.broadcastGameState();
    this.startTurnTimer();
  }

  private broadcastRoomState() {
    this.hostPeer?.broadcast({ type: 'CN_ROOM_STATE', players: this.players } as any);
    this.emit({ type: 'cn_players_updated', players: this.players });
  }

  private broadcastGameState() {
    if (!this.gameState) return;

    // Send full state to captains, hidden state to guessers
    // For simplicity with broadcast, send full state — client-side filtering
    this.hostPeer?.broadcast({
      type: 'CN_GAME_STATE',
      state: this.gameState,
      isCaptainView: false, // clients determine their own view
    } as any);

    // Local emit for host
    const localPlayer = this.players.find(p => p.id === this.localPlayerId);
    const isCaptain = localPlayer?.role === 'captain';
    this.emit({
      type: 'cn_game_updated',
      state: this.gameState,
      isCaptainView: isCaptain,
    });
  }

  private sendGameStateToPlayer(connId: string) {
    if (!this.gameState) return;
    this.hostPeer?.sendTo(connId, {
      type: 'CN_GAME_STATE',
      state: this.gameState,
      isCaptainView: false,
    } as any);
  }

  getLocalPlayer(): CNPlayer | undefined {
    return this.players.find(p => p.id === this.localPlayerId);
  }

  getRoomCode(): string {
    return this.hostPeer?.roomCode || this.clientPeer?.roomCode || '';
  }

  destroy() {
    this.hostPeer?.destroy();
    this.clientPeer?.destroy();
    this.hostPeer = null;
    this.clientPeer = null;
    this.players = [];
    this.gameState = null;
  }
}
