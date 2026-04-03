import { getCodenamesEngine } from '../../main';
import { navigate } from '../router';

export function renderCodenamesLanding(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'landing';

  div.innerHTML = `
    <h1 class="title title--glow landing__logo" style="color: var(--neon-magenta); text-shadow: 0 0 10px var(--neon-magenta), 0 0 20px var(--neon-magenta);">CODENAMES</h1>
    <p class="landing__subtitle">Командная игра в слова</p>
    <div class="landing__actions">
      <div class="card landing__card">
        <h2>СОЗДАТЬ КОМНАТУ</h2>
        <input class="input" id="cn-host-name" placeholder="Твоё имя" maxlength="20" />
        <select class="input" id="cn-lang" style="cursor: pointer;">
          <option value="ru">Русские слова</option>
          <option value="en">English words</option>
        </select>
        <button class="btn" id="cn-btn-create">СОЗДАТЬ</button>
      </div>
      <div class="card landing__card landing__card--join">
        <h2>ПРИСОЕДИНИТЬСЯ</h2>
        <input class="input" id="cn-join-name" placeholder="Твоё имя" maxlength="20" />
        <input class="input" id="cn-join-code" placeholder="Код комнаты" maxlength="6" style="text-transform: uppercase; letter-spacing: 4px; text-align: center;" />
        <button class="btn btn--magenta" id="cn-btn-join">ВОЙТИ</button>
      </div>
    </div>
    <div id="cn-error" style="color: #ff4466; margin-top: 12px; display: none;"></div>
    <button class="btn" style="margin-top: 20px; font-size: 0.7rem; opacity: 0.5;" id="cn-back">НАЗАД</button>
  `;

  requestAnimationFrame(() => {
    const errorEl = document.getElementById('cn-error')!;

    // Auto-fill from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('cnroom');
    if (roomFromUrl) {
      (document.getElementById('cn-join-code') as HTMLInputElement).value = roomFromUrl.toUpperCase();
      (document.getElementById('cn-join-name') as HTMLInputElement).focus();
    }

    document.getElementById('cn-btn-create')!.addEventListener('click', async () => {
      const name = (document.getElementById('cn-host-name') as HTMLInputElement).value.trim();
      const lang = (document.getElementById('cn-lang') as HTMLSelectElement).value;
      if (!name) return showError('Введи имя');

      const btn = document.getElementById('cn-btn-create') as HTMLButtonElement;
      btn.textContent = 'ПОДКЛЮЧЕНИЕ...';
      btn.disabled = true;

      try {
        const engine = getCodenamesEngine();
        await engine.createRoom(name, lang);
        navigate('#/codenames/room');
      } catch {
        showError('Не удалось создать комнату');
        btn.textContent = 'СОЗДАТЬ';
        btn.disabled = false;
      }
    });

    document.getElementById('cn-btn-join')!.addEventListener('click', async () => {
      const name = (document.getElementById('cn-join-name') as HTMLInputElement).value.trim();
      const code = (document.getElementById('cn-join-code') as HTMLInputElement).value.trim().toUpperCase();
      if (!name) return showError('Введи имя');
      if (!code || code.length < 4) return showError('Введи код комнаты');

      const btn = document.getElementById('cn-btn-join') as HTMLButtonElement;
      btn.textContent = 'ПОДКЛЮЧЕНИЕ...';
      btn.disabled = true;

      try {
        const engine = getCodenamesEngine();
        await engine.joinRoom(code, name);
        navigate('#/codenames/room');
      } catch {
        showError('Не удалось подключиться');
        btn.textContent = 'ВОЙТИ';
        btn.disabled = false;
      }
    });

    document.getElementById('cn-back')!.addEventListener('click', () => {
      navigate('#/');
    });

    function showError(msg: string) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    }
  });

  return div;
}
