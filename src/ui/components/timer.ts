let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTick(frequency: number, duration: number) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

function playUrgentTick() {
  playTick(880, 0.15);
}

function playWarningTick() {
  playTick(660, 0.12);
}

function playTimeUp() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

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

  if (remaining <= 0) {
    playTimeUp();
  } else if (remaining <= 5) {
    el.classList.add('game__timer--danger');
    playUrgentTick();
  } else if (remaining <= 10) {
    el.classList.add('game__timer--warning');
    playWarningTick();
  }
}
