import type { Player } from '../../types';

export function renderPlayerList(players: Player[]): HTMLElement {
  const ul = document.createElement('ul');
  ul.className = 'lobby__players';

  for (const player of players) {
    const li = document.createElement('li');
    li.className = 'lobby__player';
    li.innerHTML = `
      <span class="lobby__player-dot"></span>
      <span>${escapeHtml(player.name)}</span>
      ${player.isHost ? '<span class="lobby__player-host">HOST</span>' : ''}
    `;
    ul.appendChild(li);
  }

  return ul;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
