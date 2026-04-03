export function createTimerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'game__timer';
  el.textContent = '--';
  return el;
}

export function updateTimer(el: HTMLElement, remaining: number) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  el.classList.remove('game__timer--warning', 'game__timer--danger');
  if (remaining <= 5) {
    el.classList.add('game__timer--danger');
  } else if (remaining <= 10) {
    el.classList.add('game__timer--warning');
  }
}
