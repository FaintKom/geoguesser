import { getEngine } from '../../main';
import { navigate } from '../router';
import { createNavbar } from '../components/navbar';

export function renderLanding(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';
  wrapper.appendChild(createNavbar({ title: 'GEOGUESSER', backTo: '#/' }));

  const div = document.createElement('div');
  div.className = 'landing';
  div.style.flex = '1';
  wrapper.appendChild(div);

  div.innerHTML = `
    <h1 class="title title--glow landing__logo">GEOGUESSER</h1>
    <p class="landing__subtitle">Multiplayer Edition</p>
    <div class="landing__actions">
      <div class="card landing__card">
        <h2>СОЗДАТЬ КОМНАТУ</h2>
        <input class="input" id="host-name" placeholder="Твоё имя" maxlength="20" />
        <button class="btn" id="btn-create">СОЗДАТЬ</button>
      </div>
      <div class="card landing__card landing__card--join">
        <h2>ПРИСОЕДИНИТЬСЯ</h2>
        <input class="input" id="join-name" placeholder="Твоё имя" maxlength="20" />
        <input class="input" id="join-code" placeholder="Код комнаты" maxlength="6" style="text-transform: uppercase; letter-spacing: 4px; text-align: center;" />
        <button class="btn btn--magenta" id="btn-join">ВОЙТИ</button>
      </div>
    </div>
    <div id="landing-error" style="color: #ff4466; margin-top: 12px; display: none;"></div>
  `;

  requestAnimationFrame(() => {
    const btnCreate = document.getElementById('btn-create')!;
    const btnJoin = document.getElementById('btn-join')!;
    const errorEl = document.getElementById('landing-error')!;

    // Auto-fill room code from URL ?room=XXXXX
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      const codeInput = document.getElementById('join-code') as HTMLInputElement;
      codeInput.value = roomFromUrl.toUpperCase();
      // Focus on name input so user just types name and clicks join
      (document.getElementById('join-name') as HTMLInputElement).focus();
    }

    btnCreate.addEventListener('click', async () => {
      const name = (document.getElementById('host-name') as HTMLInputElement).value.trim();
      if (!name) return showError('Введи имя');

      btnCreate.textContent = 'ПОДКЛЮЧЕНИЕ...';
      (btnCreate as HTMLButtonElement).disabled = true;

      const engine = getEngine();
      engine.onUI((event) => {
        if (event.type === 'error') {
          showError(event.message);
          btnCreate.textContent = 'СОЗДАТЬ';
          (btnCreate as HTMLButtonElement).disabled = false;
        }
      });

      try {
        await engine.createRoom(name);
        if (engine.state === 'lobby') {
          navigate('#/lobby');
        }
      } catch {
        showError('Не удалось подключиться к серверу. Попробуй ещё раз.');
        btnCreate.textContent = 'СОЗДАТЬ';
        (btnCreate as HTMLButtonElement).disabled = false;
      }
    });

    btnJoin.addEventListener('click', async () => {
      const name = (document.getElementById('join-name') as HTMLInputElement).value.trim();
      const code = (document.getElementById('join-code') as HTMLInputElement).value.trim().toUpperCase();

      if (!name) return showError('Введи имя');
      if (!code || code.length < 4) return showError('Введи код комнаты');

      btnJoin.textContent = 'ПОДКЛЮЧЕНИЕ...';
      (btnJoin as HTMLButtonElement).disabled = true;

      const engine = getEngine();
      engine.onUI((event) => {
        if (event.type === 'error') {
          showError(event.message);
          btnJoin.textContent = 'ВОЙТИ';
          (btnJoin as HTMLButtonElement).disabled = false;
        }
      });

      try {
        await engine.joinRoom(code, name);
        if (engine.state === 'lobby') {
          navigate('#/lobby');
        }
      } catch {
        showError('Не удалось подключиться. Проверь код комнаты.');
        btnJoin.textContent = 'ВОЙТИ';
        (btnJoin as HTMLButtonElement).disabled = false;
      }
    });

    function showError(msg: string) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    }
  });

  return wrapper;
}
