let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;
let ringtoneBuffer: AudioBuffer | null = null;
let ringtoneSource: AudioBufferSourceNode | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ??= new AudioContextCtor();
  return audioContext;
}

type ToneNote = { frequency: number; seconds: number; gapSeconds?: number };

function toneBuffer(ctx: AudioContext, notes: ToneNote[], masterGain: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSeconds = notes.reduce((sum, note) => sum + note.seconds + (note.gapSeconds ?? 0), 0);
  const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(sampleRate * totalSeconds)), sampleRate);
  const data = buffer.getChannelData(0);
  let offset = 0;

  notes.forEach(note => {
    const frames = Math.max(1, Math.floor(sampleRate * note.seconds));
    const attackSeconds = Math.min(0.018, note.seconds * 0.22);
    const releaseSeconds = Math.min(0.055, note.seconds * 0.35);
    const attackFrames = Math.max(1, Math.floor(sampleRate * attackSeconds));
    const releaseFrames = Math.max(1, Math.floor(sampleRate * releaseSeconds));

    for (let i = 0; i < frames && offset + i < data.length; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, i / attackFrames);
      const release = Math.min(1, (frames - i) / releaseFrames);
      const envelope = Math.max(0, Math.min(attack, release));
      const fundamental = Math.sin(2 * Math.PI * note.frequency * t);
      const softHarmonic = Math.sin(4 * Math.PI * note.frequency * t) * 0.08;
      data[offset + i] = (fundamental + softHarmonic) * masterGain * envelope;
    }

    offset += frames + Math.max(0, Math.floor(sampleRate * (note.gapSeconds ?? 0)));
  });

  return buffer;
}

async function resumeContext(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true;
  try {
    await ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function playNotificationSound(): void {
  const ctx = getContext();
  if (!ctx) return;
  void resumeContext(ctx).then(running => {
    if (!running) return;
    try {
      notificationBuffer ??= toneBuffer(ctx, [
        { frequency: 784, seconds: 0.075, gapSeconds: 0.018 },
        { frequency: 1047, seconds: 0.085 },
      ], 0.14);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = notificationBuffer;
      gain.gain.value = 0.9;
      source.connect(gain).connect(ctx.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    } catch {
      // Audio is enhancement-only; notification delivery must continue if audio is unavailable.
    }
  });
}

export function startCallRingtone(): void {
  if (ringtoneSource) return;
  const ctx = getContext();
  if (!ctx) return;
  void resumeContext(ctx).then(running => {
    if (!running || ringtoneSource) return;
    try {
      ringtoneBuffer ??= toneBuffer(ctx, [
        { frequency: 523, seconds: 0.16, gapSeconds: 0.045 },
        { frequency: 659, seconds: 0.16, gapSeconds: 0.045 },
        { frequency: 784, seconds: 0.19, gapSeconds: 0.06 },
        { frequency: 659, seconds: 0.16, gapSeconds: 0.045 },
      ], 0.11);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = ringtoneBuffer;
      source.loop = true;
      gain.gain.value = 0.82;
      source.connect(gain).connect(ctx.destination);
      source.onended = () => {
        if (ringtoneSource === source) ringtoneSource = null;
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      ringtoneSource = source;
    } catch {
      ringtoneSource = null;
    }
  });
}

export function stopCallRingtone(): void {
  const source = ringtoneSource;
  ringtoneSource = null;
  if (!source) return;
  try { source.stop(); } catch { /* already stopped */ }
  source.disconnect();
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

export function showBrowserNotification(title: string, body: string, tag: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // Browser notification support is optional and must never break realtime handling.
  }
}
