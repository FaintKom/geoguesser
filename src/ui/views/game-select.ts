import { navigate, getRoomFromUrl, clearRoomFromUrl } from '../router';
import { getEngine, getCodenamesEngine } from '../../main';

// Always clear room from URL when showing game select (unless auto-joining)

export function renderGameSelect(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'landing';

  // Check if URL has a room code — auto-join
  const roomInfo = getRoomFromUrl();
  if (roomInfo) {
    div.innerHTML = `
      <h1 class="title title--glow landing__logo">GAME HUB</h1>
      <p class="landing__subtitle">Подключение к комнате ${roomInfo.room}...</p>
      <input class="input" id="autojoin-name" placeholder="Твоё имя" maxlength="20" style="max-width: 300px; margin-top: 20px;" />
      <button class="btn btn--green" id="autojoin-btn" style="margin-top: 12px;">ВОЙТИ</button>
      <div id="autojoin-error" style="color: #ff4466; margin-top: 12px; display: none;"></div>
    `;

    requestAnimationFrame(() => {
      document.getElementById('autojoin-btn')!.addEventListener('click', async () => {
        const name = (document.getElementById('autojoin-name') as HTMLInputElement).value.trim();
        if (!name) {
          const err = document.getElementById('autojoin-error')!;
          err.textContent = 'Введи имя';
          err.style.display = 'block';
          return;
        }

        const btn = document.getElementById('autojoin-btn') as HTMLButtonElement;
        btn.textContent = 'ПОДКЛЮЧЕНИЕ...';
        btn.disabled = true;

        try {
          if (roomInfo.game === 'codenames') {
            const engine = getCodenamesEngine();
            await engine.joinRoom(roomInfo.room, name);
            navigate('#/codenames/room');
          } else {
            const engine = getEngine();
            await engine.joinRoom(roomInfo.room, name);
            navigate('#/lobby');
          }
        } catch {
          const err = document.getElementById('autojoin-error')!;
          err.textContent = 'Комната не найдена или уже закрыта';
          err.style.display = 'block';
          btn.textContent = 'ВОЙТИ';
          btn.disabled = false;
          clearRoomFromUrl();
        }
      });
    });

    return div;
  }

  // Normal game selection — clear stale data
  localStorage.removeItem('geoguesser_session');
  clearRoomFromUrl();

  div.innerHTML = `
    <h1 class="title title--glow landing__logo">GAME HUB</h1>
    <p class="landing__subtitle">Выбери игру</p>
    <div class="landing__actions">
      <div class="card landing__card game-select__card" id="select-geo">
        <h2>GEOGUESSER</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">
          Угадай место на карте по панораме Google Street View
        </p>
        <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">100 локаций, 8 категорий</div>
        <button class="btn" style="margin-top: 16px;">ИГРАТЬ</button>
      </div>
      <div class="card landing__card landing__card--join game-select__card" id="select-codenames">
        <h2>CODENAMES</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">
          Командная игра в слова — найди агентов по подсказкам капитана
        </p>
        <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">800+ слов, рус/англ</div>
        <button class="btn btn--magenta" style="margin-top: 16px;">ИГРАТЬ</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    document.getElementById('select-geo')!.addEventListener('click', () => navigate('#/geo'));
    document.getElementById('select-codenames')!.addEventListener('click', () => navigate('#/codenames'));
  });

  return div;
}
