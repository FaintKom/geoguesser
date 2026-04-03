import './style.css';
import { registerRoute, initRouter } from './ui/router';
import { renderGameSelect } from './ui/views/game-select';
import { renderLanding } from './ui/views/landing';
import { renderLobby } from './ui/views/lobby';
import { renderGame } from './ui/views/game';
import { renderResults, setRoundData } from './ui/views/results';
import { renderLeaderboard, setLeaderboard } from './ui/views/leaderboard';
import { renderCodenamesLanding } from './ui/views/codenames-landing';
import { renderCodenamesRoom } from './ui/views/codenames-room';
import { GameEngine } from './lib/game-engine';
import { CodenamesEngine } from './lib/codenames-engine';

let engine: GameEngine | null = null;
let cnEngine: CodenamesEngine | null = null;

export function getEngine(): GameEngine {
  if (!engine) {
    engine = new GameEngine();
    engine.onUI((event) => {
      if (event.type === 'round_end') {
        setRoundData({
          round: event.round,
          correctLat: event.correctLat,
          correctLng: event.correctLng,
          guesses: event.guesses,
        });
      }
      if (event.type === 'game_end') {
        setLeaderboard(event.leaderboard);
      }
    });
  }
  return engine;
}

export function getCodenamesEngine(): CodenamesEngine {
  if (!cnEngine) {
    cnEngine = new CodenamesEngine();
  }
  return cnEngine;
}

// Game selection
registerRoute('#/', renderGameSelect);

// GeoGuesser routes
registerRoute('#/geo', renderLanding);
registerRoute('#/geo/lobby', renderLobby);
registerRoute('#/geo/game', renderGame);
registerRoute('#/geo/results', renderResults);
registerRoute('#/geo/leaderboard', renderLeaderboard);

// Legacy routes (backward compat)
registerRoute('#/lobby', renderLobby);
registerRoute('#/game', renderGame);
registerRoute('#/results', renderResults);
registerRoute('#/leaderboard', renderLeaderboard);

// Codenames routes
registerRoute('#/codenames', renderCodenamesLanding);
registerRoute('#/codenames/room', renderCodenamesRoom);

initRouter();
