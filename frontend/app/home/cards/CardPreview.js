"use client";
/* ============================================================================
   CARD PREVIEW — both faces
   Draws through the same routine that produces the downloadable PNG, at a
   smaller scale. What is on screen is therefore exactly what comes out of
   the printer, rather than a CSS approximation of it.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { drawFront, drawBack, downloadFace, CARD_W, CARD_H } from "./cardArt";
import styles from "./preview.module.css";

/* Enough resolution to judge the layout without rendering a 1004px canvas
   on every keystroke. */
const PREVIEW_SCALE = 0.46;

export default function CardPreview({ card, cardUrl, logoSrc, downloadable = false }) {
  const frontRef = useRef(null);
  const backRef  = useRef(null);
  const [qrSrc, setQrSrc] = useState("");
  const [busy, setBusy]   = useState(false);

  /* Black modules on white: decoding depends on contrast, and a tinted
     code fails on a meaningful share of scanners. */
  useEffect(() => {
    let cancelled = false;
    if (!cardUrl) return;
    QRCode.toDataURL(cardUrl, {
      width: 600, margin: 0, errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cardUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (frontRef.current) await drawFront(frontRef.current, card, { scale: PREVIEW_SCALE, logoSrc });
      if (cancelled) return;
      if (backRef.current)  await drawBack(backRef.current, card, { scale: PREVIEW_SCALE, qrSrc });
    })();
    return () => { cancelled = true; };
  }, [card, logoSrc, qrSrc]);

  const download = async (face) => {
    setBusy(true);
    try {
      const base = (card.name || "card").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
      await downloadFace(face, card, { logoSrc, qrSrc }, `${base}-${face}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.faces}>
        <figure className={styles.face}>
          <canvas
            ref={frontRef}
            className={styles.canvas}
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
            aria-label="Card front preview"
          />
          <figcaption>Front</figcaption>
        </figure>

        <figure className={styles.face}>
          <canvas
            ref={backRef}
            className={styles.canvas}
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
            aria-label="Card back preview"
          />
          <figcaption>Back</figcaption>
        </figure>
      </div>

      {downloadable && (
        <div className={styles.downloads}>
          <button type="button" onClick={() => download("front")} disabled={busy}>
            Download front
          </button>
          <button type="button" onClick={() => download("back")} disabled={busy}>
            Download back
          </button>
          <span className={styles.spec}>PNG · 85 × 55 mm · 300 dpi</span>
        </div>
      )}
    </div>
  );
}
