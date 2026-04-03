import { navigate } from '../router';

export function renderGameSelect(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'landing';

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
