/**
 * Keeps the screen on during a practice. Must be called straight from the tap
 * that starts it: Safari only grants the wake lock, and only plays the
 * fallback video, inside that tap.
 *
 * - Screen Wake Lock, asked again whenever the app comes back to the front
 *   (the system drops it when the app is hidden).
 * - A muted, looping, invisible video: phones without a working wake lock
 *   (iPhone apps opened from the home screen before iOS 18.4) do not sleep
 *   while a video plays.
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
export type ScreenAwakeStatus = { supported: boolean; held: boolean; at: string; refused?: string };
const STATUS_KEY = "sendero_tela_acesa";
let current: ScreenAwakeStatus | null = null;

function note(status: Omit<ScreenAwakeStatus, "at">) {
  current = { ...status, at: new Date().toISOString() };
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(current)); } catch { /* private mode: shown only now */ }
}

export function readScreenAwakeStatus(): ScreenAwakeStatus | null {
  if (current) return current;
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? "null") as ScreenAwakeStatus | null; } catch { return null; }
}

export function holdScreen(): ScreenHold {
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
      note({ supported: true, held: true });
      // Dropped by the system (app hidden, or for its own reasons): asked again while still on screen.
      granted.addEventListener?.("release", () => { if (sentinel === granted) sentinel = null; ask(); });
    }).catch((error: unknown) => {
      if (active && !sentinel) note({ supported: true, held: false, refused: error instanceof Error ? error.message : String(error) });
    });
  };
  const play = () => {
    if (active && video.paused && document.visibilityState === "visible") void video.play().catch(() => undefined);
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    ask();
    play();
  };

  const video = document.createElement("video");
  video.src = "/keep-awake.mp4";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
  // Stopped from outside (the microphone of dictation, for one): it plays again.
  video.addEventListener("pause", () => window.setTimeout(play, 300));
  document.body.appendChild(video);
  void video.play().catch(() => undefined);
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
