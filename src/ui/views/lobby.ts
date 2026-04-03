import { getEngine } from '../../main';
import { navigate } from '../router';
import { renderPlayerList } from '../components/player-list';
import { CATEGORIES } from '../../config';
import type { LocationCategory } from '../../types';
import type { UIEvent } from '../../lib/game-engine';

export function renderLobby(): HTMLElement {
  const engine = getEngine();
  const div = document.createElement('div');
  div.className = 'lobby';

  const roomCode = engine.isHost ? engine.hostPeer?.roomCode || '' : '';

  const categoryOptions = Object.entries(CATEGORIES)
    .map(([value, label]) => `<option value="${value}"${value === 'all' ? ' selected' : ''}>${label}</option>`)
    .join('');

  div.innerHTML = `
    <h1 class="title title--glow lobby__title">ЛОББИ</h1>
    ${engine.isHost ? `
      <p style="color: var(--text-secondary); margin-bottom: 4px;">Код комнаты:</p>
      <div class="room-code" id="room-code">${roomCode}</div>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">Нажми чтобы скопировать ссылку-приглашение</p>
    ` : `
      <p class="lobby__waiting">Подключено к комнате</p>
    `}
    <div id="player-list-container"></div>
    ${engine.isHost ? `
      <div class="lobby__settings">
        <div class="lobby__setting">
          <label>Категория</label>
          <select id="setting-category">
            ${categoryOptions}
          </select>
        </div>
        <div class="lobby__setting">
          <label>Раунды</label>
          <select id="setting-rounds">
            <option value="3">3</option>
            <option value="5" selected>5</option>
            <option value="10">10</option>
          </select>
        </div>
        <div class="lobby__setting">
          <label>Время (сек)</label>
          <select id="setting-time">
            <option value="30">30</option>
            <option value="60" selected>60</option>
            <option value="90">90</option>
            <option value="120">120</option>
          </select>
        </div>
      </div>
      <button class="btn btn--green" id="btn-start" style="margin-top: 16px;">НАЧАТЬ ИГРУ</button>
    ` : `
      <p class="lobby__waiting">Ожидание начала игры...</p>
    `}
  `;

  requestAnimationFrame(() => {
    updatePlayerList();

    // Copy invite link
    const codeEl = document.getElementById('room-code');
    codeEl?.addEventListener('click', () => {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard.writeText(url);
      codeEl.style.color = '#00ff88';
      codeEl.textContent = 'ССЫЛКА СКОПИРОВАНА!';
      setTimeout(() => {
        codeEl.style.color = '';
        codeEl.textContent = roomCode;
      }, 2000);
    });

    // Start game
    const btnStart = document.getElementById('btn-start');
    btnStart?.addEventListener('click', () => {
      const rounds = parseInt((document.getElementById('setting-rounds') as HTMLSelectElement).value);
      const time = parseInt((document.getElementById('setting-time') as HTMLSelectElement).value);
      const category = (document.getElementById('setting-category') as HTMLSelectElement).value as LocationCategory;
      engine.startGame({ totalRounds: rounds, timePerRound: time, category });
    });

    // Listen for updates
    engine.onUI(handleUI);
    engine.onStateChanged((state) => {
      if (state === 'playing') {
        navigate('#/game');
      }
    });
  });

  function handleUI(event: UIEvent) {
    if (event.type === 'players_updated') {
      updatePlayerList();
    }
    if (event.type === 'round_start') {
      navigate('#/game');
    }
  }

  function updatePlayerList() {
    const container = document.getElementById('player-list-container');
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(renderPlayerList(engine.players));
  }

  return div;
}
