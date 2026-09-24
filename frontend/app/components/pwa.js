"use client";
/* ============================================================================
   PWA INSTALL STATE
   Chrome fires `beforeinstallprompt` very early — often before React has
   hydrated. If nothing is listening at that moment the event is gone and
   the app can never trigger an install. So the listener is attached at
   module scope, the moment this file is imported, and the event is parked
   for whichever component asks for it later.

   iOS is a separate case: Safari never fires the event and gives no API to
   trigger an install, so there the only honest option is to tell the user
   where the button is.
   ========================================================================== */
import { useCallback, useSyncExternalStore } from "react";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome showing its own mini-infobar; we surface it in the menu.
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS predates display-mode and sets this instead.
    window.navigator.standalone === true
  );
}

export function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // Chrome/Firefox on iOS cannot add to the home screen at all.
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

/* Subscribing to the module-level store rather than mirroring it into
   component state. useSyncExternalStore exists for exactly this: it reads
   the value during render on the client and takes a separate server
   snapshot, so there is no hydration mismatch and no extra render pass. */
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useInstallPrompt() {
  const canPromptNow = useSyncExternalStore(
    subscribe,
    () => !!deferredPrompt && !isStandalone(),
    () => false            // server: never offer an install
  );

  const installed = useSyncExternalStore(
    subscribe,
    () => isStandalone(),
    () => false
  );

  const needsIosHint = useSyncExternalStore(
    subscribe,
    () => !isStandalone() && isIosSafari(),
    () => false
  );

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use — Chrome fires a fresh one if the user
    // dismissed and remains eligible.
    deferredPrompt = null;
    notify();
    return outcome; // "accepted" | "dismissed"
  }, []);

  return { installed, canPrompt: canPromptNow, needsIosHint, promptInstall };
}
