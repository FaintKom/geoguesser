import { getCodenamesEngine } from '../../main';
import type { CNGameState, CNUIEvent } from '../../lib/codenames-engine';

function escapeHtml(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

export function renderCodenamesRoom(): HTMLElement {
  const engine = getCodenamesEngine();
  const div = document.createElement('div');
  div.className = 'cn-room';

  const roomCode = engine.getRoomCode();

  div.innerHTML = `
    <div class="cn-header">
      <h1 class="cn-title">CODENAMES</h1>
      <div class="room-code cn-room-code" id="cn-room-code" style="font-size: 1.2rem; padding: 6px 12px; letter-spacing: 4px;">${roomCode}</div>
      <div class="cn-status" id="cn-status"></div>
    </div>
    <div class="cn-layout">
      <div class="cn-team cn-team--red" id="cn-team-red">
        <h3 class="cn-team__title cn-team__title--red">КРАСНЫЕ</h3>
        <div class="cn-team__score" id="cn-red-score">0/0</div>
        <div class="cn-team__players" id="cn-red-players"></div>
        <div class="cn-team__actions" id="cn-red-actions"></div>
      </div>
      <div class="cn-center">
        <div class="cn-board" id="cn-board"></div>
        <div class="cn-clue-area" id="cn-clue-area"></div>
        <div class="cn-controls" id="cn-controls"></div>
      </div>
      <div class="cn-team cn-team--blue" id="cn-team-blue">
        <h3 class="cn-team__title cn-team__title--blue">СИНИЕ</h3>
        <div class="cn-team__score" id="cn-blue-score">0/0</div>
        <div class="cn-team__players" id="cn-blue-players"></div>
        <div class="cn-team__actions" id="cn-blue-actions"></div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    // Copy room code
    document.getElementById('cn-room-code')!.addEventListener('click', () => {
      const url = `${window.location.origin}${window.location.pathname}?cnroom=${roomCode}`;
      navigator.clipboard.writeText(url);
      const el = document.getElementById('cn-room-code')!;
      el.textContent = 'СКОПИРОВАНО!';
      setTimeout(() => { el.textContent = roomCode; }, 1500);
    });

    updateAll();
    engine.onUI(handleUI);
  });

  function handleUI(event: CNUIEvent) {
    switch (event.type) {
      case 'cn_players_updated':
        updateTeamPanels();
        break;
      case 'cn_game_updated':
        updateBoard(event.state, event.isCaptainView);
        updateClueArea(event.state);
        updateControls(event.state);
        updateScores(event.state);
        updateStatus(event.state);
        break;
      case 'cn_card_revealed':
        // Full update will come via game_updated
        break;
    }
  }

  function updateAll() {
    updateTeamPanels();
    if (engine.gameState) {
      const localPlayer = engine.getLocalPlayer();
      const isCaptain = localPlayer?.role === 'captain';
      updateBoard(engine.gameState, isCaptain);
      updateClueArea(engine.gameState);
      updateControls(engine.gameState);
      updateScores(engine.gameState);
      updateStatus(engine.gameState);
    } else {
      document.getElementById('cn-board')!.innerHTML = '<div class="cn-board__empty">Ожидание капитанов обеих команд...</div>';
    }
  }

  function updateTeamPanels() {
    const localPlayer = engine.getLocalPlayer();
    for (const team of ['red', 'blue'] as const) {
      const teamPlayers = engine.players.filter(p => p.team === team);
      const captain = teamPlayers.find(p => p.role === 'captain');
      const guessers = teamPlayers.filter(p => p.role === 'guesser');

      const playersEl = document.getElementById(`cn-${team}-players`)!;
      playersEl.innerHTML = '';

      if (captain) {
        const cap = document.createElement('div');
        cap.className = 'cn-player cn-player--captain';
        cap.textContent = `👑 ${captain.name}`;
        playersEl.appendChild(cap);
      }

      for (const g of guessers) {
        const el = document.createElement('div');
        el.className = 'cn-player';
        el.textContent = g.name;
        playersEl.appendChild(el);
      }

      // Actions
      const actionsEl = document.getElementById(`cn-${team}-actions`)!;
      actionsEl.innerHTML = '';

      if (!localPlayer?.team || localPlayer.team !== team) {
        const joinBtn = document.createElement('button');
        joinBtn.className = `btn btn--${team === 'red' ? 'magenta' : 'green'} cn-team__btn`;
        joinBtn.textContent = 'ВОЙТИ';
        joinBtn.addEventListener('click', () => engine.setTeam(team));
        actionsEl.appendChild(joinBtn);
      } else if (localPlayer.team === team && localPlayer.role !== 'captain') {
        const capBtn = document.createElement('button');
        capBtn.className = `btn cn-team__btn`;
        capBtn.textContent = 'СТАТЬ КАПИТАНОМ';
        capBtn.style.fontSize = '0.65rem';
        capBtn.addEventListener('click', () => engine.setRole('captain'));
        actionsEl.appendChild(capBtn);
      }
    }
  }

  function updateBoard(state: CNGameState, _isCaptainView: boolean) {
    const boardEl = document.getElementById('cn-board')!;
    boardEl.innerHTML = '';

    const localPlayer = engine.getLocalPlayer();
    const isCaptain = localPlayer?.role === 'captain';
    const isMyTurn = state.phase === 'guessing' && localPlayer?.team === state.currentTeam && localPlayer?.role === 'guesser';

    for (let i = 0; i < state.board.length; i++) {
      const card = state.board[i];
      const cardEl = document.createElement('div');
      cardEl.className = 'cn-card';

      if (card.revealed) {
        cardEl.classList.add('cn-card--revealed', `cn-card--${card.color}`);
      } else if (isCaptain) {
        cardEl.classList.add(`cn-card--hint-${card.color}`);
      }

      if (!card.revealed && isMyTurn) {
        cardEl.classList.add('cn-card--clickable');
        cardEl.addEventListener('click', () => engine.guessCard(i));
      }

      cardEl.textContent = card.word;
      boardEl.appendChild(cardEl);
    }
  }

  function updateClueArea(state: CNGameState) {
    const el = document.getElementById('cn-clue-area')!;

    if (state.phase === 'clue') {
      const localPlayer = engine.getLocalPlayer();
      const isCaptain = localPlayer?.role === 'captain' && localPlayer?.team === state.currentTeam;

      if (isCaptain) {
        el.innerHTML = `
          <div class="cn-clue-form">
            <input class="input cn-clue-input" id="cn-clue-word" placeholder="Подсказка" maxlength="30" />
            <input class="input cn-clue-input cn-clue-count" id="cn-clue-count" type="number" min="0" max="9" value="1" />
            <button class="btn btn--green cn-clue-btn" id="cn-clue-submit">ДАТЬ</button>
          </div>
        `;
        document.getElementById('cn-clue-submit')!.addEventListener('click', () => {
          const word = (document.getElementById('cn-clue-word') as HTMLInputElement).value.trim();
          const count = parseInt((document.getElementById('cn-clue-count') as HTMLInputElement).value);
          if (word && count >= 0) engine.giveClue(word, count);
        });
      } else {
        const teamName = state.currentTeam === 'red' ? 'красных' : 'синих';
        el.innerHTML = `<div class="cn-waiting">Капитан ${teamName} думает...</div>`;
      }
    } else if (state.phase === 'guessing' && state.clue) {
      el.innerHTML = `
        <div class="cn-clue-display">
          <span class="cn-clue-word">${escapeHtml(state.clue.word)}</span>
          <span class="cn-clue-num">${state.clue.count}</span>
          <span class="cn-clue-left">(осталось: ${state.guessesLeft})</span>
        </div>
      `;
    } else if (state.phase === 'game_over') {
      const winnerName = state.winner === 'red' ? 'КРАСНЫЕ' : 'СИНИЕ';
      const winnerColor = state.winner === 'red' ? '#ff4466' : '#4488ff';
      el.innerHTML = `<div class="cn-winner" style="color: ${winnerColor};">${winnerName} ПОБЕДИЛИ!</div>`;
    } else {
      el.innerHTML = '';
    }
  }

  function updateControls(state: CNGameState) {
    const el = document.getElementById('cn-controls')!;
    el.innerHTML = '';

    const localPlayer = engine.getLocalPlayer();

    if (state.phase === 'guessing' && localPlayer?.team === state.currentTeam && localPlayer?.role === 'guesser') {
      const endBtn = document.createElement('button');
      endBtn.className = 'btn cn-control-btn';
      endBtn.textContent = 'ЗАВЕРШИТЬ ХОД';
      endBtn.addEventListener('click', () => engine.endTurn());
      el.appendChild(endBtn);
    }

    if (state.phase === 'game_over') {
      const newBtn = document.createElement('button');
      newBtn.className = 'btn btn--green cn-control-btn';
      newBtn.textContent = 'НОВАЯ ИГРА';
      newBtn.addEventListener('click', () => engine.requestNewGame());
      el.appendChild(newBtn);
    }
  }

  function updateScores(state: CNGameState) {
    document.getElementById('cn-red-score')!.textContent = `${state.redScore}/${state.redTotal}`;
    document.getElementById('cn-blue-score')!.textContent = `${state.blueScore}/${state.blueTotal}`;
  }

  function updateStatus(state: CNGameState) {
    const el = document.getElementById('cn-status')!;
    if (state.phase === 'game_over') {
      el.textContent = '';
    } else {
      const team = state.currentTeam === 'red' ? 'КРАСНЫЕ' : 'СИНИЕ';
      const phase = state.phase === 'clue' ? 'подсказка' : 'угадывают';
      el.innerHTML = `<span style="color: ${state.currentTeam === 'red' ? '#ff4466' : '#4488ff'};">${team}</span> — ${phase}`;
    }
  }

  return div;
}
