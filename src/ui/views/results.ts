import { getEngine } from '../../main';
import { navigate } from '../router';
import { setCleanup } from '../router';
import { GuessMap } from '../components/guess-map';
import { PLAYER_COLORS } from '../../config';
import type { Guess } from '../../types';
import type { UIEvent } from '../../lib/game-engine';

let lastRoundData: {
  round: number;
  correctLat: number;
  correctLng: number;
  guesses: Guess[];
} | null = null;

export function setRoundData(data: typeof lastRoundData) {
  lastRoundData = data;
}

export function renderResults(): HTMLElement {
  const engine = getEngine();
  const div = document.createElement('div');
  div.className = 'results';

  // Get round data from engine's last emitted event
  const data = lastRoundData;

  div.innerHTML = `
    <div class="results__map" id="results-map"></div>
    <div class="results__panel">
      <h2 class="results__title">РЕЗУЛЬТАТЫ РАУНДА ${data?.round || '?'}</h2>
      <table class="results__table">
        <thead>
          <tr>
            <th></th>
            <th>Игрок</th>
            <th>Расстояние</th>
            <th>Очки</th>
          </tr>
        </thead>
        <tbody id="results-tbody"></tbody>
      </table>
      ${engine.isHost ? `
        <button class="btn btn--cyan results__next-btn" id="btn-next">
          ${(data?.round || 0) >= engine.settings.totalRounds ? 'ИТОГИ' : 'ДАЛЕЕ'}
        </button>
      ` : `
        <p class="lobby__waiting" style="margin-top: 12px;">Ожидание хоста...</p>
      `}
    </div>
  `;

  const guessMap = new GuessMap();

  setCleanup(() => {
    guessMap.destroy();
  });

  requestAnimationFrame(() => {
    guessMap.init('results-map');

    if (data) {
      // Populate table
      const tbody = document.getElementById('results-tbody')!;
      data.guesses.forEach((g) => {
        const color = PLAYER_COLORS[engine.players.findIndex(p => p.id === g.playerId) % PLAYER_COLORS.length];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></span></td>
          <td>${escapeHtml(g.playerName)}</td>
          <td>${g.distance >= 20000 ? 'Не угадал' : formatDistance(g.distance)}</td>
          <td style="color: var(--neon-green); font-family: var(--font-display);">${g.score}</td>
        `;
        tbody.appendChild(tr);
      });

      // Show results on map
      setTimeout(() => {
        guessMap.showResults(data.correctLat, data.correctLng, data.guesses, engine.players);
      }, 100);
    }

    // Next button
    document.getElementById('btn-next')?.addEventListener('click', () => {
      engine.nextRound();
    });

    engine.onUI(handleUI);
    engine.onStateChanged((state) => {
      if (state === 'playing') navigate('#/game');
      else if (state === 'game_over') navigate('#/leaderboard');
    });
  });

  function handleUI(event: UIEvent) {
    if (event.type === 'round_start') {
      navigate('#/game');
    } else if (event.type === 'game_end') {
      navigate('#/leaderboard');
    }
  }

  return div;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km)} km`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
