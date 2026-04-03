export type LocationCategory = 'all' | 'capitals' | 'europe' | 'americas' | 'russia' | 'asia' | 'landmarks' | 'nature';

export interface Location {
  imageId: string;
  lat: number;
  lng: number;
  country: string;
  category: LocationCategory[];
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Guess {
  playerId: string;
  playerName: string;
  lat: number;
  lng: number;
  distance: number;
  score: number;
}

export interface GameSettings {
  totalRounds: number;
  timePerRound: number;
  category: LocationCategory;
}

export type GameState = 'idle' | 'lobby' | 'playing' | 'round_result' | 'game_over';

// Host -> Peers messages
export type HostMessage =
  | { type: 'LOBBY_UPDATE'; players: Player[] }
  | { type: 'GAME_START'; settings: GameSettings }
  | { type: 'ROUND_START'; round: number; imageId: string; totalRounds: number }
  | { type: 'TIMER_SYNC'; remaining: number }
  | { type: 'ROUND_END'; round: number; correctLat: number; correctLng: number; guesses: Guess[] }
  | { type: 'GAME_END'; leaderboard: LeaderboardEntry[] }
  | { type: 'PLAYER_GUESSED'; playerId: string };

// Peers -> Host messages
export type PeerMessage =
  | { type: 'JOIN'; name: string }
  | { type: 'GUESS'; lat: number; lng: number };

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  totalScore: number;
  rank: number;
}

export interface RoundScore {
  [playerId: string]: { lat: number; lng: number; distance: number; score: number } | null;
}
