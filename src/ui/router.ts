type ViewRenderer = () => HTMLElement;

const routes: Record<string, ViewRenderer> = {};
let currentCleanup: (() => void) | null = null;

export function registerRoute(path: string, renderer: ViewRenderer) {
  routes[path] = renderer;
}

export function navigate(path: string) {
  window.location.hash = path;
}

function render() {
  const hash = window.location.hash || '#/';
  const renderer = routes[hash];
  const app = document.getElementById('app')!;

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  app.innerHTML = '';

  if (renderer) {
    const el = renderer();
    app.appendChild(el);
  } else {
    navigate('#/');
  }
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  render();
}

export function setCleanup(fn: () => void) {
  currentCleanup = fn;
}
