"use client";
/* ============================================================================
   INSTALL APP — menu entry + pre-install dialog
   The dialog is shown before the browser's own prompt, never after, because
   the browser dialog is a bare yes/no with no room to explain anything.
   Installing from a website is not the same as installing from a store, and
   there are real limitations — particularly on iOS — that people should see
   before they commit, not discover a fortnight later.

   The entry renders nothing when there is nothing to offer: already
   installed, or a browser that can neither prompt nor add to the home
   screen. A dead button is worse than no button.
   ========================================================================== */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download, Share, ChevronRight, X, Check, AlertTriangle, Smartphone,
} from "lucide-react";
import { useInstallPrompt } from "./pwa";

export default function InstallMenuItem({ styles, onDone }) {
  const { canPrompt, needsIosHint, promptInstall } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // createPortal needs a real document, so this can only be true after
  // hydration. Computing it during render would make the server and client
  // disagree, which is a genuine bug; one extra render is not.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Escape closes, as it does for every other dialog in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  if (!canPrompt && !needsIosHint) return null;

  const platform = canPrompt ? "android" : "ios";

  const handleInstall = async () => {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    setOpen(false);
    // Only close the menu on a real install — closing after a dismissal
    // would feel like the app lost their place.
    if (outcome === "accepted") onDone?.();
  };

  return (
    <>
      <button className={styles.menuItem} onClick={() => setOpen(true)}>
        <div className={styles.menuItemIcon}><Download size={18} /></div>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemTitle}>Install App</span>
          <span className={styles.menuItemSubtitle}>
            {platform === "android"
              ? "Add Hai Visitor to your device"
              : "Add to your iPhone or iPad home screen"}
          </span>
        </div>
        <ChevronRight size={16} className={styles.menuItemArrow} />
      </button>

      {open && mounted && createPortal(
        <div
          className={styles.installOverlay}
          onClick={() => !busy && setOpen(false)}
          role="presentation"
        >
          <div
            className={styles.installCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <button
              className={styles.installClose}
              onClick={() => setOpen(false)}
              disabled={busy}
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className={styles.installIcon}><Smartphone size={22} /></div>
            <h3 id="install-title" className={styles.installTitle}>Install Hai Visitor</h3>
            <p className={styles.installSub}>
              Adds Hai Visitor to your device so it opens full screen, like an app.
            </p>

            <ul className={styles.installList}>
              <li><Check size={14} /> Opens full screen, without browser tabs or address bar</li>
              <li><Check size={14} /> One tap from the home screen — no logging in each time</li>
              <li><Check size={14} /> Updates automatically; nothing to reinstall</li>
            </ul>

            {/* The caveats. Installing from a website genuinely is not the
                same as installing from a store, and iOS has its own. */}
            <div className={styles.installWarn}>
              <div className={styles.installWarnHead}>
                <AlertTriangle size={14} /> Before you install
              </div>
              <ul>
                <li>
                  Installs from this website, not the Play Store or App Store.
                </li>
                <li>
                  Needs an internet connection — visitor and booking data is live,
                  not stored on the device.
                </li>
                {platform === "ios" && (
                  <li>
                    On iPhone and iPad, the app may sign you out if you do not open
                    it for a couple of weeks. Signing back in restores everything.
                  </li>
                )}
              </ul>
            </div>

            {platform === "ios" ? (
              <>
                <div className={styles.installSteps}>
                  <span className={styles.installStepsHead}>To install on iPhone or iPad</span>
                  <ol>
                    <li>Tap <Share size={13} /> <strong>Share</strong> in the Safari toolbar</li>
                    <li>Scroll down and choose <strong>Add to Home Screen</strong></li>
                    <li>Tap <strong>Add</strong></li>
                  </ol>
                  <p>Safari only — this option is not available in Chrome on iPhone.</p>
                </div>
                <button className={styles.installBtn} onClick={() => setOpen(false)}>
                  Got it
                </button>
              </>
            ) : (
              <button className={styles.installBtn} onClick={handleInstall} disabled={busy}>
                {busy ? "Opening…" : "Install"}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
