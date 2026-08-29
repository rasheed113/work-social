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

function toneBuffer(ctx: AudioContext, notes: number[], noteSeconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const framesPerNote = Math.max(1, Math.floor(sampleRate * noteSeconds));
  const buffer = ctx.createBuffer(1, framesPerNote * notes.length, sampleRate);
  const data = buffer.getChannelData(0);
  notes.forEach((frequency, noteIndex) => {
    const start = noteIndex * framesPerNote;
    for (let i = 0; i < framesPerNote; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.015);
      const release = Math.min(1, (noteSeconds - t) / 0.04);
      data[start + i] = Math.sin(2 * Math.PI * frequency * t) * 0.18 * Math.max(0, Math.min(attack, release));
    }
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
      notificationBuffer ??= toneBuffer(ctx, [880, 1320], 0.11);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = notificationBuffer;
      gain.gain.value = 0.8;
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
      ringtoneBuffer ??= toneBuffer(ctx, [660, 880, 660, 880], 0.22);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = ringtoneBuffer;
      source.loop = true;
      gain.gain.value = 0.75;
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
