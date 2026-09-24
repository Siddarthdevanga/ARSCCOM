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
import { useEffect, useState, useCallback } from "react";

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

export function useInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  // Derived from navigator, so it must start false and be set after mount:
  // computing it during render makes the server and client disagree and
  // React discards the markup.
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const sync = () => setReady(!!deferredPrompt);
    listeners.add(sync);
    sync();
    const standalone = isStandalone();
    setInstalled(standalone);
    setIosHint(!standalone && isIosSafari());
    return () => listeners.delete(sync);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use — Chrome will fire a fresh one if the user
    // dismissed and remains eligible.
    deferredPrompt = null;
    notify();
    return outcome; // "accepted" | "dismissed"
  }, []);

  return {
    installed,
    canPrompt: ready && !installed,
    needsIosHint: iosHint,
    promptInstall,
  };
}
