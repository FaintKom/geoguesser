import { getEngine } from '../../main';
import { navigate } from '../router';
import type { LeaderboardEntry } from '../../types';

let lastLeaderboard: LeaderboardEntry[] = [];

export function setLeaderboard(lb: LeaderboardEntry[]) {
  lastLeaderboard = lb;
}

export function renderLeaderboard(): HTMLElement {
  const engine = getEngine();
  const div = document.createElement('div');
  div.className = 'leaderboard';

  const lb = lastLeaderboard;
  const top3 = lb.slice(0, 3);

  const rankClasses = ['first', 'second', 'third'];

  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
      ? [top3[1], top3[0]]
      : top3;

  const podiumClasses = top3.length >= 3
    ? [rankClasses[1], rankClasses[0], rankClasses[2]]
    : top3.length === 2
      ? [rankClasses[1], rankClasses[0]]
      : [rankClasses[0]];

  div.innerHTML = `
    <h1 class="title title--glow leaderboard__title">ИТОГИ</h1>
    <div class="leaderboard__podium">
      ${podiumOrder.map((entry, i) => `
        <div class="leaderboard__podium-item leaderboard__podium-item--${podiumClasses[i]}">
          <span class="leaderboard__rank">#${entry.rank}</span>
          <span class="leaderboard__name">${escapeHtml(entry.name)}</span>
          <span class="leaderboard__score">${entry.totalScore} pts</span>
        </div>
      `).join('')}
    </div>
    ${lb.length > 3 ? `
      <div class="leaderboard__full-list card">
        <table class="results__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Игрок</th>
              <th>Очки</th>
            </tr>
          </thead>
          <tbody>
            ${lb.slice(3).map(entry => `
              <tr>
                <td>${entry.rank}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td style="color: var(--neon-green); font-family: var(--font-display);">${entry.totalScore}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
    ${engine.isHost ? `
      <button class="btn btn--magenta" id="btn-play-again" style="margin-top: 16px;">ИГРАТЬ СНОВА</button>
    ` : ''}
  `;

  requestAnimationFrame(() => {
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      engine.playAgain();
      navigate('#/lobby');
    });

    engine.onStateChanged((state) => {
      if (state === 'lobby') navigate('#/lobby');
    });
  });

  return div;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
