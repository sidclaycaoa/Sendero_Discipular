"use client";

import { useEffect } from "react";
import { holdScreen } from "@/lib/screen-awake";

// Same limit as the PIN lock (LOCK_AFTER_MS in worker/auth.ts): while writing or dictating,
// the screen stays on until this long passes without a keystroke.
const IDLE_MS = 5 * 60 * 1000;

const isWritingField = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search")) || (target instanceof HTMLElement && target.isContentEditable);

/**
 * While text is being written or dictated (Diário, reflections, Caderno…), keeps
 * the phone from dimming the screen. It uses the same means as the practices
 * (wake lock plus a silent video, which works in the installed iPhone app where
 * the wake lock alone fails) and lets the screen sleep after 5 minutes without
 * typing. It starts on the tap into a text field, the only moment the phone allows it.
 */
export function KeepAwake() {
  useEffect(() => {
    let release: (() => void) | null = null;
    let idleTimer: number | undefined;

    function letGo() {
      release?.();
      release = null;
    }
    function keep() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(letGo, IDLE_MS);
    }
    function onTap(event: Event) {
      if (!isWritingField(event.target)) return;
      release ??= holdScreen();
      keep();
    }
    function onWriting(event: Event) {
      if (!isWritingField(event.target)) return;
      // Dictation and typing only extend the time; starting needs the tap (see onTap).
      if (release) keep();
    }

    document.addEventListener("pointerdown", onTap, true);
    document.addEventListener("focusin", onTap);
    document.addEventListener("input", onWriting);
    document.addEventListener("keydown", onWriting);
    return () => {
      document.removeEventListener("pointerdown", onTap, true);
      document.removeEventListener("focusin", onTap);
      document.removeEventListener("input", onWriting);
      document.removeEventListener("keydown", onWriting);
      window.clearTimeout(idleTimer);
      letGo();
    };
  }, []);
  return null;
}
