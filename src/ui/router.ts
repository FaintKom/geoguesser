type ViewRenderer = () => HTMLElement;

const routes: Record<string, ViewRenderer> = {};
let currentCleanup: (() => void) | null = null;

export function registerRoute(path: string, renderer: ViewRenderer) {
  routes[path] = renderer;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function setRoomInUrl(roomCode: string, game: 'geo' | 'codenames') {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  url.searchParams.set('game', game);
  window.history.replaceState(null, '', url.toString());
}

export function clearRoomFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  url.searchParams.delete('game');
  window.history.replaceState(null, '', url.toString());
}

export function getRoomFromUrl(): { room: string; game: string } | null {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  const game = params.get('game') || params.get('cnroom') ? 'codenames' : 'geo';
  const cnroom = params.get('cnroom');
  if (cnroom) return { room: cnroom, game: 'codenames' };
  if (room) return { room, game };
  return null;
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
