import { getEngine } from '../../main';
import { navigate, setCleanup, setRoomInUrl } from '../router';
import { MapillaryViewer } from '../components/mapillary-viewer';
import { GuessMap } from '../components/guess-map';
import { createTimerElement, updateTimer, unlockAudio } from '../components/timer';
import { PLAYER_COLORS } from '../../config';
import type { UIEvent } from '../../lib/game-engine';

export function renderGame(): HTMLElement {
  const engine = getEngine();
  const div = document.createElement('div');
  div.className = 'game';

  let currentRound = engine.currentRound;
  let totalRounds = engine.settings.totalRounds;
  let hasGuessed = false;
  const guessedPlayers = new Set<string>();
  const readyPlayers = new Set<string>();

  div.innerHTML = `
    <div class="game__viewer" id="mapillary-container"></div>
    <div class="game__hud">
      <div class="game__round-info" id="round-info">Round --/--</div>
      <div id="timer-container"></div>
    </div>
    <div class="game__map-wrap" id="map-wrap">
      <div class="game__minimap" id="guess-map-container"></div>
      <button class="game__map-toggle" id="btn-map-toggle" title="Развернуть карту">&#x26F6;</button>
    </div>
    <div class="game__bottom-bar">
      <div class="game__players-status" id="players-status"></div>
      <button class="btn btn--green" id="btn-confirm" disabled>ПОДТВЕРДИТЬ</button>
    </div>
  `;

  const viewer = new MapillaryViewer('mapillary-container');
  const guessMap = new GuessMap();
  const timerEl = createTimerElement();

  setCleanup(() => {
    viewer.destroy();
    guessMap.destroy();
  });

  requestAnimationFrame(() => {
    document.getElementById('timer-container')?.appendChild(timerEl);
    viewer.init();
    guessMap.init('guess-map-container');

    // Keep room code in URL during game
    const rc = engine.hostPeer?.roomCode || engine.clientPeer?.roomCode || '';
    if (rc) setRoomInUrl(rc, 'geo');

    updatePlayersStatus();

    // Apply current round data from engine
    if (currentRound > 0) {
      const roundInfo = document.getElementById('round-info');
      if (roundInfo) roundInfo.textContent = `РАУНД ${currentRound}/${totalRounds}`;
      if (engine.currentImageId) {
        viewer.showImage(engine.currentImageId);
        // Mark ready after a short delay (iframe needs time to start loading)
        setTimeout(() => engine.markReady(), 2000);
      }
    }

    // Toggle map fullscreen (works on both mobile and desktop)
    const mapWrap = document.getElementById('map-wrap')!;
    const mapContainer = document.getElementById('guess-map-container')!;
    const btnToggle = document.getElementById('btn-map-toggle')!;

    btnToggle.addEventListener('click', () => {
      mapWrap.classList.toggle('expanded');
      guessMap.resize();
      btnToggle.textContent = mapWrap.classList.contains('expanded') ? '\u2716' : '\u26F6';
      btnToggle.title = mapWrap.classList.contains('expanded') ? 'Свернуть карту' : 'Развернуть карту';
    });

    // Enable confirm button when map is clicked
    mapContainer.addEventListener('click', () => {
      if (!hasGuessed && guessMap.getGuess()) {
        const btn = document.getElementById('btn-confirm') as HTMLButtonElement;
        btn.disabled = false;
      }
    });

    // Confirm guess
    document.getElementById('btn-confirm')!.addEventListener('click', () => {
      unlockAudio();
      const guess = guessMap.getGuess();
      if (!guess || hasGuessed) return;

      hasGuessed = true;
      guessMap.lock();
      engine.submitGuess(guess.lat, guess.lng);

      const btn = document.getElementById('btn-confirm') as HTMLButtonElement;
      btn.textContent = 'ОЖИДАНИЕ...';
      btn.disabled = true;
    });

    // Handle game events
    engine.onUI(handleUI);
    engine.onStateChanged((state) => {
      if (state === 'round_result') {
        navigate('#/results');
      } else if (state === 'game_over') {
        navigate('#/leaderboard');
      }
    });
  });

  function handleUI(event: UIEvent) {
    switch (event.type) {
      case 'round_start': {
        currentRound = event.round;
        totalRounds = event.totalRounds;
        hasGuessed = false;
        guessedPlayers.clear();
        readyPlayers.clear();
        guessMap.reset();

        const roundInfo = document.getElementById('round-info');
        if (roundInfo) roundInfo.textContent = `ЗАГРУЗКА...`;

        const btn = document.getElementById('btn-confirm') as HTMLButtonElement;
        if (btn) {
          btn.textContent = 'ПОДТВЕРДИТЬ';
          btn.disabled = true;
        }

        viewer.showImage(event.imageId);
        updatePlayersStatus();

        // Mark ready after iframe loads
        setTimeout(() => engine.markReady(), 2000);
        break;
      }
      case 'all_ready': {
        const roundInfo = document.getElementById('round-info');
        if (roundInfo) roundInfo.textContent = `РАУНД ${currentRound}/${totalRounds}`;
        break;
      }
      case 'player_ready':
        readyPlayers.add(event.playerId);
        updatePlayersStatus();
        break;

      case 'timer_update':
        updateTimer(timerEl, event.remaining);
        break;

      case 'player_guessed':
        guessedPlayers.add(event.playerId);
        updatePlayersStatus();
        break;

      case 'round_end':
        navigate('#/results');
        break;

      case 'game_end':
        navigate('#/leaderboard');
        break;
    }
  }

  function updatePlayersStatus() {
    const container = document.getElementById('players-status');
    if (!container) return;
    container.innerHTML = '';

    engine.players.forEach((p, i) => {
      const dot = document.createElement('div');
      dot.className = 'game__player-status';
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      dot.style.borderColor = color;

      if (guessedPlayers.has(p.id)) {
        // Guessed — solid color
        dot.classList.add('game__player-status--guessed');
        dot.style.background = color;
        dot.style.borderColor = color;
        dot.title = `${p.name} — угадал`;
      } else if (readyPlayers.has(p.id)) {
        // Ready — half filled
        dot.classList.add('game__player-status--ready');
        dot.style.borderColor = color;
        dot.title = `${p.name} — готов`;
      } else {
        // Loading
        dot.classList.add('game__player-status--loading');
        dot.title = `${p.name} — загрузка...`;
      }

      container.appendChild(dot);
    });
  }

  return div;
}
