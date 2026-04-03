import { navigate } from '../router';

export function createNavbar(options: {
  title?: string;
  backTo?: string;
  backLabel?: string;
  rightHtml?: string;
} = {}): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const left = document.createElement('div');
  left.className = 'navbar__left';

  if (options.backTo) {
    const backBtn = document.createElement('button');
    backBtn.className = 'navbar__back';
    backBtn.innerHTML = '&larr;';
    backBtn.title = options.backLabel || 'Назад';
    backBtn.addEventListener('click', () => navigate(options.backTo!));
    left.appendChild(backBtn);
  }

  const homeBtn = document.createElement('button');
  homeBtn.className = 'navbar__home';
  homeBtn.textContent = 'GAME HUB';
  homeBtn.addEventListener('click', () => navigate('#/'));
  left.appendChild(homeBtn);

  if (options.title) {
    const sep = document.createElement('span');
    sep.className = 'navbar__sep';
    sep.textContent = '/';
    left.appendChild(sep);

    const title = document.createElement('span');
    title.className = 'navbar__title';
    title.textContent = options.title;
    left.appendChild(title);
  }

  nav.appendChild(left);

  if (options.rightHtml) {
    const right = document.createElement('div');
    right.className = 'navbar__right';
    right.innerHTML = options.rightHtml;
    nav.appendChild(right);
  }

  return nav;
}
