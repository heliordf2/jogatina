let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

function playTone({ frequency, duration = 0.08, type = 'sine', volume = 0.15, delay = 0 }) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playNoise({ duration = 0.1, volume = 0.12, delay = 0 }) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;

  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
}

export function playMoveSound() {
  unlockAudio();
  playTone({ frequency: 280, duration: 0.07, type: 'triangle', volume: 0.12 });
  playTone({ frequency: 180, duration: 0.05, type: 'sine', volume: 0.06, delay: 0.02 });
}

export function playCaptureSound() {
  unlockAudio();
  playNoise({ duration: 0.09, volume: 0.1 });
  playTone({ frequency: 120, duration: 0.12, type: 'square', volume: 0.1, delay: 0.01 });
  playTone({ frequency: 80, duration: 0.15, type: 'sine', volume: 0.08, delay: 0.04 });
}

export function playCheckSound() {
  unlockAudio();
  playTone({ frequency: 880, duration: 0.1, type: 'sine', volume: 0.14 });
  playTone({ frequency: 660, duration: 0.12, type: 'sine', volume: 0.12, delay: 0.12 });
}
