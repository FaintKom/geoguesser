import './style.css';
import { registerRoute, initRouter } from './ui/router';
import { renderLanding } from './ui/views/landing';
import { renderLobby } from './ui/views/lobby';
import { renderGame } from './ui/views/game';
import { renderResults, setRoundData } from './ui/views/results';
import { renderLeaderboard, setLeaderboard } from './ui/views/leaderboard';
import { GameEngine } from './lib/game-engine';

let engine: GameEngine | null = null;

export function getEngine(): GameEngine {
  if (!engine) {
    engine = new GameEngine();

    // Wire up round data for results view
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

registerRoute('#/', renderLanding);
registerRoute('#/lobby', renderLobby);
registerRoute('#/game', renderGame);
registerRoute('#/results', renderResults);
registerRoute('#/leaderboard', renderLeaderboard);

initRouter();
