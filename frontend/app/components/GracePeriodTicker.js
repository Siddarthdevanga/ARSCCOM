"use client";
/* ============================================================================
   GRACE PERIOD TICKER
   A seamless scrolling marquee.

   The loop only looks continuous when the copies left on screen can cover
   the viewport at the moment the first one scrolls out — that is,
   (copies - 1) * copyWidth >= viewportWidth. A fixed two copies satisfies
   that on a laptop and fails on a wide monitor, which shows up as a gap
   trailing the message. So the count is measured rather than assumed, and
   recomputed when the container resizes.
   ========================================================================== */
import { useEffect, useRef, useState, useCallback } from "react";
import styles from "../styles/gracePeriod.module.css";

const SPEED_PX_PER_SEC = 60;   // constant regardless of how many copies
const MIN_COPIES = 2;
const MAX_COPIES = 12;         // guards against a pathological measurement

export default function GracePeriodTicker({ children, renewLabel = "Renew Now", onRenew }) {
  const viewportRef = useRef(null);
  const measureRef = useRef(null);
  const [copies, setCopies] = useState(MIN_COPIES);
  const [copyWidth, setCopyWidth] = useState(0);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const one = measureRef.current;
    if (!viewport || !one) return;

    const w = one.getBoundingClientRect().width;
    const v = viewport.getBoundingClientRect().width;
    if (!w || !v) return;

    // +1 so a full copy is always queued behind the one leaving the screen.
    const needed = Math.ceil(v / w) + 1;
    setCopyWidth(w);
    setCopies(Math.min(MAX_COPIES, Math.max(MIN_COPIES, needed)));
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, [measure, children]);

  // Shift by exactly one copy, so the track lands on an identical frame.
  const duration = copyWidth ? copyWidth / SPEED_PX_PER_SEC : 20;

  return (
    <div className={styles.gracePeriodTicker}>
      <div className={styles.tickerViewport} ref={viewportRef}>
        {/* Off-screen reference copy, measured but never animated. */}
        <div className={styles.tickerMeasure} ref={measureRef} aria-hidden="true">
          {children}
        </div>

        <div
          className={styles.tickerTrack}
          style={{ "--copy-w": `${copyWidth}px`, animationDuration: `${duration}s` }}
        >
          {Array.from({ length: copies }, (_, i) => (
            // Only the first copy is read out; the rest are visual repeats.
            <div className={styles.tickerContent} key={i} aria-hidden={i > 0}>
              {children}
            </div>
          ))}
        </div>
      </div>

      <button className={styles.tickerRenewBtn} onClick={onRenew}>{renewLabel}</button>
    </div>
  );
}
