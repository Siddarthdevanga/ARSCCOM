"use client";
/* ============================================================================
   LOGO INTRO
   The V mark zooms up and fades, handing off to the page beneath it.

   Shown once per browser session. That single rule covers both cases that
   matter: someone arriving fresh gets the flourish, and someone whose
   session expired mid-task and got bounced back to /login does not — they
   already saw it when they signed in, and making them watch an animation
   before they can get back to work would be hostile.

   It is decoration over a static page, so it must never be able to trap
   anyone: it removes itself on a timer, ignores whether anything has
   loaded, stops intercepting clicks the moment it starts fading, and is
   skipped outright under prefers-reduced-motion.
   ========================================================================== */
import { useEffect, useState } from "react";
import styles from "./LogoIntro.module.css";

const SEEN_KEY = "hv_intro_seen";
const HOLD_MS  = 900;   // mark is visible and animating
const FADE_MS  = 420;   // overlay fades out

export default function LogoIntro() {
  // Starts false so the server and first client render agree; a mismatch
  // here would flash the overlay on every navigation.
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Private mode or blocked storage: treat as seen rather than replaying
      // the intro on every single page view.
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (seen || reduced) {
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
      return;
    }

    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    // sessionStorage and prefers-reduced-motion are browser-only, so this
    // decision cannot be made during render without the server and client
    // disagreeing. The extra render is the cost of not shipping a
    // hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);

    const fade = setTimeout(() => setLeaving(true), HOLD_MS);
    const done = setTimeout(() => setShow(false), HOLD_MS + FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`${styles.overlay} ${leaving ? styles.leaving : ""}`}
      aria-hidden="true"
    >
      <img src="/v-transparent.png" alt="" className={styles.mark} />
    </div>
  );
}
