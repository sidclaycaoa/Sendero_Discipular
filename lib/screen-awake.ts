/**
 * Keeps the screen on during a practice. Must be called straight from the tap
 * that starts it: Safari only grants the wake lock, and only plays the
 * fallback video, inside that tap.
 *
 * - Screen Wake Lock, asked again whenever the app comes back to the front
 *   (the system drops it when the app is hidden).
 * - A tiny video with a silent sound track (inline, at the end of this file),
 *   for phones where the wake lock does nothing (iPhone apps opened from the home screen before iOS 18.4, and
 *   some after). Safari only keeps the screen on for a video that plays sound,
 *   not muted and not looping (WebKit, HTMLMediaElement::shouldDisableSleep):
 *   a muted looping video never did. So it is not muted (the track is silence)
 *   and it goes back to the start by itself instead of looping.
 *
 * Both can be taken away while the hold is on (iPhone dictation turns the
 * microphone on, which can stop the page's video; the system may drop the wake
 * lock), so each one starts again by itself, and renew() checks both.
 *
 * Safari grants the first wake lock of a page only right after a tap or a key
 * (a touch counts when it ends, not when it starts). A request refused for
 * lack of one must never hold back the next, so requests are not queued
 * behind each other; once one is granted, later ones need no tap.
 */
type Sentinel = { release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void };
export type ScreenHold = (() => void) & { renew: () => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

/** What happened to the last request, kept on the phone so Configurações can show it. */
export type ScreenAwakeStatus = { supported: boolean; held: boolean; at: string; refused?: string; video?: boolean };
const STATUS_KEY = "sendero_tela_acesa";
let current: ScreenAwakeStatus | null = null;

function note(status: Partial<Omit<ScreenAwakeStatus, "at">>) {
  current = { supported: false, held: false, ...readScreenAwakeStatus(), ...status, at: new Date().toISOString() };
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(current)); } catch { /* private mode: shown only now */ }
}

export function readScreenAwakeStatus(): ScreenAwakeStatus | null {
  if (current) return current;
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? "null") as ScreenAwakeStatus | null; } catch { return null; }
}

/**
 * `mix`: while writing, the silent sound mixes with whatever is playing (music
 * keeps going) instead of taking over; practices leave the session to their bell.
 */
export function holdScreen({ mix = false } = {}): ScreenHold {
  const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  let sentinel: Sentinel | null = null;
  let active = true;
  if (!wakeLock) note({ supported: false, held: false });

  const ask = () => {
    if (!wakeLock || !active || sentinel || document.visibilityState !== "visible") return;
    wakeLock.request("screen").then((granted) => {
      // Not wanted any more, or another request got there first.
      if (!active || sentinel) { void granted.release().catch(() => undefined); return; }
      sentinel = granted;
      note({ supported: true, held: true, refused: undefined });
      // Dropped by the system (app hidden, or for its own reasons): asked again while still on screen.
      granted.addEventListener?.("release", () => { if (sentinel === granted) sentinel = null; ask(); });
    }).catch((error: unknown) => {
      if (active && !sentinel) note({ supported: true, held: false, refused: error instanceof Error ? error.message : String(error) });
    });
  };
  const play = () => {
    if (!active || !video.paused || document.visibilityState !== "visible") return;
    video.play().then(() => note({ video: true }), () => note({ video: false }));
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    ask();
    play();
  };

  const video = document.createElement("video");
  video.src = SILENT_VIDEO;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
  // Back to the start well before the end: a video that ended, or loops, lets the screen sleep.
  video.addEventListener("timeupdate", () => { if (video.currentTime > 2) video.currentTime = 0.1; });
  // Stopped from outside (the microphone of dictation, for one): it plays again, waiting longer
  // each time it is stopped again soon, so it never fights the dictation.
  let lastPause = 0;
  let wait = 300;
  video.addEventListener("pause", () => {
    const now = Date.now();
    wait = now - lastPause < 15_000 ? Math.min(wait * 3, 10_000) : 300;
    lastPause = now;
    window.setTimeout(play, wait);
  });
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (mix && session && session.type === "auto") session.type = "ambient";
  document.body.appendChild(video);
  play();
  ask();
  document.addEventListener("visibilitychange", onVisible);

  const stop = () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisible);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  };
  return Object.assign(stop, { renew: () => { ask(); play(); } });
}

// Source: scripts/assets/tela-acesa.mp4 (not served), 4 s of black 16×16 H.264 with a
// silent AAC track, made with ffmpeg (color + anullsrc). Inline like NoSleep.js, so
// Safari never needs the server to answer range requests for it.
const SILENT_VIDEO = "data:video/mp4;base64,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";
