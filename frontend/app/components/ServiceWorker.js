"use client";
/* ============================================================================
   SERVICE WORKER REGISTRATION
   Registered from a client component rather than inline in the layout so
   it never runs during SSR.

   Registration is deliberately deferred until after load: a service worker
   install competes for bandwidth with the page itself, and on the slow
   connections where it would help most, doing it eagerly makes the first
   paint worse.
   ========================================================================== */
import { useEffect } from "react";
import { isStandalone } from "./pwa";

export default function ServiceWorker() {
  /* Older iOS does not support the display-mode media query, so standalone
     is flagged on <html> for CSS to hook into. */
  useEffect(() => {
    if (isStandalone()) document.documentElement.classList.add("hv-standalone");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Only in production. In dev the worker would cache build output that
    // changes on every save, which produces baffling stale-asset bugs.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        // A failed registration must never break the app — the site works
        // perfectly well without one.
        console.warn("[sw] registration failed:", err?.message);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
