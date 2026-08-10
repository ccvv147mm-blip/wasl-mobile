/**
 * Global media lock: only one sound plays at a time, and everything stops
 * automatically when the page changes, is hidden, or the element leaves the DOM.
 */

type Detached = { el: HTMLAudioElement; onStop?: () => void };

const detached = new Set<Detached>();
const stoppers = new Set<() => void>();

/** Register any non-element sound (Web Audio streaming) so it obeys the lock. */
export function registerStopper(stop: () => void) {
  stoppers.add(stop);
  return () => stoppers.delete(stop);
}


/** Register a programmatically-created Audio (e.g. TTS) so it obeys the lock. */
export function registerDetachedAudio(el: HTMLAudioElement, onStop?: () => void) {
  const entry: Detached = { el, onStop };
  detached.add(entry);
  const cleanup = () => detached.delete(entry);
  el.addEventListener("ended", cleanup, { once: true });
  return () => {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
    cleanup();
  };
}

function domMedia(): HTMLMediaElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video"));
}

/** Pause every playing sound. `except` keeps one element running. */
export function stopAllMedia(except?: HTMLMediaElement | null) {
  for (const el of domMedia()) {
    if (el === except) continue;
    if (!el.paused) el.pause();
  }
  for (const entry of Array.from(detached)) {
    if (entry.el === except) continue;
    try {
      entry.el.pause();
    } catch {
      /* ignore */
    }
    entry.onStop?.();
    detached.delete(entry);
  }
  for (const stop of Array.from(stoppers)) {
    stoppers.delete(stop);
    try {
      stop();
    } catch {
      /* ignore */
    }
  }
}


/** Install document-level listeners. Returns a cleanup function. */
export function installMediaLock() {
  if (typeof document === "undefined") return () => {};

  // Any element starting playback silences the others.
  const onPlay = (e: Event) => {
    const target = e.target as HTMLMediaElement | null;
    if (!target || !("paused" in target)) return;
    stopAllMedia(target);
  };
  document.addEventListener("play", onPlay, true);

  // Leaving/hiding the tab stops the sound.
  const onHidden = () => {
    if (document.visibilityState === "hidden") stopAllMedia();
  };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", () => stopAllMedia());

  return () => {
    document.removeEventListener("play", onPlay, true);
    document.removeEventListener("visibilitychange", onHidden);
  };
}
