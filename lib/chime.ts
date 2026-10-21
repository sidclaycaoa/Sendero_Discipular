/**
 * A soft bell for timers. The audio context must be made inside a tap; on iPhone
 * the page's sound follows the silent switch unless the audio session is "playback".
 */
export function prepareChime(): AudioContext | null {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const context = new Ctor();
  void context.resume().catch(() => undefined);
  return context;
}

export function ringChime(context: AudioContext | null) {
  if (!context) return;
  void context.resume().catch(() => undefined);
  [[660, 0, 0.7], [784, 0.6, 0.7], [988, 1.2, 1.3]].forEach(([frequency, at, length]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.5, context.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + at);
    oscillator.stop(context.currentTime + at + length + 0.05);
  });
  navigator.vibrate?.([300, 150, 300]);
}
