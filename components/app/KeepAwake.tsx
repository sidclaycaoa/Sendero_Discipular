"use client";

import { useEffect } from "react";
import { holdScreen, type ScreenHold } from "@/lib/screen-awake";

// Same limit as the PIN lock (LOCK_AFTER_MS in worker/auth.ts): after leaving a text field,
// the screen stays on this long and then may sleep.
const AFTER_LEAVING_MS = 5 * 60 * 1000;
// A field left with the cursor in it and nothing written for this long (phone forgotten on the table).
const FORGOTTEN_MS = 30 * 60 * 1000;
// While the cursor is in a field, the hold is checked this often: dictation sends almost no
// events, and turning the microphone on can stop what keeps the screen on.
const CHECK_EVERY_MS = 10 * 1000;

const isWritingField = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search")) || (target instanceof HTMLElement && target.isContentEditable);
const writing = () => isWritingField(document.activeElement);

/**
 * While a text field has the cursor (Diário, reflections, Caderno…), keeps the
 * phone from dimming the screen, whether typing or dictating: iPhone dictation
 * sends almost no typing events, so the hold follows the focus, not the keys.
 * It uses the same means as the practices (wake lock plus a silent video, which
 * works in the installed iPhone app where the wake lock alone fails), holds again
 * when the app comes back to the front, and lets go 5 minutes after leaving the field.
 */
export function KeepAwake() {
  useEffect(() => {
    let release: ScreenHold | null = null;
    // The phone stops the video while the app is hidden; the next tap starts it afresh.
    let stale = false;
    let timer: number | undefined;

    function letGo() {
      release?.();
      release = null;
    }
    function hold() {
      if (stale) { letGo(); stale = false; }
      if (release) release.renew();
      else release = holdScreen({ mix: true });
      window.clearTimeout(timer);
      timer = window.setTimeout(letGo, FORGOTTEN_MS);
    }
    function onTap(event: Event) {
      if (isWritingField(event.target) || writing()) hold();
    }
    function onFocus(event: Event) {
      if (isWritingField(event.target)) hold();
    }
    function onLeave() {
      // Wait for the focus to land: moving from one field to another is not leaving.
      window.setTimeout(() => {
        if (writing() || !release) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(letGo, AFTER_LEAVING_MS);
      }, 0);
    }
    function onWriting(event: Event) {
      if (isWritingField(event.target)) hold();
    }
    const check = window.setInterval(() => {
      if (release && writing() && document.visibilityState === "visible") release.renew();
    }, CHECK_EVERY_MS);
    function onVisible() {
      if (document.visibilityState === "hidden") { stale = Boolean(release); return; }
      if (!writing()) return;
      hold();
      // Started without a tap, the video may be refused: the first tap renews it.
      stale = true;
    }

    // The touch that ends (and the click after it) is what lets Safari grant the hold; dictation
    // right after tapping into a field brings no key to ask again.
    document.addEventListener("pointerdown", onTap, true);
    document.addEventListener("touchend", onTap, true);
    document.addEventListener("click", onTap, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onLeave);
    document.addEventListener("input", onWriting);
    document.addEventListener("keydown", onWriting);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("pointerdown", onTap, true);
      document.removeEventListener("touchend", onTap, true);
      document.removeEventListener("click", onTap, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onLeave);
      document.removeEventListener("input", onWriting);
      document.removeEventListener("keydown", onWriting);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
      window.clearInterval(check);
      letGo();
    };
  }, []);
  return null;
}
