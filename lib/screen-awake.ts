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
 */
type Sentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

export function holdScreen() {
  const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  let sentinel: Sentinel | null = null;
  let active = true;

  const ask = () => {
    if (!wakeLock || !active || document.visibilityState !== "visible") return;
    wakeLock.request("screen").then((granted) => {
      if (active) sentinel = granted; else void granted.release().catch(() => undefined);
    }).catch(() => undefined);
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    ask();
    void video.play().catch(() => undefined);
  };

  const video = document.createElement("video");
  video.src = "/keep-awake.mp4";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
  document.body.appendChild(video);
  void video.play().catch(() => undefined);
  ask();
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisible);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  };
}
