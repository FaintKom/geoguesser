let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

// Must be called from a user gesture (click) to unlock audio
export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Play a silent sound to fully unlock
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.01);
    audioUnlocked = true;
    console.log('[GeoGuesser] Audio unlocked');
  } catch {
    // Audio not supported
  }
}

function playTick(frequency: number, duration: number, volume: number) {
  if (!audioCtx || !audioUnlocked) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // ignore
  }
}

function playWarningTick() {
  playTick(660, 0.15, 0.3);
}

function playUrgentTick() {
  playTick(880, 0.2, 0.4);
}

function playTimeUp() {
  if (!audioCtx || !audioUnlocked) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Two-tone alarm
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = i % 2 === 0 ? 520 : 440;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.14);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.14);
    }
  } catch {
    // ignore
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
