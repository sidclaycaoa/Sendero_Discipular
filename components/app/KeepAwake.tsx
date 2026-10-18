"use client";

import { useEffect } from "react";

// Dictation can run for minutes without a touch; keep the screen on for this long after the last keystroke.
const IDLE_MS = 3 * 60 * 1000;

type Sentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

const isWritingField = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === "text") || (target instanceof HTMLElement && target.isContentEditable);

/**
 * While text is being written (typed or dictated), asks the phone not to dim
 * the screen. The installed app goes to sleep like any app, unlike a browser
 * tab, so dictating a reflection would otherwise stop after ~30 s.
 */
export function KeepAwake() {
  useEffect(() => {
    const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!wakeLock) return;
    let sentinel: Sentinel | null = null;
    let requesting = false;
    let lastWriting = 0;
    let idleTimer: number | undefined;

    async function hold() {
      if (sentinel || requesting || document.visibilityState !== "visible") return;
      requesting = true;
      try {
        sentinel = await wakeLock!.request("screen");
        (sentinel as unknown as EventTarget).addEventListener?.("release", () => { sentinel = null; });
      } catch { sentinel = null; }
      requesting = false;
    }
    function letGo() {
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    }
    function onWriting(event: Event) {
      if (!isWritingField(event.target)) return;
      lastWriting = Date.now();
      void hold();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(letGo, IDLE_MS);
    }
    function onVisible() {
      // The system drops the lock when the app is hidden; take it back if writing was recent.
      if (document.visibilityState === "visible" && Date.now() - lastWriting < IDLE_MS) void hold();
    }
    function onBlur(event: FocusEvent) {
      if (isWritingField(event.target) && !isWritingField(event.relatedTarget)) { window.clearTimeout(idleTimer); idleTimer = window.setTimeout(letGo, 30_000); }
    }

    document.addEventListener("focusin", onWriting);
    document.addEventListener("input", onWriting);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("focusin", onWriting);
      document.removeEventListener("input", onWriting);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(idleTimer);
      letGo();
    };
  }, []);
  return null;
}
